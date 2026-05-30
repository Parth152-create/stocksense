package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.model.WalletBalance;
import com.stocksense.model.WalletTransaction;
import com.stocksense.repository.WalletBalanceRepository;
import com.stocksense.repository.WalletTransactionRepository;
import com.stocksense.service.RazorpayService;
import com.stocksense.service.StripeService;
import com.stocksense.service.UserService;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * PaymentController
 *
 * Stripe endpoints:
 *   POST /api/payments/stripe/checkout   → create checkout session
 *   POST /api/payments/stripe/webhook    → handle Stripe events (no auth)
 *   GET  /api/payments/stripe/verify     → verify session after redirect
 *
 * Razorpay endpoints:
 *   POST /api/payments/razorpay/order    → create Razorpay order
 *   POST /api/payments/razorpay/verify   → verify payment + credit wallet
 */
@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    private final StripeService               stripeService;
    private final RazorpayService             razorpayService;
    private final UserService                 userService;
    private final WalletBalanceRepository     walletBalanceRepo;
    private final WalletTransactionRepository walletTxRepo;

    public PaymentController(StripeService stripeService,
                              RazorpayService razorpayService,
                              UserService userService,
                              WalletBalanceRepository walletBalanceRepo,
                              WalletTransactionRepository walletTxRepo) {
        this.stripeService     = stripeService;
        this.razorpayService   = razorpayService;
        this.userService       = userService;
        this.walletBalanceRepo = walletBalanceRepo;
        this.walletTxRepo      = walletTxRepo;
    }

    // ── Stripe ────────────────────────────────────────────────────────────────

    /**
     * POST /api/payments/stripe/checkout
     * Body: { "amount": 50.00, "currency": "usd" }
     * Returns: { sessionId, url, publishableKey }
     */
    @PostMapping("/stripe/checkout")
    public ResponseEntity<?> stripeCheckout(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, Object> body) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        try {
            User user = userService.getUserByEmail(email);
            double amount   = Double.parseDouble(body.get("amount").toString());
            String currency = body.getOrDefault("currency", "usd").toString().toLowerCase();

            // Convert to cents (Stripe uses smallest currency unit)
            long amountInCents = Math.round(amount * 100);

            if (amountInCents < 50) // Stripe minimum is $0.50
                return ResponseEntity.badRequest().body(Map.of("error", "Minimum top-up is $0.50"));

            Map<String, String> session = stripeService.createCheckoutSession(
                amountInCents,
                currency,
                user.getEmail(),
                user.getId().toString(),
                "http://localhost:3000/dashboard/wallet?payment=success",
                "http://localhost:3000/dashboard/wallet?payment=cancelled"
            );

            return ResponseEntity.ok(session);

        } catch (Exception e) {
            log.error("[PaymentController] Stripe checkout failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/payments/stripe/webhook
     * Called by Stripe — no JWT auth, verified by signature instead.
     */
    @PostMapping("/stripe/webhook")
    public ResponseEntity<?> stripeWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String sigHeader) {

        if (sigHeader == null)
            return ResponseEntity.badRequest().body("Missing Stripe-Signature header");

        Event event = stripeService.constructWebhookEvent(payload, sigHeader);
        if (event == null)
            return ResponseEntity.status(400).body("Invalid signature");

        if ("checkout.session.completed".equals(event.getType())) {
            try {
                Session session = (Session) event.getDataObjectDeserializer()
                        .getObject().orElse(null);
                if (session != null && "paid".equals(session.getPaymentStatus())) {
                    String userId      = session.getMetadata().get("userId");
                    long   amountCents = session.getAmountTotal();
                    creditWallet(UUID.fromString(userId),
                                 BigDecimal.valueOf(amountCents / 100.0),
                                 "Stripe top-up via card (session: " + session.getId() + ")");
                }
            } catch (Exception e) {
                log.error("[Stripe Webhook] Failed to process session: {}", e.getMessage());
                return ResponseEntity.status(500).body("Processing error");
            }
        }

        return ResponseEntity.ok(Map.of("received", true));
    }

    /**
     * GET /api/payments/stripe/verify?session_id=cs_xxx
     * Called after Stripe redirects back to success URL.
     * Double-checks payment status and credits wallet if not already done.
     */
    @GetMapping("/stripe/verify")
    public ResponseEntity<?> stripeVerify(
            @AuthenticationPrincipal String email,
            @RequestParam("session_id") String sessionId) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        try {
            Session session = stripeService.retrieveSession(sessionId);
            if (!"paid".equals(session.getPaymentStatus())) {
                return ResponseEntity.ok(Map.of("paid", false, "status", session.getPaymentStatus()));
            }

            // Credit wallet — idempotent: check if this session was already processed
            String txDesc = "Stripe top-up (session: " + sessionId + ")";
            boolean alreadyProcessed = walletTxRepo
                    .findByUserIdOrderByCreatedAtDesc(userService.getUserByEmail(email).getId())
                    .stream()
                    .anyMatch(tx -> tx.getDescription() != null && tx.getDescription().contains(sessionId));

            if (!alreadyProcessed) {
                User user = userService.getUserByEmail(email);
                creditWallet(user.getId(),
                             BigDecimal.valueOf(session.getAmountTotal() / 100.0),
                             txDesc);
            }

            WalletBalance wallet = walletBalanceRepo
                    .findByUserId(userService.getUserByEmail(email).getId())
                    .orElseThrow();

            return ResponseEntity.ok(Map.of(
                "paid",       true,
                "amount",     session.getAmountTotal() / 100.0,
                "currency",   session.getCurrency().toUpperCase(),
                "newBalance", wallet.getBalance()
            ));

        } catch (Exception e) {
            log.error("[PaymentController] Stripe verify failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // ── Razorpay ──────────────────────────────────────────────────────────────

    /**
     * POST /api/payments/razorpay/order
     * Body: { "amount": 500 }  ← amount in INR (not paise)
     * Returns: { orderId, amount, currency, keyId }
     */
    @PostMapping("/razorpay/order")
    public ResponseEntity<?> razorpayOrder(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, Object> body) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        try {
            User user       = userService.getUserByEmail(email);
            double amountINR = Double.parseDouble(body.get("amount").toString());

            if (amountINR < 1)
                return ResponseEntity.badRequest().body(Map.of("error", "Minimum top-up is ₹1"));

            long amountInPaise = Math.round(amountINR * 100);

            Map<String, Object> order = razorpayService.createOrder(
                amountInPaise,
                user.getId().toString(),
                user.getEmail()
            );

            return ResponseEntity.ok(order);

        } catch (Exception e) {
            log.error("[PaymentController] Razorpay order creation failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/payments/razorpay/verify
     * Body: { orderId, paymentId, signature, amount }
     * Verifies HMAC signature → credits wallet
     */
    @PostMapping("/razorpay/verify")
    public ResponseEntity<?> razorpayVerify(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, Object> body) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String orderId   = body.get("orderId").toString();
        String paymentId = body.get("paymentId").toString();
        String signature = body.get("signature").toString();
        double amountINR = Double.parseDouble(body.get("amount").toString());

        boolean valid = razorpayService.verifyPaymentSignature(orderId, paymentId, signature);
        if (!valid)
            return ResponseEntity.status(400).body(Map.of("error", "Invalid payment signature"));

        try {
            User user = userService.getUserByEmail(email);
            creditWallet(user.getId(),
                         BigDecimal.valueOf(amountINR),
                         "Razorpay top-up (payment: " + paymentId + ")");

            WalletBalance wallet = walletBalanceRepo.findByUserId(user.getId()).orElseThrow();

            return ResponseEntity.ok(Map.of(
                "success",    true,
                "amount",     amountINR,
                "currency",   "INR",
                "newBalance", wallet.getBalance()
            ));

        } catch (Exception e) {
            log.error("[PaymentController] Razorpay credit failed: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // ── Shared wallet credit helper ───────────────────────────────────────────

    private void creditWallet(UUID userId, BigDecimal amount, String description) {
        WalletBalance wallet = walletBalanceRepo.findByUserId(userId)
                .orElseGet(() -> walletBalanceRepo.save(new WalletBalance(userId)));

        wallet.setBalance(wallet.getBalance().add(amount));
        wallet.setUpdatedAt(LocalDateTime.now());
        walletBalanceRepo.save(wallet);

        walletTxRepo.save(new WalletTransaction(userId, "deposit", amount, description));

        log.info("[PaymentController] Credited {} to userId={} — {}", amount, userId, description);
    }
}