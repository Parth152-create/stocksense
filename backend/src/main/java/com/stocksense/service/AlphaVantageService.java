package com.stocksense.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class AlphaVantageService {

    @Value("${alphavantage.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    private static final String BASE = "https://www.alphavantage.co/query";

    // ─────────────────────────────────────────────────────────────────────────
    // The root cause of ALL 15 errors:
    //   Map<?, ?> means key=capture<?>, value=capture<?>.
    //   getOrDefault(Object key, V defaultValue) requires V = capture<?>,
    //   but we were passing String as the default → type mismatch.
    //
    // Fix: replace every m.getOrDefault(key, "default") on a Map<?,?>
    //      with the helper str(m, key, default) which does an explicit cast.
    // ─────────────────────────────────────────────────────────────────────────

    // ── Single real-time quote ────────────────────────────────────────────────

    public Map<String, Object> getQuote(String symbol) {
        try {
            String url = BASE + "?function=GLOBAL_QUOTE&symbol=" + symbol + "&apikey=" + apiKey;
            Map<?, ?> resp = restTemplate.getForObject(url, Map.class);
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
            return result;
        } catch (Exception e) {
            return mockQuote(symbol);
        }
    }

    // ── Company overview / fundamentals ───────────────────────────────────────

    public Map<String, Object> getOverview(String symbol) {
        try {
            String url = BASE + "?function=OVERVIEW&symbol=" + symbol + "&apikey=" + apiKey;
            Map<?, ?> resp = restTemplate.getForObject(url, Map.class);
            if (resp == null || resp.isEmpty() || !resp.containsKey("Symbol")) {
                return mockOverview(symbol);
            }
            Map<String, Object> result = new LinkedHashMap<>();
            resp.forEach((k, v) -> result.put(String.valueOf(k), v));
            return result;
        } catch (Exception e) {
            return mockOverview(symbol);
        }
    }

    // ── Symbol search ─────────────────────────────────────────────────────────

    public List<Map<String, Object>> search(String query) {
        try {
            String url = BASE + "?function=SYMBOL_SEARCH&keywords=" + query + "&apikey=" + apiKey;
            Map<?, ?> resp = restTemplate.getForObject(url, Map.class);
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
            return results;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    // ── Batch quotes ──────────────────────────────────────────────────────────

    public List<Map<String, Object>> getBatchQuotes(List<String> symbols) {
        List<Map<String, Object>> results = new ArrayList<>();
        for (String symbol : symbols) {
            try {
                results.add(getQuote(symbol));
            } catch (Exception e) {
                results.add(mockQuote(symbol));
            }
        }
        return results;
    }

    // ── Intraday OHLCV — 5-min bars for 1D chart ─────────────────────────────

    public List<Map<String, Object>> getIntraday(String symbol, String interval) {
        try {
            String url = BASE
                    + "?function=TIME_SERIES_INTRADAY"
                    + "&symbol="    + symbol
                    + "&interval="  + interval
                    + "&outputsize=compact"
                    + "&apikey="    + apiKey;

            Map<?, ?> resp = restTemplate.getForObject(url, Map.class);
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
            return candles;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    // ── Daily OHLCV — for 1W / 1M / 1Y / ALL chart ───────────────────────────

    public List<Map<String, Object>> getDailyOHLCV(String symbol) {
        try {
            String url = BASE
                    + "?function=TIME_SERIES_DAILY"
                    + "&symbol="    + symbol
                    + "&outputsize=full"
                    + "&apikey="    + apiKey;

            Map<?, ?> resp = restTemplate.getForObject(url, Map.class);
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
            Map<?, ?> resp = restTemplate.getForObject(url, Map.class);
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

    /**
     * Safe string extraction from Map<?,?> — avoids getOrDefault type errors.
     * Uses explicit null check + String.valueOf instead of getOrDefault.
     */
    private String str(Map<?, ?> m, String key, String defaultVal) {
        Object v = m.get(key);
        return v != null ? String.valueOf(v) : defaultVal;
    }

    /**
     * Parse a double from Map<?,?> by key. Returns 0.0 on any failure.
     */
    private double parseDouble(Map<?, ?> m, String key) {
        try {
            return Double.parseDouble(str(m, key, "0").replace("%", "").trim());
        } catch (Exception e) { return 0.0; }
    }

    /**
     * Parse a long from Map<?,?> by key. Returns 0 on any failure.
     */
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