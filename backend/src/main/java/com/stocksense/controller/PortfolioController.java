package com.stocksense.controller;

import com.stocksense.service.PortfolioService;
import com.stocksense.service.UserService;
import com.stocksense.model.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolio")
public class PortfolioController {

    private final PortfolioService portfolioService;
    private final UserService userService;

    public PortfolioController(PortfolioService portfolioService, UserService userService) {
        this.portfolioService = portfolioService;
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<?> getPortfolio(@AuthenticationPrincipal String email) {
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        User user = userService.getUserByEmail(email);
        List<Map<String, Object>> holdings = portfolioService.getHoldings(user.getId());
        return ResponseEntity.ok(holdings);
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getPortfolioSummary(@AuthenticationPrincipal String email) {
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        User user = userService.getUserByEmail(email);
        Map<String, Object> summary = portfolioService.getSummary(user.getId());
        return ResponseEntity.ok(summary);
    }
}