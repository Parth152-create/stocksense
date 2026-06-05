package com.stocksense.controller;

import com.stocksense.service.PortfolioService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * WidgetController
 *
 * Provides a minimal, widget-optimised portfolio summary endpoint.
 * Called by the PWA service worker to populate the home screen widget.
 *
 * GET /api/widget/portfolio
 *   - Auth: JWT via @AuthenticationPrincipal (same as all other controllers)
 *   - Returns only the fields the Adaptive Card template needs
 *   - Returns zeros with currency if user has no holdings (never 4xx for widget)
 *   - Intentionally lightweight — no holdings list, no allocation breakdown
 */
@RestController
@RequestMapping("/api/widget")
public class WidgetController {

    private final PortfolioService portfolioService;
    private final com.stocksense.service.UserService userService;

    public WidgetController(PortfolioService portfolioService,
                            com.stocksense.service.UserService userService) {
        this.portfolioService = portfolioService;
        this.userService      = userService;
    }

    @GetMapping("/portfolio")
    public ResponseEntity<?> getPortfolioWidget(
            @AuthenticationPrincipal String email) {

        // Unauthenticated — return empty payload so widget shows "—" gracefully
        if (email == null) {
            return ResponseEntity.ok(emptyPayload("$"));
        }

        try {
            com.stocksense.model.User user = userService.getUserByEmail(email);
            Map<String, Object> summary    = portfolioService.getSummary(user.getId());

            double totalValue = toDouble(summary.get("totalValue"));
            double totalCost  = toDouble(summary.getOrDefault("totalInvested",
                                         summary.get("totalCost")));
            double totalPnl   = toDouble(summary.get("totalPnl"));
            double totalPnlPct= toDouble(summary.get("totalPnlPct"));

            @SuppressWarnings("unchecked")
            List<?> holdings  = (List<?>) summary.getOrDefault("holdings", List.of());

            // Determine currency from market (rough heuristic on first holding symbol)
            String currency = "$";
            if (!holdings.isEmpty()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> first = (Map<String, Object>) holdings.get(0);
                String sym = String.valueOf(first.getOrDefault("symbol", ""));
                if (sym.endsWith(".NS") || sym.endsWith(".BSE")) currency = "₹";
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("totalValue",    round(totalValue));
            payload.put("totalPnl",      round(totalPnl));
            payload.put("totalPnlPct",   round(totalPnlPct));
            payload.put("totalInvested", round(totalCost));
            payload.put("positions",     holdings.size());
            payload.put("currency",      currency);

            return ResponseEntity.ok(payload);

        } catch (Exception e) {
            // Never let widget errors surface as 5xx — return empty payload
            return ResponseEntity.ok(emptyPayload("$"));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> emptyPayload(String currency) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("totalValue",    0.0);
        p.put("totalPnl",      0.0);
        p.put("totalPnlPct",   0.0);
        p.put("totalInvested", 0.0);
        p.put("positions",     0);
        p.put("currency",      currency);
        return p;
    }

    private double toDouble(Object value) {
        if (value instanceof Number) return ((Number) value).doubleValue();
        if (value == null) return 0.0;
        try { return Double.parseDouble(value.toString()); }
        catch (NumberFormatException e) { return 0.0; }
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}