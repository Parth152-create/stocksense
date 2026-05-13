package com.stocksense.controller;

import com.stocksense.service.UserService;
import com.stocksense.model.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * WalletController — mock data until a real wallet/ledger table is created.
 *
 * Endpoints:
 *   GET  /api/wallet/balance   → { balance, currency, lastUpdated }
 *   POST /api/wallet/deposit   → { success, newBalance, transactionId }
 *   POST /api/wallet/withdraw  → { success, newBalance, transactionId }
 *   GET  /api/wallet/transactions → [{ id, type, amount, status, createdAt, description }]
 */
@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    private final UserService userService;

    // In-memory mock state per user (replace with DB later)
    private static final Map<UUID, Double> balances = new HashMap<>();

    public WalletController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/balance")
    public ResponseEntity<Map<String, Object>> getBalance(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getUserByEmail(userDetails.getUsername());
        double balance = balances.getOrDefault(user.getId(), 10000.00);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("balance", balance);
        resp.put("currency", "USD");
        resp.put("lastUpdated", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/deposit")
    public ResponseEntity<Map<String, Object>> deposit(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> body) {
        User user = userService.getUserByEmail(userDetails.getUsername());
        double amount = body.containsKey("amount")
                ? ((Number) body.get("amount")).doubleValue() : 0;
        if (amount <= 0) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Amount must be positive"));
        }
        double current = balances.getOrDefault(user.getId(), 10000.00);
        double newBalance = current + amount;
        balances.put(user.getId(), newBalance);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("newBalance", newBalance);
        resp.put("transactionId", UUID.randomUUID().toString());
        resp.put("type", "deposit");
        resp.put("amount", amount);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/withdraw")
    public ResponseEntity<Map<String, Object>> withdraw(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> body) {
        User user = userService.getUserByEmail(userDetails.getUsername());
        double amount = body.containsKey("amount")
                ? ((Number) body.get("amount")).doubleValue() : 0;
        double current = balances.getOrDefault(user.getId(), 10000.00);
        if (amount <= 0 || amount > current) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid withdrawal amount"));
        }
        double newBalance = current - amount;
        balances.put(user.getId(), newBalance);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("newBalance", newBalance);
        resp.put("transactionId", UUID.randomUUID().toString());
        resp.put("type", "withdrawal");
        resp.put("amount", amount);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<Map<String, Object>>> getTransactions(
            @AuthenticationPrincipal UserDetails userDetails) {
        // Mock transaction history — replace with real DB query
        List<Map<String, Object>> txs = new ArrayList<>();
        String[] types = {"deposit", "withdrawal", "deposit", "deposit", "withdrawal"};
        double[] amounts = {500, 200, 1080, 250, 75};
        String[] descs = {"Bank transfer", "Portfolio funding", "Linked account", "Initial deposit", "Fee deduction"};
        String[] statuses = {"completed", "completed", "completed", "completed", "pending"};

        for (int i = 0; i < types.length; i++) {
            Map<String, Object> tx = new LinkedHashMap<>();
            tx.put("id", "tx-mock-" + (i + 1));
            tx.put("type", types[i]);
            tx.put("amount", amounts[i]);
            tx.put("description", descs[i]);
            tx.put("status", statuses[i]);
            tx.put("createdAt", LocalDateTime.now()
                    .minusDays(i)
                    .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            txs.add(tx);
        }
        return ResponseEntity.ok(txs);
    }
}
