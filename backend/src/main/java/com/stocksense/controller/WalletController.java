package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.model.WalletBalance;
import com.stocksense.model.WalletTransaction;
import com.stocksense.repository.WalletBalanceRepository;
import com.stocksense.repository.WalletTransactionRepository;
import com.stocksense.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    private final UserService userService;
    private final WalletBalanceRepository balanceRepo;
    private final WalletTransactionRepository txRepo;

    public WalletController(UserService userService,
                            WalletBalanceRepository balanceRepo,
                            WalletTransactionRepository txRepo) {
        this.userService = userService;
        this.balanceRepo = balanceRepo;
        this.txRepo = txRepo;
    }

    // ── Helper: get or create wallet row ─────────────────────────────────────
    private WalletBalance getOrCreate(UUID userId) {
        return balanceRepo.findByUserId(userId).orElseGet(() -> {
            WalletBalance w = new WalletBalance(userId);
            return balanceRepo.save(w);
        });
    }

    // ── GET /api/wallet/balance ───────────────────────────────────────────────
    @GetMapping("/balance")
    public ResponseEntity<?> getBalance(@AuthenticationPrincipal String email) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        WalletBalance wallet = getOrCreate(user.getId());

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("balance", wallet.getBalance());
        resp.put("currency", wallet.getCurrency());
        resp.put("lastUpdated", wallet.getUpdatedAt().toString());
        return ResponseEntity.ok(resp);
    }

    // ── POST /api/wallet/deposit ──────────────────────────────────────────────
    @PostMapping("/deposit")
    public ResponseEntity<?> deposit(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, Object> body) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        BigDecimal amount;
        try {
            amount = new BigDecimal(body.get("amount").toString()).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid amount"));
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Amount must be positive"));
        }

        User user = userService.getUserByEmail(email);
        WalletBalance wallet = getOrCreate(user.getId());
        wallet.setBalance(wallet.getBalance().add(amount));
        wallet.setUpdatedAt(LocalDateTime.now());
        balanceRepo.save(wallet);

        String desc = body.containsKey("description")
                ? body.get("description").toString() : "Deposit";
        WalletTransaction tx = new WalletTransaction(user.getId(), "deposit", amount, desc);
        txRepo.save(tx);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("newBalance", wallet.getBalance());
        resp.put("transactionId", tx.getId());
        resp.put("type", "deposit");
        resp.put("amount", amount);
        return ResponseEntity.ok(resp);
    }

    // ── POST /api/wallet/withdraw ─────────────────────────────────────────────
    @PostMapping("/withdraw")
    public ResponseEntity<?> withdraw(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, Object> body) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        BigDecimal amount;
        try {
            amount = new BigDecimal(body.get("amount").toString()).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid amount"));
        }

        User user = userService.getUserByEmail(email);
        WalletBalance wallet = getOrCreate(user.getId());

        if (amount.compareTo(BigDecimal.ZERO) <= 0 ||
                amount.compareTo(wallet.getBalance()) > 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid withdrawal amount"));
        }

        wallet.setBalance(wallet.getBalance().subtract(amount));
        wallet.setUpdatedAt(LocalDateTime.now());
        balanceRepo.save(wallet);

        String desc = body.containsKey("description")
                ? body.get("description").toString() : "Withdrawal";
        WalletTransaction tx = new WalletTransaction(user.getId(), "withdrawal", amount, desc);
        txRepo.save(tx);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("newBalance", wallet.getBalance());
        resp.put("transactionId", tx.getId());
        resp.put("type", "withdrawal");
        resp.put("amount", amount);
        return ResponseEntity.ok(resp);
    }

    // ── GET /api/wallet/transactions ──────────────────────────────────────────
    @GetMapping("/transactions")
    public ResponseEntity<?> getTransactions(@AuthenticationPrincipal String email) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        List<WalletTransaction> txs = txRepo.findByUserIdOrderByCreatedAtDesc(user.getId());

        List<Map<String, Object>> result = new ArrayList<>();
        for (WalletTransaction tx : txs) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", tx.getId());
            m.put("type", tx.getType());
            m.put("amount", tx.getAmount());
            m.put("description", tx.getDescription());
            m.put("status", tx.getStatus());
            m.put("createdAt", tx.getCreatedAt().toString());
            result.add(m);
        }
        return ResponseEntity.ok(result);
    }
}