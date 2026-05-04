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

    /**
     * Resolves the correct symbol for Yahoo Finance / Alpha Vantage:
     *   market=IN + no dot suffix  →  append .BSE
     *   e.g.  RELIANCE → RELIANCE.BSE,  TCS → TCS.BSE
     *   Everything else passes through unchanged.
     */
    private String resolveSymbol(String symbol, String market) {
        if (symbol == null) return null;
        String s = symbol.trim().toUpperCase();
        if ("IN".equalsIgnoreCase(market) && !s.contains(".")) {
            return s + ".BSE";
        }
        return s;
    }

    // ── GET /api/stocks/{symbol}?market=IN — single quote ────────────────────
    @GetMapping("/stocks/{symbol}")
    public ResponseEntity<Map<String, Object>> getQuote(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {
        return ResponseEntity.ok(alphaVantage.getQuote(resolveSymbol(symbol, market)));
    }

    // ── GET /api/stocks/{symbol}/history?market=IN — OHLCV candles ───────────
    @GetMapping("/stocks/{symbol}/history")
    public ResponseEntity<Map<String, Object>> getHistory(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {
        return ResponseEntity.ok(alphaVantage.getDailyHistory(resolveSymbol(symbol, market)));
    }

    // ── GET /api/stocks/search?q=apple — symbol search ───────────────────────
    @GetMapping("/stocks/search")
    public ResponseEntity<List<Map<String, Object>>> search(@RequestParam String q) {
        return ResponseEntity.ok(alphaVantage.search(q));
    }

    // ── GET /api/market/{marketId}/symbols — symbol list for market ───────────
    @GetMapping("/market/{marketId}/symbols")
    public ResponseEntity<List<Map<String, String>>> getMarketSymbols(@PathVariable String marketId) {
        return ResponseEntity.ok(marketSymbols.getSymbolsForMarket(marketId));
    }

    // ── GET /api/market/{marketId}/quotes — paginated live quotes ────────────
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
}