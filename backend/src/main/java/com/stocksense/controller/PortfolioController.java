package com.stocksense.controller;

import com.stocksense.service.PortfolioService;
import com.stocksense.service.UserService;
import com.stocksense.model.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
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

    /**
     * GET /api/portfolio
     * Returns holdings calculated from the orders table, enriched with current prices.
     * Shape: [{ symbol, name, qty, avgPrice, currentPrice, marketValue, pnl, pnlPct }]
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getPortfolio(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getUserByEmail(userDetails.getUsername());
        List<Map<String, Object>> holdings = portfolioService.getHoldings(user.getId());
        return ResponseEntity.ok(holdings);
    }

    /**
     * GET /api/portfolio/summary
     * Returns aggregate portfolio stats.
     * Shape: { totalValue, totalCost, totalPnl, totalPnlPct }
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getPortfolioSummary(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.getUserByEmail(userDetails.getUsername());
        Map<String, Object> summary = portfolioService.getSummary(user.getId());
        return ResponseEntity.ok(summary);
    }
}
