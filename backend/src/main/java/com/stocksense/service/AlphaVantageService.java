package com.stocksense.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AlphaVantageService {

    private static final Logger log = LoggerFactory.getLogger(AlphaVantageService.class);

    @Value("${alphavantage.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    private static final String BASE = "https://www.alphavantage.co/query";

    // ── Rate limiter — max 4 calls/min (free tier is 5, keep 1 buffer) ────────
    private static final int    MAX_CALLS_PER_MINUTE = 4;
    private static final long   MINUTE_MS            = 60_000L;
    private final List<Long>    callTimestamps        = Collections.synchronizedList(new ArrayList<>());

    // ── TTL cache — symbol → { data, expiresAt } ─────────────────────────────
    private static final long QUOTE_TTL_MS    = 60_000L;   // 60s for quotes
    private static final long OVERVIEW_TTL_MS = 3_600_000L; // 1h for overviews
    private static final long HISTORY_TTL_MS  = 300_000L;  // 5min for history

    private record CacheEntry(Object data, long expiresAt) {
        boolean isAlive() { return System.currentTimeMillis() < expiresAt; }
    }

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    // ── Rate-limited API caller ───────────────────────────────────────────────

    /**
     * Blocks until a call slot is available (max 4/min), then makes the call.
     * Falls back to mock if rate limit would be exceeded after 2s wait.
     */
    private synchronized Map<?, ?> rateLimitedGet(String url) {
        long now = System.currentTimeMillis();

        // Remove timestamps older than 1 minute
        callTimestamps.removeIf(t -> now - t > MINUTE_MS);

        if (callTimestamps.size() >= MAX_CALLS_PER_MINUTE) {
            // Calculate how long until oldest call expires
            long oldest  = callTimestamps.get(0);
            long waitMs  = MINUTE_MS - (now - oldest) + 100;

            if (waitMs > 2000) {
                // Too long to wait — return null so caller uses mock
                log.warn("[AlphaVantage] Rate limit reached, skipping API call for: {}", url);
                return null;
            }

            log.debug("[AlphaVantage] Rate limiting — waiting {}ms", waitMs);
            try { Thread.sleep(waitMs); } catch (InterruptedException ignored) {}
        }

        callTimestamps.add(System.currentTimeMillis());
        try {
            return restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            log.warn("[AlphaVantage] API call failed: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private <T> T getCached(String key) {
        CacheEntry entry = cache.get(key);
        if (entry != null && entry.isAlive()) {
            log.debug("[AlphaVantage] Cache hit: {}", key);
            return (T) entry.data();
        }
        return null;
    }

    private void putCache(String key, Object data, long ttlMs) {
        cache.put(key, new CacheEntry(data, System.currentTimeMillis() + ttlMs));
    }

    // ── Single real-time quote ────────────────────────────────────────────────

    public Map<String, Object> getQuote(String symbol) {
        String cacheKey = "quote:" + symbol;
        Map<String, Object> cached = getCached(cacheKey);
        if (cached != null) return cached;

        try {
            String url = BASE + "?function=GLOBAL_QUOTE&symbol=" + symbol + "&apikey=" + apiKey;
            Map<?, ?> resp = rateLimitedGet(url);
            if (resp == null) return mockQuote(symbol);

            Map<?, ?> quote = (Map<?, ?>) resp.get("Global Quote");
            if (quote == null || quote.isEmpty()) return mockQuote(symbol);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("symbol",        symbol);
            result.put("price",         parseDouble(quote, "05. price"));
            result.put("open",          parseDouble(quote, "02. open"));
            result.put("high",          parseDouble(quote, "03. high"));
            result.put("low",           parseDouble(quote, "04. low"));
            result.put("change",        parseDouble(quote, "09. change"));
            result.put("changePercent", parseChangePct(quote));
            result.put("volume",        parseLong(quote,   "06. volume"));
            result.put("latestDay",     str(quote, "07. latest trading day", ""));

            putCache(cacheKey, result, QUOTE_TTL_MS);
            return result;
        } catch (Exception e) {
            return mockQuote(symbol);
        }
    }

    // ── Company overview / fundamentals ───────────────────────────────────────

    public Map<String, Object> getOverview(String symbol) {
        String cacheKey = "overview:" + symbol;
        Map<String, Object> cached = getCached(cacheKey);
        if (cached != null) return cached;

        try {
            String url = BASE + "?function=OVERVIEW&symbol=" + symbol + "&apikey=" + apiKey;
            Map<?, ?> resp = rateLimitedGet(url);
            if (resp == null || resp.isEmpty() || !resp.containsKey("Symbol")) {
                return mockOverview(symbol);
            }
            Map<String, Object> result = new LinkedHashMap<>();
            resp.forEach((k, v) -> result.put(String.valueOf(k), v));

            putCache(cacheKey, result, OVERVIEW_TTL_MS);
            return result;
        } catch (Exception e) {
            return mockOverview(symbol);
        }
    }

    // ── Symbol search ─────────────────────────────────────────────────────────

    public List<Map<String, Object>> search(String query) {
        String cacheKey = "search:" + query.toLowerCase();
        List<Map<String, Object>> cached = getCached(cacheKey);
        if (cached != null) return cached;

        try {
            String url = BASE + "?function=SYMBOL_SEARCH&keywords=" + query + "&apikey=" + apiKey;
            Map<?, ?> resp = rateLimitedGet(url);
            if (resp == null) return Collections.emptyList();

            List<?> matches = (List<?>) resp.get("bestMatches");
            if (matches == null) return Collections.emptyList();

            List<Map<String, Object>> results = new ArrayList<>();
            for (Object m : matches) {
                Map<?, ?> match = (Map<?, ?>) m;
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("symbol", str(match, "1. symbol", ""));
                item.put("name",   str(match, "2. name",   ""));
                item.put("type",   str(match, "3. type",   ""));
                item.put("region", str(match, "4. region", ""));
                results.add(item);
            }

            putCache(cacheKey, results, QUOTE_TTL_MS);
            return results;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    // ── Batch quotes — use cache to avoid burning rate limit ─────────────────

    public List<Map<String, Object>> getBatchQuotes(List<String> symbols) {
        List<Map<String, Object>> results = new ArrayList<>();
        for (String symbol : symbols) {
            try {
                results.add(getQuote(symbol)); // getQuote handles caching + rate limit
            } catch (Exception e) {
                results.add(mockQuote(symbol));
            }
        }
        return results;
    }

    // ── Intraday OHLCV ────────────────────────────────────────────────────────

    public List<Map<String, Object>> getIntraday(String symbol, String interval) {
        String cacheKey = "intraday:" + symbol + ":" + interval;
        List<Map<String, Object>> cached = getCached(cacheKey);
        if (cached != null) return cached;

        try {
            String url = BASE
                    + "?function=TIME_SERIES_INTRADAY"
                    + "&symbol="    + symbol
                    + "&interval="  + interval
                    + "&outputsize=compact"
                    + "&apikey="    + apiKey;

            Map<?, ?> resp = rateLimitedGet(url);
            if (resp == null) return Collections.emptyList();

            String seriesKey = "Time Series (" + interval + ")";
            Map<?, ?> series = (Map<?, ?>) resp.get(seriesKey);
            if (series == null || series.isEmpty()) return Collections.emptyList();

            List<Map<String, Object>> candles = new ArrayList<>();
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

            new TreeMap<>(series).forEach((dateStr, val) -> {
                Map<?, ?> bar = (Map<?, ?>) val;
                long time = LocalDateTime.parse(String.valueOf(dateStr), fmt)
                        .toEpochSecond(ZoneOffset.ofHoursMinutes(5, 30));
                Map<String, Object> candle = new LinkedHashMap<>();
                candle.put("time",   time);
                candle.put("open",   parseBarDouble(bar, "1. open"));
                candle.put("high",   parseBarDouble(bar, "2. high"));
                candle.put("low",    parseBarDouble(bar, "3. low"));
                candle.put("close",  parseBarDouble(bar, "4. close"));
                candle.put("volume", parseBarLong(bar,   "5. volume"));
                candles.add(candle);
            });

            putCache(cacheKey, candles, QUOTE_TTL_MS);
            return candles;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    // ── Daily OHLCV ───────────────────────────────────────────────────────────

    public List<Map<String, Object>> getDailyOHLCV(String symbol) {
        String cacheKey = "daily:" + symbol;
        List<Map<String, Object>> cached = getCached(cacheKey);
        if (cached != null) return cached;

        try {
            String url = BASE
                    + "?function=TIME_SERIES_DAILY"
                    + "&symbol="    + symbol
                    + "&outputsize=full"
                    + "&apikey="    + apiKey;

            Map<?, ?> resp = rateLimitedGet(url);
            if (resp == null) return Collections.emptyList();

            Map<?, ?> series = (Map<?, ?>) resp.get("Time Series (Daily)");
            if (series == null || series.isEmpty()) return Collections.emptyList();

            List<Map<String, Object>> candles = new ArrayList<>();
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");

            new TreeMap<>(series).forEach((dateStr, val) -> {
                Map<?, ?> bar = (Map<?, ?>) val;
                long time = LocalDate.parse(String.valueOf(dateStr), fmt)
                        .atStartOfDay()
                        .toEpochSecond(ZoneOffset.UTC);
                Map<String, Object> candle = new LinkedHashMap<>();
                candle.put("time",   time);
                candle.put("open",   parseBarDouble(bar, "1. open"));
                candle.put("high",   parseBarDouble(bar, "2. high"));
                candle.put("low",    parseBarDouble(bar, "3. low"));
                candle.put("close",  parseBarDouble(bar, "4. close"));
                candle.put("volume", parseBarLong(bar,   "5. volume"));
                candles.add(candle);
            });

            putCache(cacheKey, candles, HISTORY_TTL_MS);
            return candles;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    // ── Legacy raw daily history ──────────────────────────────────────────────

    public Map<String, Object> getDailyHistory(String symbol) {
        try {
            String url = BASE
                    + "?function=TIME_SERIES_DAILY"
                    + "&symbol="    + symbol
                    + "&outputsize=compact"
                    + "&apikey="    + apiKey;
            Map<?, ?> resp = rateLimitedGet(url);
            if (resp == null) return Collections.emptyMap();
            Map<String, Object> result = new LinkedHashMap<>();
            resp.forEach((k, v) -> result.put(String.valueOf(k), v));
            return result;
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    // ── Mock fallbacks ────────────────────────────────────────────────────────

    private Map<String, Object> mockQuote(String symbol) {
        int    hash  = Math.abs(symbol.hashCode());
        double price = 100 + (hash % 4900);
        double chg   = (hash % 10) - 5.0;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("symbol",        symbol);
        m.put("price",         round(price));
        m.put("open",          round(price * 0.99));
        m.put("high",          round(price * 1.01));
        m.put("low",           round(price * 0.98));
        m.put("change",        round(chg));
        m.put("changePercent", round(chg / price * 100));
        m.put("volume",        (long)(hash % 5_000_000 + 100_000));
        return m;
    }

    private Map<String, Object> mockOverview(String symbol) {
        String clean = symbol.replace(".BSE", "").replace(".NSE", "");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("Symbol",               clean);
        m.put("Name",                 clean + " Ltd.");
        m.put("Exchange",             "BSE");
        m.put("Sector",               "Technology");
        m.put("Industry",             "Software—Application");
        m.put("Description",          "A leading company in its sector with a strong track record of innovation and growth.");
        m.put("MarketCapitalization", "184000000");
        m.put("PERatio",              "29.00");
        m.put("EPS",                  "7.36");
        m.put("DividendYield",        "0.012");
        m.put("52WeekHigh",           "239.20");
        m.put("52WeekLow",            "128.80");
        return m;
    }

    // ── Type-safe helpers ─────────────────────────────────────────────────────

    private String str(Map<?, ?> m, String key, String defaultVal) {
        Object v = m.get(key);
        return v != null ? String.valueOf(v) : defaultVal;
    }

    private double parseDouble(Map<?, ?> m, String key) {
        try {
            return Double.parseDouble(str(m, key, "0").replace("%", "").trim());
        } catch (Exception e) { return 0.0; }
    }

    private long parseLong(Map<?, ?> m, String key) {
        try {
            return Long.parseLong(str(m, key, "0").trim());
        } catch (Exception e) { return 0L; }
    }

    private double parseChangePct(Map<?, ?> m) {
        try {
            return Double.parseDouble(
                    str(m, "10. change percent", "0%").replace("%", "").trim());
        } catch (Exception e) { return 0.0; }
    }

    private double parseBarDouble(Map<?, ?> bar, String key) {
        try {
            return Double.parseDouble(str(bar, key, "0").trim());
        } catch (Exception e) { return 0.0; }
    }

    private long parseBarLong(Map<?, ?> bar, String key) {
        try {
            return Long.parseLong(str(bar, key, "0").trim());
        } catch (Exception e) { return 0L; }
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}