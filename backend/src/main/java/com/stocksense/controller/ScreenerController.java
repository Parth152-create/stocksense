package com.stocksense.controller;

import com.stocksense.service.MarketSymbolService;
import com.stocksense.service.StockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/screener")
public class ScreenerController {

    private final MarketSymbolService marketSymbolService;
    private final StockService        stockService;

    public ScreenerController(MarketSymbolService marketSymbolService,
                               StockService stockService) {
        this.marketSymbolService = marketSymbolService;
        this.stockService        = stockService;
    }

    /**
     * GET /api/screener
     *
     * Query params:
     *   market    = US | IN | CRYPTO | FX   (default: US)
     *   sector    = Technology | Banking | ...  (optional, filter by sector)
     *   minChange = -10.0   (min % change, default -100)
     *   maxChange = 10.0    (max % change, default 100)
     *   minPrice  = 0.0     (min price)
     *   maxPrice  = 999999  (max price)
     *   sortBy    = price | changePct | volume | name  (default: changePct)
     *   sortDir   = asc | desc  (default: desc)
     *   limit     = 20      (max results, default 20, max 50)
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> screen(
            @RequestParam(defaultValue = "US")     String market,
            @RequestParam(required = false)        String sector,
            @RequestParam(defaultValue = "-100")   double minChange,
            @RequestParam(defaultValue = "100")    double maxChange,
            @RequestParam(defaultValue = "0")      double minPrice,
            @RequestParam(defaultValue = "999999") double maxPrice,
            @RequestParam(defaultValue = "changePct") String sortBy,
            @RequestParam(defaultValue = "desc")   String sortDir,
            @RequestParam(defaultValue = "20")     int limit) {

        // Cap limit to avoid hammering APIs
        int effectiveLimit = Math.min(limit, 50);

        // Get symbol list for market
        List<Map<String, String>> symbols = marketSymbolService.getSymbolsForMarket(market);

        // Filter by sector first (before fetching quotes — saves API calls)
        if (sector != null && !sector.isBlank()) {
            final String sectorUpper = sector.trim().toLowerCase();
            symbols = symbols.stream()
                    .filter(s -> s.getOrDefault("sector", "").toLowerCase().contains(sectorUpper))
                    .collect(Collectors.toList());
        }

        // Fetch quotes for filtered symbols (cap at 30 to avoid rate limits)
        List<Map<String, String>> toFetch = symbols.stream()
                .limit(Math.min(effectiveLimit * 2, 30))
                .collect(Collectors.toList());

        List<Map<String, Object>> results = new ArrayList<>();

        for (Map<String, String> sym : toFetch) {
            try {
                String symbol = sym.get("symbol");
                String name   = sym.getOrDefault("name", symbol);
                String sec    = sym.getOrDefault("sector", "—");

                Map<String, Object> quote = stockService.getQuote(symbol);
                if (quote == null || quote.isEmpty()) continue;

                double price     = toDouble(quote.get("price"));
                double changePct = toDouble(quote.getOrDefault("changePct",
                                   quote.getOrDefault("changePercent", 0)));
                double change    = toDouble(quote.get("change"));
                long   volume    = toLong(quote.get("volume"));

                // Apply filters
                if (price     < minPrice  || price     > maxPrice)  continue;
                if (changePct < minChange || changePct > maxChange)  continue;

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("symbol",    symbol);
                row.put("name",      name);
                row.put("sector",    sec);
                row.put("market",    market.toUpperCase());
                row.put("price",     round(price));
                row.put("change",    round(change));
                row.put("changePct", round(changePct));
                row.put("volume",    volume);
                row.put("currency",  quote.getOrDefault("currency", market.equals("IN") ? "INR" : "USD"));
                row.put("exchange",  quote.getOrDefault("exchange", "—"));
                results.add(row);

            } catch (Exception ignored) {
                // Skip symbols that fail to quote
            }
        }

        // Sort
        Comparator<Map<String, Object>> comparator = switch (sortBy.toLowerCase()) {
            case "price"     -> Comparator.comparingDouble(r -> toDouble(r.get("price")));
            case "volume"    -> Comparator.comparingLong(r  -> toLong(r.get("volume")));
            case "name"      -> Comparator.comparing(r      -> String.valueOf(r.get("name")));
            default          -> Comparator.comparingDouble(r -> toDouble(r.get("changePct")));
        };

        if ("desc".equalsIgnoreCase(sortDir)) comparator = comparator.reversed();
        results.sort(comparator);

        // Cap final results
        List<Map<String, Object>> finalResults = results.stream()
                .limit(effectiveLimit)
                .collect(Collectors.toList());

        // Collect available sectors for this market (for filter UI)
        List<String> sectors = symbols.stream()
                .map(s -> s.getOrDefault("sector", ""))
                .filter(s -> !s.isBlank())
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("market",  market.toUpperCase());
        response.put("results", finalResults);
        response.put("count",   finalResults.size());
        response.put("sectors", sectors);

        return ResponseEntity.ok(response);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private double toDouble(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(v.toString()); } catch (Exception e) { return 0; }
    }

    private long toLong(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return 0; }
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}

