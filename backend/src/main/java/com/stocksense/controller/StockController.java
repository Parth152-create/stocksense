package com.stocksense.controller;

import com.stocksense.service.AlphaVantageService;
import com.stocksense.service.MarketSymbolService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class StockController {

    private final AlphaVantageService alphaVantage;
    private final MarketSymbolService marketSymbols;

    public StockController(AlphaVantageService alphaVantage, MarketSymbolService marketSymbols) {
        this.alphaVantage = alphaVantage;
        this.marketSymbols = marketSymbols;
    }

    private String resolveSymbol(String symbol, String market) {
        if (symbol == null) return null;
        String s = symbol.trim().toUpperCase();
        // Strip .BSE suffix before passing to Alpha Vantage — it uses plain symbols
        s = s.replace(".BSE", "").replace(".NSE", "");
        if ("IN".equalsIgnoreCase(market) && !s.contains(".")) {
            return s + ".BSE";
        }
        return s;
    }

    // ── GET /api/stocks/{symbol} — single quote ───────────────────────────────
    @GetMapping("/stocks/{symbol}")
    public ResponseEntity<Map<String, Object>> getQuote(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {
        return ResponseEntity.ok(alphaVantage.getQuote(resolveSymbol(symbol, market)));
    }

    // ── GET /api/stocks/{symbol}/overview — company overview ─────────────────
    /**
     * Called by the stock page to show name, sector, market cap, P/E, EPS etc.
     * Pulls from Alpha Vantage OVERVIEW function and maps to the StockOverview shape.
     */
    @GetMapping("/stocks/{symbol}/overview")
    public ResponseEntity<Map<String, Object>> getOverview(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {

        String resolved = resolveSymbol(symbol, market);
        Map<String, Object> raw = alphaVantage.getOverview(resolved);

        if (raw == null || raw.isEmpty() || raw.containsKey("error")) {
            return ResponseEntity.notFound().build();
        }

        // Map Alpha Vantage field names → frontend StockOverview shape
        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("symbol",        resolved);
        overview.put("name",          raw.getOrDefault("Name", resolved));
        overview.put("exchange",      raw.getOrDefault("Exchange", "—"));
        overview.put("sector",        raw.getOrDefault("Sector", "—"));
        overview.put("industry",      raw.getOrDefault("Industry", "—"));
        overview.put("description",   raw.getOrDefault("Description", ""));
        overview.put("marketCap",     parseDouble(raw.get("MarketCapitalization")));
        overview.put("peRatio",       parseDouble(raw.get("PERatio")));
        overview.put("eps",           parseDouble(raw.get("EPS")));
        overview.put("dividendYield", parseDouble(raw.get("DividendYield")));
        overview.put("week52High",    parseDouble(raw.get("52WeekHigh")));
        overview.put("week52Low",     parseDouble(raw.get("52WeekLow")));

        return ResponseEntity.ok(overview);
    }

    // ── GET /api/stocks/{symbol}/ratings — analyst ratings ───────────────────
    /**
     * Returns mock analyst consensus data.
     * Replace with a real data source (e.g. Financial Modeling Prep) if needed.
     */
    @GetMapping("/stocks/{symbol}/ratings")
    public ResponseEntity<Map<String, Object>> getRatings(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {

        // Deterministic mock based on symbol hash so it's consistent per symbol
        int hash = Math.abs(symbol.hashCode());
        int strongBuy  = 5  + (hash % 10);
        int buy        = 8  + (hash % 8);
        int hold       = 4  + (hash % 6);
        int sell       = 1  + (hash % 4);
        int strongSell = hash % 3;

        // Get current price from Alpha Vantage for a realistic target
        Map<String, Object> quote = alphaVantage.getQuote(resolveSymbol(symbol, market));
        double currentPrice = parseDouble(quote.get("price"));
        double targetPrice  = currentPrice > 0 ? currentPrice * (1.05 + (hash % 20) / 100.0) : 150.0;

        Map<String, Object> ratings = new LinkedHashMap<>();
        ratings.put("strongBuy",   strongBuy);
        ratings.put("buy",         buy);
        ratings.put("hold",        hold);
        ratings.put("sell",        sell);
        ratings.put("strongSell",  strongSell);
        ratings.put("targetPrice", Math.round(targetPrice * 100.0) / 100.0);

        return ResponseEntity.ok(ratings);
    }

    // ── GET /api/stocks/{symbol}/insights — AI insights ──────────────────────
    /**
     * Returns mock AI insights. Wire to your ML FastAPI service at port 8082
     * if you have it running, or return static data for now.
     */
    @GetMapping("/stocks/{symbol}/insights")
    public ResponseEntity<List<Map<String, Object>>> getInsights(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {

        String clean = symbol.replace(".BSE", "").replace(".NSE", "").toUpperCase();

        List<Map<String, Object>> insights = List.of(
            Map.of(
                "id",          "1",
                "type",        "BULLISH",
                "title",       clean + " shows strong momentum",
                "body",        "Technical indicators suggest bullish continuation with RSI above 60 and MACD crossover.",
                "source",      "StockSense AI",
                "publishedAt", new java.util.Date().toString()
            ),
            Map.of(
                "id",          "2",
                "type",        "NEUTRAL",
                "title",       "Earnings report due next quarter",
                "body",        "Analysts expect moderate growth. Watch for guidance revision at the upcoming earnings call.",
                "source",      "StockSense AI",
                "publishedAt", new java.util.Date().toString()
            )
        );

        return ResponseEntity.ok(insights);
    }

    // ── GET /api/stocks/{symbol}/history — OHLCV candles ─────────────────────
    @GetMapping("/stocks/{symbol}/history")
    public ResponseEntity<Map<String, Object>> getHistory(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {
        return ResponseEntity.ok(alphaVantage.getDailyHistory(resolveSymbol(symbol, market)));
    }

    // ── GET /api/stocks/search?q=apple ───────────────────────────────────────
    @GetMapping("/stocks/search")
    public ResponseEntity<List<Map<String, Object>>> search(@RequestParam String q) {
        return ResponseEntity.ok(alphaVantage.search(q));
    }

    // ── GET /api/market/{marketId}/symbols ────────────────────────────────────
    @GetMapping("/market/{marketId}/symbols")
    public ResponseEntity<List<Map<String, String>>> getMarketSymbols(@PathVariable String marketId) {
        return ResponseEntity.ok(marketSymbols.getSymbolsForMarket(marketId));
    }

    // ── GET /api/market/{marketId}/quotes ─────────────────────────────────────
    @GetMapping("/market/{marketId}/quotes")
    public ResponseEntity<Map<String, Object>> getMarketQuotes(
            @PathVariable String marketId,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size) {

        List<Map<String, String>> allSymbols = marketSymbols.getSymbolsForMarket(marketId);
        int total = allSymbols.size();
        int from  = Math.min(page * size, total);
        int to    = Math.min(from + size, total);
        List<Map<String, String>> pageSymbols = allSymbols.subList(from, to);

        List<String> symbolStrings = pageSymbols.stream()
                .map(s -> s.get("symbol")).toList();

        List<Map<String, Object>> quotes = alphaVantage.getBatchQuotes(symbolStrings);

        List<Map<String, Object>> enriched = new ArrayList<>();
        for (int i = 0; i < pageSymbols.size(); i++) {
            Map<String, Object> merged = new LinkedHashMap<>();
            merged.putAll(pageSymbols.get(i));
            if (i < quotes.size()) merged.putAll(quotes.get(i));
            enriched.add(merged);
        }

        return ResponseEntity.ok(Map.of(
            "market",     marketId,
            "page",       page,
            "size",       size,
            "total",      total,
            "totalPages", (int) Math.ceil((double) total / size),
            "stocks",     enriched
        ));
    }

    // ── GET /api/market/{marketId}/analytics ──────────────────────────────────
    @GetMapping("/market/{marketId}/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics(@PathVariable String marketId) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("market",        marketId);
        data.put("totalValue",    switch (marketId) { case "IN" -> 9331456; case "US" -> 530056; default -> 120000; });
        data.put("changePercent", switch (marketId) { case "IN" -> 6.42;    case "US" -> 4.75;   default -> 2.1; });
        data.put("changeAmount",  switch (marketId) { case "IN" -> 562100;  case "US" -> 24000;  default -> 2520; });
        data.put("riskScore",     switch (marketId) { case "IN" -> 76;      case "US" -> 58;     default -> 82; });
        data.put("allocation",    switch (marketId) {
            case "IN" -> Map.of("stocks", 62, "funds", 28, "other", 10);
            case "US" -> Map.of("stocks", 48, "crypto", 30, "funds", 22);
            default   -> Map.of("crypto", 70, "stablecoins", 20, "defi", 10);
        });
        return ResponseEntity.ok(data);
    }

    // ── Helper ────────────────────────────────────────────────────────────────
    private double parseDouble(Object val) {
        if (val == null) return 0.0;
        try { return Double.parseDouble(val.toString()); }
        catch (NumberFormatException e) { return 0.0; }
    }
}