package com.stocksense.controller;

import com.stocksense.service.StockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stocks")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    // GET /api/stocks/quote/{symbol}
    // Returns real-time quote from Yahoo Finance → Alpha Vantage fallback
    @GetMapping("/quote/{symbol}")
    public ResponseEntity<Map<String, Object>> getQuote(@PathVariable String symbol) {
        Map<String, Object> quote = stockService.getQuote(symbol);
        if (quote.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(quote);
    }

    // GET /api/stocks/history/{symbol}?range=1y&interval=1d
    @GetMapping("/history/{symbol}")
    public ResponseEntity<List<Map<String, Object>>> getHistory(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1y") String range,
            @RequestParam(defaultValue = "1d") String interval
    ) {
        List<Map<String, Object>> history = stockService.getHistory(symbol, range, interval);
        return ResponseEntity.ok(history);
    }

    // GET /api/stocks/market?market=US
    @GetMapping("/market")
    public ResponseEntity<List<Map<String, Object>>> getMarketOverview(
            @RequestParam(defaultValue = "US") String market
    ) {
        return ResponseEntity.ok(stockService.getMarketOverview(market));
    }

    // GET /api/stocks/crypto?limit=10
    @GetMapping("/crypto")
    public ResponseEntity<List<Map<String, Object>>> getCrypto(
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(stockService.getTopCrypto(Math.min(limit, 50)));
    }

    // GET /api/stocks/crypto/{coinId}  e.g. bitcoin, ethereum
    @GetMapping("/crypto/{coinId}")
    public ResponseEntity<Map<String, Object>> getCryptoQuote(@PathVariable String coinId) {
        Map<String, Object> quote = stockService.getCryptoQuote(coinId);
        if (quote.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(quote);
    }

    // GET /api/stocks/search?q=apple
    @GetMapping("/search")
    public ResponseEntity<List<Map<String, Object>>> search(@RequestParam String q) {
        return ResponseEntity.ok(stockService.searchSymbol(q));
    }

    // GET /api/stocks/cache/stats  (debug endpoint)
    @GetMapping("/cache/stats")
    public ResponseEntity<Map<String, Long>> getCacheStats() {
        return ResponseEntity.ok(stockService.getCacheStats());
    }
}