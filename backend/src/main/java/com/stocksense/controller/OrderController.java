package com.stocksense.controller;

import com.stocksense.model.Order;
import com.stocksense.model.Order.OrderType;
import com.stocksense.model.Order.OrderKind;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository             orderRepository;
    private final JwtService                  jwtService;
    private final UserRepository              userRepository;
    private final WalletBalanceRepository     walletBalanceRepository;
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
        User user    = getUser(email);
        return ResponseEntity.ok(
            orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId().toString())
        );
    }

    // ── GET /api/orders/paginated ─────────────────────────────────────────────
    @GetMapping("/paginated")
    public ResponseEntity<Map<String, Object>> getOrdersPaginated(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        String email = extractEmail(authHeader);
        User user    = getUser(email);

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Order> result = orderRepository.findByUserId(user.getId().toString(), pageable);

        return ResponseEntity.ok(Map.of(
            "orders",      result.getContent(),
            "totalOrders", result.getTotalElements(),
            "totalPages",  result.getTotalPages(),
            "currentPage", result.getNumber(),
            "hasMore",     !result.isLast()
        ));
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
        String kindStr = body.containsKey("kind")
            ? body.get("kind").toString().toUpperCase()
            : "MARKET";

        Object qtyRaw = body.containsKey("qty") ? body.get("qty") : body.get("quantity");
        int qty        = parseQuantity(qtyRaw);

        BigDecimal price     = parsePrice(body.get("price"));
        BigDecimal total     = price.multiply(BigDecimal.valueOf(qty));
        OrderType  orderType = parseOrderType(typeStr);
        OrderKind  orderKind = parseOrderKind(kindStr);

        // Parse limitPrice for LIMIT / STOP_LOSS orders
        BigDecimal limitPrice = null;
        if (orderKind != OrderKind.MARKET) {
            if (!body.containsKey("limitPrice")) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "limitPrice is required for " + orderKind + " orders"
                ));
            }
            limitPrice = parsePrice(body.get("limitPrice"));
        }

        WalletBalance wallet = walletBalanceRepository
            .findByUserId(user.getId())
            .orElseGet(() -> walletBalanceRepository.save(new WalletBalance(user.getId())));

        // BUY orders — deduct or reserve funds upfront
        if (orderType == OrderType.BUY) {
            if (wallet.getBalance().compareTo(total) < 0) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error",     "Insufficient wallet balance",
                    "required",  total,
                    "available", wallet.getBalance()
                ));
            }
            wallet.setBalance(wallet.getBalance().subtract(total));
            wallet.setUpdatedAt(LocalDateTime.now());
            walletBalanceRepository.save(wallet);

            walletTxRepository.save(new WalletTransaction(
                user.getId(), "withdrawal", total,
                (orderKind == OrderKind.MARKET ? "BUY " : orderKind + " BUY reserved: ")
                    + qty + " x " + symbol + " @ " + price
            ));

        } else if (orderType == OrderType.SELL && orderKind == OrderKind.MARKET) {
            // MARKET SELL — credit immediately
            wallet.setBalance(wallet.getBalance().add(total));
            wallet.setUpdatedAt(LocalDateTime.now());
            walletBalanceRepository.save(wallet);

            walletTxRepository.save(new WalletTransaction(
                user.getId(), "deposit", total,
                "SELL " + qty + " x " + symbol + " @ " + price
            ));
            // LIMIT/STOP_LOSS SELL — credit happens when scheduler executes
        }

        Order order = new Order();
        order.setUserId(user.getId().toString());
        order.setSymbol(symbol);
        order.setMarket(market);
        order.setType(orderType);
        order.setKind(orderKind);
        order.setQuantity(qty);
        order.setPrice(price);
        order.setTotal(total);
        order.setLimitPrice(limitPrice);
        order.setStatus(orderKind == OrderKind.MARKET ? "EXECUTED" : "PENDING");

        return ResponseEntity.ok(orderRepository.save(order));
    }

    // ── DELETE /api/orders/{id} — cancel + refund ─────────────────────────────
    //
    // Rules:
    //   - Only PENDING orders can be cancelled (EXECUTED/CANCELLED → 409)
    //   - Only the order owner can cancel (ownership mismatch → 403)
    //   - LIMIT BUY / STOP_LOSS BUY → refund the reserved total back to wallet
    //   - LIMIT SELL / STOP_LOSS SELL → no wallet change (funds were never reserved)
    //   - MARKET orders are EXECUTED immediately, never reach here as PENDING
    // ─────────────────────────────────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelOrder(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long id) {

        String email = extractEmail(authHeader);
        User   user  = getUser(email);

        // 1. Find the order
        Order order = orderRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Order not found"));

        // 2. Ownership check
        if (!order.getUserId().equals(user.getId().toString())) {
            throw new ResponseStatusException(FORBIDDEN, "You do not own this order");
        }

        // 3. Only PENDING orders can be cancelled
        if (!"PENDING".equals(order.getStatus())) {
            return ResponseEntity.status(CONFLICT).body(Map.of(
                "error",  "Only PENDING orders can be cancelled",
                "status", order.getStatus()
            ));
        }

        // 4. Refund if it was a BUY (funds were reserved upfront)
        if (order.getType() == OrderType.BUY) {
            BigDecimal refundAmount = order.getTotal();

            WalletBalance wallet = walletBalanceRepository
                .findByUserId(user.getId())
                .orElseGet(() -> walletBalanceRepository.save(new WalletBalance(user.getId())));

            wallet.setBalance(wallet.getBalance().add(refundAmount));
            wallet.setUpdatedAt(LocalDateTime.now());
            walletBalanceRepository.save(wallet);

            // Record the refund as a wallet transaction
            walletTxRepository.save(new WalletTransaction(
                user.getId(),
                "deposit",
                refundAmount,
                "Refund: cancelled " + order.getKind() + " BUY "
                    + order.getQuantity() + " x " + order.getSymbol()
                    + " @ " + order.getPrice()
            ));
        }
        // LIMIT/STOP_LOSS SELL — no refund needed, funds were never deducted

        // 5. Mark order as CANCELLED
        order.setStatus("CANCELLED");
        orderRepository.save(order);

        return ResponseEntity.ok(Map.of(
            "success",  true,
            "orderId",  id,
            "status",   "CANCELLED",
            "refunded", order.getType() == OrderType.BUY,
            "amount",   order.getType() == OrderType.BUY ? order.getTotal() : BigDecimal.ZERO
        ));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractEmail(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer "))
            throw new ResponseStatusException(UNAUTHORIZED, "Missing bearer token");
        String token = authHeader.substring(7).trim();
        if (token.isEmpty())
            throw new ResponseStatusException(UNAUTHORIZED, "Missing bearer token");
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
        if (!(value instanceof String text) || text.isBlank())
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order request");
        return text.trim();
    }

    private int parseQuantity(Object value) {
        if (value == null) throw new ResponseStatusException(BAD_REQUEST, "Invalid order quantity");
        try {
            int q = Integer.parseInt(value.toString());
            if (q <= 0) throw new ResponseStatusException(BAD_REQUEST, "Quantity must be positive");
            return q;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order quantity", ex);
        }
    }

    private BigDecimal parsePrice(Object value) {
        if (value == null) throw new ResponseStatusException(BAD_REQUEST, "Invalid price");
        try {
            BigDecimal p = new BigDecimal(value.toString());
            if (p.signum() <= 0) throw new ResponseStatusException(BAD_REQUEST, "Price must be positive");
            return p;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid price", ex);
        }
    }

    private OrderType parseOrderType(String type) {
        try { return OrderType.valueOf(type); }
        catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order type", ex);
        }
    }

    private OrderKind parseOrderKind(String kind) {
        try { return OrderKind.valueOf(kind); }
        catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order kind", ex);
        }
    }
}