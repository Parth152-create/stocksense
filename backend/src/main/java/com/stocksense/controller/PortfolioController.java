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
    private final UserService      userService;

    public PortfolioController(PortfolioService portfolioService,
                               UserService userService) {
        this.portfolioService = portfolioService;
        this.userService      = userService;
    }

    /**
     * GET /api/portfolio
     * GET /api/portfolio?market=US
     * GET /api/portfolio?market=IN
     * GET /api/portfolio?market=CRYPTO
     * GET /api/portfolio?market=FX
     *
     * Returns a flat list of current holdings.
     * When ?market= is supplied, only holdings for that asset class are returned.
     */
    @GetMapping
    public ResponseEntity<?> getPortfolio(
            @AuthenticationPrincipal String email,
            @RequestParam(required = false) String market) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);

        List<Map<String, Object>> holdings = market != null
                ? portfolioService.getHoldingsByMarket(user.getId(), market)
                : portfolioService.getHoldings(user.getId());

        return ResponseEntity.ok(holdings);
    }

    /**
     * GET /api/portfolio/summary
     * GET /api/portfolio/summary?market=US
     *
     * Returns aggregated summary: totalValue, totalInvested, totalPnl,
     * totalPnlPct, changePercent, allocation[], bestPerformer,
     * worstPerformer, mostHeld, and the full holdings list.
     */
    @GetMapping("/summary")
    public ResponseEntity<?> getPortfolioSummary(
            @AuthenticationPrincipal String email,
            @RequestParam(required = false) String market) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);

        Map<String, Object> summary = market != null
                ? portfolioService.getSummaryByMarket(user.getId(), market)
                : portfolioService.getSummary(user.getId());

        return ResponseEntity.ok(summary);
    }

    /**
     * GET /api/portfolio/history?range=1M   (default)
     * GET /api/portfolio/history?range=1Y
     * GET /api/portfolio/history?range=All
     *
     * Returns a time-series list of { date, value } points
     * representing portfolio value over the requested range.
     * Used by the Analytics page "Portfolio Value Over Time" chart.
     */
    @GetMapping("/history")
    public ResponseEntity<?> getPortfolioHistory(
            @AuthenticationPrincipal String email,
            @RequestParam(defaultValue = "1M") String range) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);

        return ResponseEntity.ok(portfolioService.getHistory(user.getId(), range));
    }
}