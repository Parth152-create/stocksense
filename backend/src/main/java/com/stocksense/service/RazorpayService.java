package com.stocksense.service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * RazorpayService
 *
 * Creates Razorpay orders for INR wallet top-ups.
 *
 * Flow:
 *   1. Frontend calls POST /api/payments/razorpay/order { amount }  (amount in INR)
 *   2. Backend creates Razorpay order → returns { orderId, amount, currency, keyId }
 *   3. Frontend opens Razorpay checkout modal with these details
 *   4. User pays → Razorpay returns { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 *   5. Frontend calls POST /api/payments/razorpay/verify with those 3 fields
 *   6. Backend verifies signature → credits wallet
 */
@Service
public class RazorpayService {

    private static final Logger log = LoggerFactory.getLogger(RazorpayService.class);

    @Value("${razorpay.key.id}")
    private String keyId;

    @Value("${razorpay.key.secret}")
    private String keySecret;

    /**
     * Creates a Razorpay order.
     *
     * @param amountInPaise  amount in smallest unit (paise, 1 INR = 100 paise)
     * @param userId         stored in notes for reference
     * @param userEmail      stored in notes for reference
     */
    public Map<String, Object> createOrder(long amountInPaise,
                                            String userId,
                                            String userEmail) throws RazorpayException {
        RazorpayClient client = new RazorpayClient(keyId, keySecret);

        JSONObject options = new JSONObject();
        options.put("amount",   amountInPaise);
        options.put("currency", "INR");
        options.put("receipt",  "wallet_topup_" + userId.substring(0, 8));
        options.put("notes", new JSONObject()
                .put("userId",    userId)
                .put("userEmail", userEmail)
                .put("source",    "wallet_topup"));

        Order order = client.orders.create(options);

        log.info("[Razorpay] Created order {} for userId={} amount={}paise",
                order.get("id"), userId, amountInPaise);

        return Map.of(
            "orderId",  order.get("id").toString(),
            "amount",   amountInPaise,
            "currency", "INR",
            "keyId",    keyId
        );
    }

    /**
     * Verifies Razorpay payment signature.
     * HMAC-SHA256(orderId + "|" + paymentId, keySecret) must equal signature.
     *
     * @return true if signature is valid
     */
    public boolean verifyPaymentSignature(String orderId,
                                           String paymentId,
                                           String signature) {
        try {
            JSONObject attributes = new JSONObject();
            attributes.put("razorpay_order_id",   orderId);
            attributes.put("razorpay_payment_id", paymentId);
            attributes.put("razorpay_signature",  signature);
            Utils.verifyPaymentSignature(attributes, keySecret);
            log.info("[Razorpay] Signature verified for orderId={} paymentId={}", orderId, paymentId);
            return true;
        } catch (RazorpayException e) {
            log.warn("[Razorpay] Signature verification failed for orderId={}: {}", orderId, e.getMessage());
            return false;
        }
    }
}