package com.stocksense.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class StockService {

    private static final Logger log = LoggerFactory.getLogger(StockService.class);

    @Value("${alphavantage.api.key:demo}")
    private String alphaVantageKey;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    // ─── Caches ─────────────────────────────────────────────────────────────
    // Quote cache: 5 minutes TTL
    private final Cache<String, Map<String, Object>> quoteCache = Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .maximumSize(500)
            .build();

    // Historical data cache: 30 minutes TTL
    private final Cache<String, List<Map<String, Object>>> historyCache = Caffeine.newBuilder()
            .expireAfterWrite(30, TimeUnit.MINUTES)
            .maximumSize(200)
            .build();

    // Market overview cache: 5 minutes TTL
    private final Cache<String, List<Map<String, Object>>> marketCache = Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .maximumSize(10)
            .build();

    // Crypto cache: 2 minutes TTL
    private final Cache<String, List<Map<String, Object>>> cryptoCache = Caffeine.newBuilder()
            .expireAfterWrite(2, TimeUnit.MINUTES)
            .maximumSize(10)
            .build();

    // ─── Quote (Yahoo Finance) ───────────────────────────────────────────────
    /**
     * Fetches real-time quote from Yahoo Finance unofficial API.
     * No API key required. Falls back to Alpha Vantage on failure.
     */
    public Map<String, Object> getQuote(String symbol) {
        String cacheKey = symbol.toUpperCase();
        Map<String, Object> cached = quoteCache.getIfPresent(cacheKey);
        if (cached != null) {
            log.debug("Quote cache hit: {}", symbol);
            return cached;
        }

        Map<String, Object> result = fetchYahooQuote(symbol);
        if (result == null || result.isEmpty()) {
            log.warn("Yahoo Finance failed for {}, falling back to Alpha Vantage", symbol);
            result = fetchAlphaVantageQuote(symbol);
        }

        if (result != null && !result.isEmpty()) {
            quoteCache.put(cacheKey, result);
        }
        return result != null ? result : Collections.emptyMap();
    }

    private Map<String, Object> fetchYahooQuote(String symbol) {
        try {
            // Yahoo Finance v8 quote endpoint (no key required)
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol
                    + "?interval=1d&range=1d&includePrePost=false";

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "Mozilla/5.0")
                    .header("Accept", "application/json")
                    .GET()
                    .timeout(Duration.ofSeconds(8))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) return null;

            JsonNode root = mapper.readTree(resp.body());
            JsonNode meta = root.path("chart").path("result").get(0).path("meta");

            Map<String, Object> quote = new LinkedHashMap<>();
            quote.put("symbol", symbol.toUpperCase());
            quote.put("name", meta.path("longName").asText(symbol));
            quote.put("price", meta.path("regularMarketPrice").asDouble());
            quote.put("previousClose", meta.path("previousClose").asDouble());
            quote.put("open", meta.path("regularMarketOpen").asDouble());
            quote.put("high", meta.path("regularMarketDayHigh").asDouble());
            quote.put("low", meta.path("regularMarketDayLow").asDouble());
            quote.put("volume", meta.path("regularMarketVolume").asLong());
            quote.put("marketCap", meta.path("marketCap").asLong());
            quote.put("currency", meta.path("currency").asText("USD"));
            quote.put("exchange", meta.path("exchangeName").asText());

            double price = meta.path("regularMarketPrice").asDouble();
            double prevClose = meta.path("previousClose").asDouble();
            double change = price - prevClose;
            double changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
            quote.put("change", Math.round(change * 100.0) / 100.0);
            quote.put("changePct", Math.round(changePct * 100.0) / 100.0);
            quote.put("source", "yahoo");

            return quote;
        } catch (Exception e) {
            log.error("Yahoo Finance quote error for {}: {}", symbol, e.getMessage());
            return null;
        }
    }

    private Map<String, Object> fetchAlphaVantageQuote(String symbol) {
        try {
            String url = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE"
                    + "&symbol=" + symbol + "&apikey=" + alphaVantageKey;

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode root = mapper.readTree(resp.body());
            JsonNode q = root.path("Global Quote");

            if (q.isMissingNode()) return null;

            Map<String, Object> quote = new LinkedHashMap<>();
            quote.put("symbol", q.path("01. symbol").asText());
            quote.put("price", Double.parseDouble(q.path("05. price").asText("0")));
            quote.put("previousClose", Double.parseDouble(q.path("08. previous close").asText("0")));
            quote.put("open", Double.parseDouble(q.path("02. open").asText("0")));
            quote.put("high", Double.parseDouble(q.path("03. high").asText("0")));
            quote.put("low", Double.parseDouble(q.path("04. low").asText("0")));
            quote.put("volume", Long.parseLong(q.path("06. volume").asText("0")));
            quote.put("change", Double.parseDouble(q.path("09. change").asText("0")));
            quote.put("changePct", Double.parseDouble(
                    q.path("10. change percent").asText("0%").replace("%", "").trim()));
            quote.put("source", "alphavantage");
            return quote;
        } catch (Exception e) {
            log.error("Alpha Vantage quote error for {}: {}", symbol, e.getMessage());
            return null;
        }
    }

    // ─── Get Live Price (convenience method) ───────────────────────────────────
    /**
     * Convenience method to extract the current price from a quote.
     * Returns 0 if the quote cannot be fetched.
     */
    public double getLivePrice(String symbol) {
        Map<String, Object> quote = getQuote(symbol);
        if (quote == null || quote.isEmpty()) {
            return 0;
        }
        Object priceObj = quote.get("price");
        if (priceObj instanceof Number) {
            return ((Number) priceObj).doubleValue();
        }
        return 0;
    }

    // ─── Historical Data (Yahoo Finance OHLCV) ───────────────────────────────
    /**
     * Fetches OHLCV candlestick history from Yahoo Finance.
     * range: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y
     * interval: 1m, 5m, 15m, 30m, 60m, 1d, 1wk, 1mo
     */
    public List<Map<String, Object>> getHistory(String symbol, String range, String interval) {
        String cacheKey = symbol + ":" + range + ":" + interval;
        List<Map<String, Object>> cached = historyCache.getIfPresent(cacheKey);
        if (cached != null) {
            log.debug("History cache hit: {}", cacheKey);
            return cached;
        }

        List<Map<String, Object>> result = fetchYahooHistory(symbol, range, interval);
        if (result == null || result.isEmpty()) {
            result = fetchAlphaVantageHistory(symbol);
        }

        if (result != null && !result.isEmpty()) {
            historyCache.put(cacheKey, result);
        }
        return result != null ? result : Collections.emptyList();
    }

    private List<Map<String, Object>> fetchYahooHistory(String symbol, String range, String interval) {
        try {
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol
                    + "?interval=" + interval + "&range=" + range
                    + "&includePrePost=false";

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "Mozilla/5.0")
                    .GET()
                    .timeout(Duration.ofSeconds(12))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) return null;

            JsonNode root = mapper.readTree(resp.body());
            JsonNode result = root.path("chart").path("result").get(0);
            if (result == null) return null;

            JsonNode timestamps = result.path("timestamp");
            JsonNode ohlcv = result.path("indicators").path("quote").get(0);

            List<Map<String, Object>> candles = new ArrayList<>();
            for (int i = 0; i < timestamps.size(); i++) {
                try {
                    double open = ohlcv.path("open").get(i).asDouble();
                    double high = ohlcv.path("high").get(i).asDouble();
                    double low = ohlcv.path("low").get(i).asDouble();
                    double close = ohlcv.path("close").get(i).asDouble();
                    long volume = ohlcv.path("volume").get(i).asLong();

                    if (open == 0 && close == 0) continue;

                    Map<String, Object> candle = new LinkedHashMap<>();
                    candle.put("timestamp", timestamps.get(i).asLong() * 1000L);
                    candle.put("open", Math.round(open * 100.0) / 100.0);
                    candle.put("high", Math.round(high * 100.0) / 100.0);
                    candle.put("low", Math.round(low * 100.0) / 100.0);
                    candle.put("close", Math.round(close * 100.0) / 100.0);
                    candle.put("volume", volume);
                    candles.add(candle);
                } catch (Exception ignored) {}
            }
            return candles;
        } catch (Exception e) {
            log.error("Yahoo Finance history error for {}: {}", symbol, e.getMessage());
            return null;
        }
    }

    private List<Map<String, Object>> fetchAlphaVantageHistory(String symbol) {
        try {
            String url = "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED"
                    + "&symbol=" + symbol + "&outputsize=compact&apikey=" + alphaVantageKey;

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .timeout(Duration.ofSeconds(15))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode root = mapper.readTree(resp.body());
            JsonNode series = root.path("Time Series (Daily)");
            if (series.isMissingNode()) return null;

            List<Map<String, Object>> candles = new ArrayList<>();
            series.fields().forEachRemaining(entry -> {
                JsonNode day = entry.getValue();
                Map<String, Object> candle = new LinkedHashMap<>();
                candle.put("date", entry.getKey());
                candle.put("open", Double.parseDouble(day.path("1. open").asText("0")));
                candle.put("high", Double.parseDouble(day.path("2. high").asText("0")));
                candle.put("low", Double.parseDouble(day.path("3. low").asText("0")));
                candle.put("close", Double.parseDouble(day.path("4. close").asText("0")));
                candle.put("volume", Long.parseLong(day.path("6. volume").asText("0")));
                candles.add(candle);
            });

            // Reverse so oldest first
            Collections.reverse(candles);
            return candles;
        } catch (Exception e) {
            log.error("Alpha Vantage history error: {}", e.getMessage());
            return null;
        }
    }

    // ─── Market Overview (top movers per market) ─────────────────────────────
    public List<Map<String, Object>> getMarketOverview(String market) {
        String cacheKey = "market:" + market;
        List<Map<String, Object>> cached = marketCache.getIfPresent(cacheKey);
        if (cached != null) return cached;

        List<String> symbols = switch (market.toUpperCase()) {
            case "US" -> List.of("AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD");
            case "IN" -> List.of("RELIANCE.BSE", "TCS.BSE", "INFY.BSE", "HDFCBANK.BSE", "ICICIBANK.BSE");
            case "FX" -> List.of("EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X", "AUDUSD=X");
            default -> List.of("AAPL", "MSFT", "GOOGL", "NVDA");
        };

        List<Map<String, Object>> results = new ArrayList<>();
        for (String sym : symbols) {
            try {
                Map<String, Object> q = fetchYahooQuote(sym);
                if (q != null && !q.isEmpty()) results.add(q);
            } catch (Exception e) {
                log.warn("Failed to fetch market quote for {}: {}", sym, e.getMessage());
            }
        }

        if (!results.isEmpty()) marketCache.put(cacheKey, results);
        return results;
    }

    // ─── Crypto (CoinGecko) ──────────────────────────────────────────────────
    /**
     * Fetches top N crypto prices from CoinGecko (free, no key required).
     */
    public List<Map<String, Object>> getTopCrypto(int limit) {
        String cacheKey = "crypto:top:" + limit;
        List<Map<String, Object>> cached = cryptoCache.getIfPresent(cacheKey);
        if (cached != null) return cached;

        try {
            String url = "https://api.coingecko.com/api/v3/coins/markets"
                    + "?vs_currency=usd&order=market_cap_desc&per_page=" + limit
                    + "&page=1&sparkline=false&price_change_percentage=24h";

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Accept", "application/json")
                    .GET()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 429) {
                log.warn("CoinGecko rate limit hit");
                return getMockCrypto();
            }
            if (resp.statusCode() != 200) return getMockCrypto();

            JsonNode arr = mapper.readTree(resp.body());
            List<Map<String, Object>> results = new ArrayList<>();

            for (JsonNode coin : arr) {
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("id", coin.path("id").asText());
                c.put("symbol", coin.path("symbol").asText().toUpperCase());
                c.put("name", coin.path("name").asText());
                c.put("price", coin.path("current_price").asDouble());
                c.put("change", coin.path("price_change_24h").asDouble());
                c.put("changePct", coin.path("price_change_percentage_24h").asDouble());
                c.put("marketCap", coin.path("market_cap").asLong());
                c.put("volume", coin.path("total_volume").asLong());
                c.put("image", coin.path("image").asText());
                c.put("high24h", coin.path("high_24h").asDouble());
                c.put("low24h", coin.path("low_24h").asDouble());
                c.put("source", "coingecko");
                results.add(c);
            }

            cryptoCache.put(cacheKey, results);
            return results;
        } catch (Exception e) {
            log.error("CoinGecko fetch error: {}", e.getMessage());
            return getMockCrypto();
        }
    }

    public Map<String, Object> getCryptoQuote(String coinId) {
        try {
            String url = "https://api.coingecko.com/api/v3/simple/price"
                    + "?ids=" + coinId + "&vs_currencies=usd&include_24hr_change=true"
                    + "&include_24hr_vol=true&include_market_cap=true";

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Accept", "application/json")
                    .GET()
                    .timeout(Duration.ofSeconds(8))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode root = mapper.readTree(resp.body());
            JsonNode data = root.path(coinId.toLowerCase());

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", coinId);
            result.put("price", data.path("usd").asDouble());
            result.put("changePct", data.path("usd_24h_change").asDouble());
            result.put("volume", data.path("usd_24h_vol").asDouble());
            result.put("marketCap", data.path("usd_market_cap").asDouble());
            result.put("source", "coingecko");
            return result;
        } catch (Exception e) {
            log.error("CoinGecko single quote error for {}: {}", coinId, e.getMessage());
            return Collections.emptyMap();
        }
    }

    // ─── Search ──────────────────────────────────────────────────────────────
    public List<Map<String, Object>> searchSymbol(String query) {
        try {
            String url = "https://query1.finance.yahoo.com/v1/finance/search?q="
                    + query + "&quotesCount=8&newsCount=0";

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "Mozilla/5.0")
                    .GET()
                    .timeout(Duration.ofSeconds(8))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode root = mapper.readTree(resp.body());
            JsonNode quotes = root.path("quotes");

            List<Map<String, Object>> results = new ArrayList<>();
            for (JsonNode q : quotes) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("symbol", q.path("symbol").asText());
                item.put("name", q.path("longname").asText(q.path("shortname").asText()));
                item.put("exchange", q.path("exchange").asText());
                item.put("type", q.path("quoteType").asText());
                results.add(item);
            }
            return results;
        } catch (Exception e) {
            log.error("Symbol search error for {}: {}", query, e.getMessage());
            return Collections.emptyList();
        }
    }

    // ─── Cache management ────────────────────────────────────────────────────
    public void invalidateQuote(String symbol) {
        quoteCache.invalidate(symbol.toUpperCase());
    }

    public Map<String, Long> getCacheStats() {
        return Map.of(
                "quoteSize", quoteCache.estimatedSize(),
                "historySize", historyCache.estimatedSize(),
                "marketSize", marketCache.estimatedSize(),
                "cryptoSize", cryptoCache.estimatedSize()
        );
    }

    // ─── Fallbacks ───────────────────────────────────────────────────────────
    private List<Map<String, Object>> getMockCrypto() {
        return List.of(
                Map.of("symbol", "BTC", "name", "Bitcoin", "price", 67420.0,
                        "changePct", 2.45, "source", "mock"),
                Map.of("symbol", "ETH", "name", "Ethereum", "price", 3580.0,
                        "changePct", 1.87, "source", "mock"),
                Map.of("symbol", "SOL", "name", "Solana", "price", 185.0,
                        "changePct", -0.93, "source", "mock")
        );
    }
}