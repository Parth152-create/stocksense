package com.stocksense.controller;

import com.stocksense.model.Order;
import com.stocksense.model.Order.OrderType;
import com.stocksense.model.User;
import com.stocksense.repository.OrderRepository;
import com.stocksense.repository.UserRepository;
import com.stocksense.service.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public OrderController(OrderRepository orderRepository,
                           JwtService jwtService,
                           UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    // GET /api/orders - all orders for current user
    @GetMapping
    public ResponseEntity<List<Order>> getOrders(
            @RequestHeader("Authorization") String authHeader) {
        String email = extractEmail(authHeader);
        User user = getUser(email);
        return ResponseEntity.ok(
            orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId().toString())
        );
    }

    // POST /api/orders - place a new order
    @PostMapping
    public ResponseEntity<Order> createOrder(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> body) {

        String email = extractEmail(authHeader);
        User user = getUser(email);

        String symbol = requireString(body, "symbol").toUpperCase();
        String market = stringValue(body.getOrDefault("market", "US")).toUpperCase();
        String typeStr = requireString(body, "type").toUpperCase();

        // Frontend sends "qty"; also accept "quantity" as fallback.
        Object qtyRaw = body.containsKey("qty") ? body.get("qty") : body.get("quantity");
        int qty = parseQuantity(qtyRaw);

        BigDecimal price = parsePrice(body.get("price"));
        BigDecimal total = price.multiply(BigDecimal.valueOf(qty));

        Order order = new Order();
        order.setUserId(user.getId().toString());
        order.setSymbol(symbol);
        order.setMarket(market);
        order.setType(parseOrderType(typeStr));
        order.setQuantity(qty);
        order.setPrice(price);
        order.setTotal(total);
        order.setStatus("EXECUTED");
        // createdAt set by @PrePersist

        return ResponseEntity.ok(orderRepository.save(order));
    }

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
        if (value == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order quantity");
        }
        try {
            int quantity = Integer.parseInt(value.toString());
            if (quantity <= 0) {
                throw new ResponseStatusException(BAD_REQUEST, "Order quantity must be positive");
            }
            return quantity;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order quantity", ex);
        }
    }

    private BigDecimal parsePrice(Object value) {
        if (value == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid order price");
        }
        try {
            BigDecimal price = new BigDecimal(value.toString());
            if (price.signum() <= 0) {
                throw new ResponseStatusException(BAD_REQUEST, "Order price must be positive");
            }
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
