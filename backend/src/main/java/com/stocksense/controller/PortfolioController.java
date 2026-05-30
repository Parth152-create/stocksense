package com.stocksense.controller;

import com.stocksense.service.BenchmarkService;
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
    private final BenchmarkService benchmarkService;
    private final UserService      userService;

    public PortfolioController(PortfolioService portfolioService,
                               BenchmarkService benchmarkService,
                               UserService userService) {
        this.portfolioService = portfolioService;
        this.benchmarkService = benchmarkService;
        this.userService      = userService;
    }

    /**
     * GET /api/portfolio
     * GET /api/portfolio?market=US
     * GET /api/portfolio?market=IN
     * GET /api/portfolio?market=CRYPTO
     * GET /api/portfolio?market=FX
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

    /**
     * GET /api/portfolio/benchmark?range=1Y&market=US
     * GET /api/portfolio/benchmark?range=1Y&market=IN
     * GET /api/portfolio/benchmark?range=1M&market=CRYPTO
     *
     * Returns a merged time-series normalized to base 10 000:
     * [{ date, portfolio, portfolioRaw, benchmark, benchmarkLabel }]
     *
     * Used by the Analytics page benchmark comparison chart.
     * Both series start at 10 000 so relative performance is comparable
     * regardless of absolute portfolio value or index price.
     */
    @GetMapping("/benchmark")
    public ResponseEntity<?> getBenchmark(
            @AuthenticationPrincipal String email,
            @RequestParam(defaultValue = "1Y")  String range,
            @RequestParam(defaultValue = "US")  String market) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);

        // Get portfolio history first (same logic as /history)
        List<Map<String, Object>> portfolioHistory =
                portfolioService.getHistory(user.getId(), range);

        // Merge with benchmark index data
        List<Map<String, Object>> comparison =
                benchmarkService.getBenchmarkComparison(portfolioHistory, market, range);

        return ResponseEntity.ok(comparison);
    }
}