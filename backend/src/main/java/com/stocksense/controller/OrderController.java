package com.stocksense.controller;

import com.stocksense.model.Order;
import com.stocksense.model.Order.OrderType;
import com.stocksense.model.User;
import com.stocksense.model.WalletBalance;
import com.stocksense.model.WalletTransaction;
import com.stocksense.repository.OrderRepository;
import com.stocksense.repository.UserRepository;
import com.stocksense.repository.WalletBalanceRepository;
import com.stocksense.repository.WalletTransactionRepository;
import com.stocksense.service.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository          orderRepository;
    private final JwtService               jwtService;
    private final UserRepository           userRepository;
    private final WalletBalanceRepository  walletBalanceRepository;
    private final WalletTransactionRepository walletTxRepository;

    public OrderController(OrderRepository orderRepository,
                           JwtService jwtService,
                           UserRepository userRepository,
                           WalletBalanceRepository walletBalanceRepository,
                           WalletTransactionRepository walletTxRepository) {
        this.orderRepository         = orderRepository;
        this.jwtService              = jwtService;
        this.userRepository          = userRepository;
        this.walletBalanceRepository = walletBalanceRepository;
        this.walletTxRepository      = walletTxRepository;
    }

    // ── GET /api/orders ───────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<Order>> getOrders(
            @RequestHeader("Authorization") String authHeader) {
        String email = extractEmail(authHeader);
        User user = getUser(email);
        return ResponseEntity.ok(
            orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId().toString())
        );
    }

    // ── POST /api/orders ──────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> createOrder(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> body) {

        String email = extractEmail(authHeader);
        User user    = getUser(email);

        String symbol  = requireString(body, "symbol").toUpperCase();
        String market  = stringValue(body.getOrDefault("market", "US")).toUpperCase();
        String typeStr = requireString(body, "type").toUpperCase();

        // Frontend sends "qty"; also accept "quantity" as fallback
        Object qtyRaw = body.containsKey("qty") ? body.get("qty") : body.get("quantity");
        int qty        = parseQuantity(qtyRaw);

        BigDecimal price = parsePrice(body.get("price"));
        BigDecimal total = price.multiply(BigDecimal.valueOf(qty));

        OrderType orderType = parseOrderType(typeStr);

        // ── Wallet validation ─────────────────────────────────────────────────
        WalletBalance wallet = walletBalanceRepository
            .findByUserId(user.getId())
            .orElseGet(() -> {
                WalletBalance w = new WalletBalance(user.getId());
                return walletBalanceRepository.save(w);
            });

        if (orderType == OrderType.BUY) {
            // Check sufficient balance
            if (wallet.getBalance().compareTo(total) < 0) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Insufficient wallet balance",
                    "required", total,
                    "available", wallet.getBalance()
                ));
            }
            // Deduct from wallet
            wallet.setBalance(wallet.getBalance().subtract(total));
            wallet.setUpdatedAt(LocalDateTime.now());
            walletBalanceRepository.save(wallet);

            // Record wallet transaction
            walletTxRepository.save(new WalletTransaction(
                user.getId(), "withdrawal", total,
                "BUY " + qty + " x " + symbol + " @ " + price
            ));

        } else if (orderType == OrderType.SELL) {
            // Credit wallet on sell
            wallet.setBalance(wallet.getBalance().add(total));
            wallet.setUpdatedAt(LocalDateTime.now());
            walletBalanceRepository.save(wallet);

            // Record wallet transaction
            walletTxRepository.save(new WalletTransaction(
                user.getId(), "deposit", total,
                "SELL " + qty + " x " + symbol + " @ " + price
            ));
        }

        // ── Persist order ─────────────────────────────────────────────────────
        Order order = new Order();
        order.setUserId(user.getId().toString());
        order.setSymbol(symbol);
        order.setMarket(market);
        order.setType(orderType);
        order.setQuantity(qty);
        order.setPrice(price);
        order.setTotal(total);
        order.setStatus("EXECUTED");

        return ResponseEntity.ok(orderRepository.save(order));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractEmail(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(UNAUTHORIZED, "Missing bearer token");
        }
        String token = authHeader.substring(7).trim();
        if (token.isEmpty()) {
            throw new ResponseStatusException(UNAUTHORIZED, "Missing bearer token");
        }
        return jwtService.extractEmail(token);
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));
    }

    private String requireString(Map<String, Object> body, String field) {
        return stringValue(body.get(field));
    }

    private String stringValue(Object value) {
        if (!(value instanceof String text) || text.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order request");
        }
        return text.trim();
    }

    private int parseQuantity(Object value) {
        if (value == null) throw new ResponseStatusException(BAD_REQUEST, "Invalid order quantity");
        try {
            int quantity = Integer.parseInt(value.toString());
            if (quantity <= 0) throw new ResponseStatusException(BAD_REQUEST, "Order quantity must be positive");
            return quantity;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order quantity", ex);
        }
    }

    private BigDecimal parsePrice(Object value) {
        if (value == null) throw new ResponseStatusException(BAD_REQUEST, "Invalid order price");
        try {
            BigDecimal price = new BigDecimal(value.toString());
            if (price.signum() <= 0) throw new ResponseStatusException(BAD_REQUEST, "Order price must be positive");
            return price;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order price", ex);
        }
    }

    private OrderType parseOrderType(String type) {
        try {
            return OrderType.valueOf(type);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order type", ex);
        }
    }
}