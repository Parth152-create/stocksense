package com.stocksense.service;

import com.stocksense.dto.StockResponseDTO;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class StockService {

    private final RestTemplate restTemplate;

    // ⚠️ Replace with your new Alpha Vantage key
    private static final String API_KEY = "YOUR_NEW_API_KEY";
    private static final long CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    private record CacheEntry(StockResponseDTO data, long fetchedAt) {}
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public StockService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public StockResponseDTO getStock(String symbol) {
        // Return cached value if still fresh
        CacheEntry cached = cache.get(symbol);
        if (cached != null && System.currentTimeMillis() - cached.fetchedAt() < CACHE_TTL_MS) {
            System.out.println("Cache HIT for " + symbol);
            return cached.data();
        }

        System.out.println("Cache MISS for " + symbol + " — calling Alpha Vantage");
        String resolvedSymbol = resolveSymbol(symbol);
        String url = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol="
                + resolvedSymbol + "&apikey=" + API_KEY;

        try {
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) throw new RuntimeException("Null response");

            Map<String, String> quote = (Map<String, String>) response.get("Global Quote");
            if (quote == null || quote.isEmpty())
                throw new RuntimeException("No data for: " + resolvedSymbol);

            double price         = Double.parseDouble(quote.get("05. price"));
            double change        = Double.parseDouble(quote.get("09. change"));
            double changePercent = Double.parseDouble(
                    quote.get("10. change percent").replace("%", ""));

            StockResponseDTO dto = new StockResponseDTO(symbol, price, change, changePercent);
            cache.put(symbol, new CacheEntry(dto, System.currentTimeMillis()));
            return dto;

        } catch (Exception e) {
            System.err.println("StockService error for " + symbol + ": " + e.getMessage());
            // Serve stale cache rather than zeros if available
            if (cached != null) {
                System.out.println("Returning stale cache for " + symbol);
                return cached.data();
            }
            return new StockResponseDTO(symbol, 0.0, 0.0, 0.0);
        }
    }

    public double getLivePrice(String symbol) {
        return getStock(symbol).getPrice();
    }

    private String resolveSymbol(String symbol) {
        return switch (symbol.toUpperCase()) {
            case "RELIANCE"    -> "RELIANCE.BSE";
            case "TCS"         -> "TCS.BSE";
            case "INFY"        -> "INFY.BSE";
            case "HDFC"        -> "HDFCBANK.BSE";
            case "HDFCBANK"    -> "HDFCBANK.BSE";
            case "WIPRO"       -> "WIPRO.BSE";
            case "ICICIBANK"   -> "ICICIBANK.BSE";
            case "SBIN"        -> "SBIN.BSE";
            case "BAJFINANCE"  -> "BAJFINANCE.BSE";
            case "HINDUNILVR"  -> "HINDUNILVR.BSE";
            default            -> symbol;
        };
    }
}