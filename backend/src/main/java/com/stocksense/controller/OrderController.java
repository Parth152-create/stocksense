package com.stocksense.controller;

import com.stocksense.model.Order;
import com.stocksense.model.Order.OrderType;
import com.stocksense.model.User;
import com.stocksense.repository.OrderRepository;
import com.stocksense.repository.UserRepository;
import com.stocksense.service.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

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

    @GetMapping
    public ResponseEntity<List<Order>> getOrders(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.substring(7);
        String email = jwtService.extractEmail(token);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId().toString()));
    }

    @PostMapping
    public ResponseEntity<Order> createOrder(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> body) {
        String token = authHeader.substring(7);
        String email = jwtService.extractEmail(token);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        String userId = user.getId().toString();

        Order order = new Order();
        order.setUserId(userId);
        order.setSymbol((String) body.get("symbol"));
        order.setMarket((String) body.getOrDefault("market", "US"));
        order.setType(OrderType.valueOf(((String) body.get("type")).toUpperCase()));
        order.setQuantity(Integer.parseInt(body.get("quantity").toString()));
        order.setPrice(new BigDecimal(body.get("price").toString()));
        order.setTotal(order.getPrice().multiply(BigDecimal.valueOf(order.getQuantity())));
        order.setCreatedAt(LocalDateTime.now());
        order.setStatus("EXECUTED");

        return ResponseEntity.ok(orderRepository.save(order));
    }
}