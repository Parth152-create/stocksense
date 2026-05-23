package com.stocksense.controller;

import com.stocksense.model.Order;
import com.stocksense.repository.OrderRepository;
import com.stocksense.service.AlphaVantageService;
import com.stocksense.service.PortfolioService;
import com.stocksense.service.UserService;
import com.stocksense.model.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final PortfolioService    portfolioService;
    private final UserService         userService;
    private final OrderRepository     orderRepository;
    private final AlphaVantageService alphaVantageService;

    public MarketController(PortfolioService portfolioService,
                            UserService userService,
                            OrderRepository orderRepository,
                            AlphaVantageService alphaVantageService) {
        this.portfolioService    = portfolioService;
        this.userService         = userService;
        this.orderRepository     = orderRepository;
        this.alphaVantageService = alphaVantageService;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/market/{marketId}/analytics
    //
    // Returns a full analytics payload for the given market (US/IN/CRYPTO/FX):
    //   totalValue, totalInvested, changePercent,
    //   allocation[], bestPerformer, worstPerformer, mostHeld,
    //   monthlyReturns[], riskScore
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/{marketId}/analytics")
    public ResponseEntity<?> getMarketAnalytics(
            @AuthenticationPrincipal String email,
            @PathVariable String marketId) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);
        UUID userId = user.getId();

        // Pull market-filtered summary from PortfolioService
        // (builds holdings, live prices, pnl, allocation, performers)
        Map<String, Object> summary = portfolioService.getSummaryByMarket(userId, marketId.toUpperCase());

        double totalValue    = toDouble(summary.get("totalValue"));
        double totalInvested = toDouble(summary.get("totalInvested"));
        double totalPnlPct   = toDouble(summary.get("totalPnlPct"));

        // Monthly returns — group FILLED/EXECUTED orders for this market by month
        List<Order> marketOrders = orderRepository
                .findByUserIdOrderByCreatedAtDesc(userId.toString())
                .stream()
                .filter(o -> marketId.equalsIgnoreCase(o.getMarket()))
                .filter(o -> "FILLED".equalsIgnoreCase(o.getStatus())
                          || "EXECUTED".equalsIgnoreCase(o.getStatus()))
                .collect(Collectors.toList());

        List<Map<String, Object>> monthlyReturns = buildMonthlyReturns(marketOrders, totalInvested);

        // Risk score — heuristic based on concentration + market type
        int riskScore = computeRiskScore(marketId, summary);

        // Assemble final response
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("market",          marketId.toUpperCase());
        response.put("totalValue",       totalValue);
        response.put("totalInvested",    totalInvested);
        response.put("changePercent",    round(totalPnlPct));
        response.put("allocation",       summary.getOrDefault("allocation",   List.of()));
        response.put("bestPerformer",    summary.getOrDefault("bestPerformer",  null));
        response.put("worstPerformer",   summary.getOrDefault("worstPerformer", null));
        response.put("mostHeld",         summary.getOrDefault("mostHeld",       null));
        response.put("monthlyReturns",   monthlyReturns);
        response.put("riskScore",        riskScore);

        return ResponseEntity.ok(response);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/market/{marketId}/quotes
    //
    // Returns live quotes for all symbols the user holds in this market.
    // Used by the dashboard transactions panel.
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/{marketId}/quotes")
    public ResponseEntity<?> getMarketQuotes(
            @AuthenticationPrincipal String email,
            @PathVariable String marketId) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);

        // Get distinct symbols held in this market
        List<Order> orders = orderRepository
                .findByUserIdOrderByCreatedAtDesc(user.getId().toString())
                .stream()
                .filter(o -> marketId.equalsIgnoreCase(o.getMarket()))
                .collect(Collectors.toList());

        Set<String> symbols = orders.stream()
                .map(Order::getSymbol)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<Map<String, Object>> quotes = new ArrayList<>();
        for (String symbol : symbols) {
            try {
                Map<String, Object> quote = alphaVantageService.getQuote(symbol);
                if (quote != null) {
                    Map<String, Object> q = new LinkedHashMap<>();
                    q.put("symbol",    symbol);
                    q.put("price",     toDouble(quote.get("price")));
                    q.put("changePct", toDouble(quote.getOrDefault("changePct", 0)));
                    q.put("change",    toDouble(quote.getOrDefault("change",    0)));
                    quotes.add(q);
                }
            } catch (Exception ignored) {
                // Non-fatal: skip symbols that fail to quote
            }
        }

        return ResponseEntity.ok(quotes);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Groups orders by calendar month and computes a simple return %
     * relative to running invested capital at that point.
     * Returns last 12 months max.
     */
    private List<Map<String, Object>> buildMonthlyReturns(
            List<Order> orders, double totalInvested) {

        // month key → net traded value (buys negative, sells positive = P&L proxy)
        Map<String, Double> monthlyPnl      = new LinkedHashMap<>();
        Map<String, Double> monthlyInvested = new LinkedHashMap<>();

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM");

        for (Order o : orders) {
            if (o.getCreatedAt() == null) continue;
            String month     = o.getCreatedAt().format(fmt);
            double total     = o.getTotal() != null ? o.getTotal().doubleValue() : 0;
            double qty       = o.getQuantity() != null ? o.getQuantity() : 0;
            double price     = o.getPrice()    != null ? o.getPrice().doubleValue() : 0;
            double cost      = qty * price;

            if (o.getType() == Order.OrderType.BUY) {
                monthlyInvested.merge(month, cost,  Double::sum);
                monthlyPnl.merge(month, -cost, Double::sum);
            } else {
                monthlyPnl.merge(month, total, Double::sum);
            }
        }

        // Build result — cap at last 12 months entries
        List<Map<String, Object>> result = new ArrayList<>();
        double runningBase = totalInvested > 0 ? totalInvested : 1;

        for (Map.Entry<String, Double> e : monthlyPnl.entrySet()) {
            double invested = monthlyInvested.getOrDefault(e.getKey(), 0.0);
            double base     = Math.max(runningBase, 1);
            double retPct   = (e.getValue() / base) * 100;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month",     e.getKey());
            row.put("returnPct", round(retPct));
            row.put("ret",       round(retPct));   // alias for frontend
            result.add(row);

            runningBase += invested;
        }

        // Return last 12 only
        int size = result.size();
        return size > 12 ? result.subList(size - 12, size) : result;
    }

    /**
     * Simple heuristic risk score 0–100.
     * Higher for CRYPTO/FX, lower for IN/US with many positions.
     */
    @SuppressWarnings("unchecked")
    private int computeRiskScore(String marketId, Map<String, Object> summary) {
        int base = switch (marketId.toUpperCase()) {
            case "CRYPTO" -> 72;
            case "FX"     -> 55;
            case "IN"     -> 42;
            default       -> 38; // US
        };

        // Concentration penalty: fewer positions = higher risk
        List<?> holdings = (List<?>) summary.getOrDefault("holdings", List.of());
        int positions = holdings.size();
        if      (positions <= 1) base = Math.min(base + 20, 99);
        else if (positions <= 3) base = Math.min(base + 10, 99);
        else if (positions >= 8) base = Math.max(base - 8,  10);

        return base;
    }

    private double toDouble(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(v.toString()); } catch (Exception e) { return 0; }
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}