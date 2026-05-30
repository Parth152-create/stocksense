package com.stocksense.service;

import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * StripeService
 *
 * Creates Stripe Checkout sessions for wallet top-ups.
 * On successful payment, the webhook handler credits the wallet.
 *
 * Flow:
 *   1. Frontend calls POST /api/payments/stripe/checkout { amount, currency }
 *   2. Backend creates a Checkout Session → returns { sessionId, url }
 *   3. Frontend redirects to Stripe Checkout URL
 *   4. User pays → Stripe sends checkout.session.completed webhook
 *   5. Webhook handler credits wallet via WalletController logic
 */
@Service
public class StripeService {

    private static final Logger log = LoggerFactory.getLogger(StripeService.class);

    @Value("${stripe.secret.key}")
    private String secretKey;

    @Value("${stripe.webhook.secret:whsec_placeholder}")
    private String webhookSecret;

    @Value("${stripe.publishable.key}")
    private String publishableKey;

    /**
     * Creates a Stripe Checkout Session.
     *
     * @param amountInCents  amount in smallest currency unit (cents for USD)
     * @param currency       ISO currency code e.g. "usd"
     * @param userEmail      pre-fills the checkout email field
     * @param userId         stored as metadata so webhook can credit the right wallet
     * @param successUrl     redirect after successful payment
     * @param cancelUrl      redirect if user cancels
     */
    public Map<String, String> createCheckoutSession(
            long amountInCents,
            String currency,
            String userEmail,
            String userId,
            String successUrl,
            String cancelUrl) throws Exception {

        Stripe.apiKey = secretKey;

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setCustomerEmail(userEmail)
                .setSuccessUrl(successUrl + "?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(cancelUrl)
                .addLineItem(
                    SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(
                            SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(currency)
                                .setUnitAmount(amountInCents)
                                .setProductData(
                                    SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("StockSense Wallet Top-up")
                                        .setDescription("Add funds to your StockSense trading wallet")
                                        .build()
                                )
                                .build()
                        )
                        .build()
                )
                .putMetadata("userId",  userId)
                .putMetadata("source",  "wallet_topup")
                .build();

        Session session = Session.create(params);

        log.info("[Stripe] Created checkout session {} for userId={} amount={}{}",
                session.getId(), userId, amountInCents / 100.0, currency.toUpperCase());

        return Map.of(
            "sessionId",       session.getId(),
            "url",             session.getUrl(),
            "publishableKey",  publishableKey
        );
    }

    /**
     * Verifies and parses an incoming Stripe webhook event.
     * Returns null if signature verification fails.
     */
    public Event constructWebhookEvent(String payload, String sigHeader) {
        try {
            return Webhook.constructEvent(payload, sigHeader, webhookSecret);
        } catch (SignatureVerificationException e) {
            log.warn("[Stripe] Webhook signature verification failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Retrieves a completed Checkout Session by ID.
     * Used to verify payment on success redirect.
     */
    public Session retrieveSession(String sessionId) throws Exception {
        Stripe.apiKey = secretKey;
        return Session.retrieve(sessionId);
    }
}