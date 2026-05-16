package com.stocksense.controller;

import com.stocksense.service.AlphaVantageService;
import com.stocksense.service.MarketSymbolService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class StockController {

    private final AlphaVantageService alphaVantage;
    private final MarketSymbolService marketSymbols;

    private static final String NEWS_API_KEY = "33583e3bf61647109d1671aaa4a098e6";

    public StockController(AlphaVantageService alphaVantage, MarketSymbolService marketSymbols) {
        this.alphaVantage  = alphaVantage;
        this.marketSymbols = marketSymbols;
    }

    private String resolveSymbol(String symbol, String market) {
        if (symbol == null) return null;
        String s = symbol.trim().toUpperCase()
                .replace(".BSE", "")
                .replace(".NSE", "");
        if ("IN".equalsIgnoreCase(market) && !s.contains(".")) {
            return s + ".BSE";
        }
        return s;
    }

    // ── GET /api/stocks/{symbol} ──────────────────────────────────────────────
    @GetMapping("/stocks/{symbol}")
    public ResponseEntity<Map<String, Object>> getQuote(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {
        return ResponseEntity.ok(alphaVantage.getQuote(resolveSymbol(symbol, market)));
    }

    // ── GET /api/stocks/{symbol}/overview ─────────────────────────────────────
    @GetMapping("/stocks/{symbol}/overview")
    public ResponseEntity<Map<String, Object>> getOverview(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {

        String resolved = resolveSymbol(symbol, market);
        Map<String, Object> raw = alphaVantage.getOverview(resolved);

        if (raw == null || raw.isEmpty() || raw.containsKey("error")) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("symbol",        resolved);
        overview.put("name",          raw.getOrDefault("Name",                 resolved));
        overview.put("exchange",      raw.getOrDefault("Exchange",             "—"));
        overview.put("sector",        raw.getOrDefault("Sector",               "—"));
        overview.put("industry",      raw.getOrDefault("Industry",             "—"));
        overview.put("description",   raw.getOrDefault("Description",          ""));
        overview.put("marketCap",     parseDouble(raw.get("MarketCapitalization")));
        overview.put("peRatio",       parseDouble(raw.get("PERatio")));
        overview.put("eps",           parseDouble(raw.get("EPS")));
        overview.put("dividendYield", parseDouble(raw.get("DividendYield")));
        overview.put("week52High",    parseDouble(raw.get("52WeekHigh")));
        overview.put("week52Low",     parseDouble(raw.get("52WeekLow")));

        return ResponseEntity.ok(overview);
    }

    // ── GET /api/stocks/{symbol}/ratings ──────────────────────────────────────
    @GetMapping("/stocks/{symbol}/ratings")
    public ResponseEntity<Map<String, Object>> getRatings(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {

        int hash       = Math.abs(symbol.hashCode());
        int strongBuy  = 5  + (hash % 10);
        int buy        = 8  + (hash % 8);
        int hold       = 4  + (hash % 6);
        int sell       = 1  + (hash % 4);
        int strongSell = hash % 3;

        Map<String, Object> quote       = alphaVantage.getQuote(resolveSymbol(symbol, market));
        double currentPrice = parseDouble(quote.get("price"));
        double targetPrice  = currentPrice > 0
                ? currentPrice * (1.05 + (hash % 20) / 100.0)
                : 150.0;

        Map<String, Object> ratings = new LinkedHashMap<>();
        ratings.put("strongBuy",   strongBuy);
        ratings.put("buy",         buy);
        ratings.put("hold",        hold);
        ratings.put("sell",        sell);
        ratings.put("strongSell",  strongSell);
        ratings.put("targetPrice", Math.round(targetPrice * 100.0) / 100.0);
        return ResponseEntity.ok(ratings);
    }

    // ── GET /api/stocks/{symbol}/insights ─────────────────────────────────────
    @GetMapping("/stocks/{symbol}/insights")
    public ResponseEntity<List<Map<String, Object>>> getInsights(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {

        String clean = symbol.replace(".BSE", "").replace(".NSE", "").toUpperCase();
        String now   = new java.util.Date().toString();

        List<Map<String, Object>> insights = List.of(
            Map.of("id","1","type","BULLISH",
                "title", clean + " shows strong momentum",
                "body",  "Technical indicators suggest bullish continuation with RSI above 60 and MACD crossover.",
                "source","StockSense AI","publishedAt", now),
            Map.of("id","2","type","NEUTRAL",
                "title","Earnings report due next quarter",
                "body",  "Analysts expect moderate growth. Watch for guidance revision at the upcoming earnings call.",
                "source","StockSense AI","publishedAt", now)
        );
        return ResponseEntity.ok(insights);
    }

    // ── GET /api/stocks/{symbol}/news ─────────────────────────────────────────
    @GetMapping("/stocks/{symbol}/news")
    public ResponseEntity<List<Map<String, Object>>> getNews(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market) {

        String clean = symbol.replace(".BSE", "").replace(".NSE", "")
                             .replace(".NYSE", "").replace(".NASDAQ", "").toUpperCase();

        // Company name hints for better NewsAPI results
        Map<String, String> nameHints = Map.ofEntries(
            Map.entry("AAPL",     "Apple"),
            Map.entry("MSFT",     "Microsoft"),
            Map.entry("NVDA",     "NVIDIA"),
            Map.entry("TSLA",     "Tesla"),
            Map.entry("GOOGL",    "Google Alphabet"),
            Map.entry("AMZN",     "Amazon"),
            Map.entry("META",     "Meta Facebook"),
            Map.entry("AMD",      "AMD semiconductor"),
            Map.entry("RELIANCE", "Reliance Industries"),
            Map.entry("TCS",      "Tata Consultancy"),
            Map.entry("INFY",     "Infosys"),
            Map.entry("HDFCBANK", "HDFC Bank"),
            Map.entry("WIPRO",    "Wipro"),
            Map.entry("SBIN",     "State Bank India"),
            Map.entry("TATAMOTORS","Tata Motors")
        );

        String query = nameHints.getOrDefault(clean, clean) + " stock";

        try {
            String urlStr = "https://newsapi.org/v2/everything"
                + "?q=" + java.net.URLEncoder.encode(query, StandardCharsets.UTF_8)
                + "&sortBy=publishedAt"
                + "&pageSize=8"
                + "&language=en"
                + "&apiKey=" + NEWS_API_KEY;

            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestProperty("User-Agent", "StockSense/1.0");

            int status = conn.getResponseCode();
            if (status != 200) {
                return ResponseEntity.ok(getMockNews(clean));
            }

            InputStream is  = conn.getInputStream();
            String body     = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            is.close();

            // Parse JSON manually (no extra dependency needed)
            List<Map<String, Object>> articles = parseNewsResponse(body);
            return ResponseEntity.ok(articles.isEmpty() ? getMockNews(clean) : articles);

        } catch (Exception e) {
            return ResponseEntity.ok(getMockNews(clean));
        }
    }

    // ── GET /api/stocks/{symbol}/history ─────────────────────────────────────
    @GetMapping("/stocks/{symbol}/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "") String market,
            @RequestParam(defaultValue = "1M") String range) {
        try {
            boolean intraday = "1D".equalsIgnoreCase(range);
            List<Map<String, Object>> candles;

            if (intraday) {
                candles = alphaVantage.getIntraday(resolveSymbol(symbol, market), "5min");
            } else {
                candles = alphaVantage.getDailyOHLCV(resolveSymbol(symbol, market));
                candles = filterByRange(candles, range);
            }

            if (candles == null || candles.isEmpty()) {
                candles = generateMockCandles(range);
            }

            return ResponseEntity.ok(candles);
        } catch (Exception e) {
            return ResponseEntity.ok(generateMockCandles(range));
        }
    }

    // ── GET /api/stocks/search?q= ─────────────────────────────────────────────
    @GetMapping("/stocks/search")
    public ResponseEntity<List<Map<String, Object>>> search(@RequestParam String q) {
        return ResponseEntity.ok(alphaVantage.search(q));
    }

    // ── GET /api/market/{marketId}/symbols ────────────────────────────────────
    @GetMapping("/market/{marketId}/symbols")
    public ResponseEntity<List<Map<String, String>>> getMarketSymbols(
            @PathVariable String marketId) {
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

        List<String> symbolStrings = allSymbols.subList(from, to)
                .stream().map(s -> s.get("symbol")).toList();

        List<Map<String, Object>> quotes   = alphaVantage.getBatchQuotes(symbolStrings);
        List<Map<String, Object>> enriched = new ArrayList<>();

        for (int i = 0; i < allSymbols.subList(from, to).size(); i++) {
            Map<String, Object> merged = new LinkedHashMap<>();
            merged.putAll(allSymbols.subList(from, to).get(i));
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
    public ResponseEntity<Map<String, Object>> getAnalytics(
            @PathVariable String marketId) {

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("market",        marketId);
        data.put("totalValue",    switch (marketId) {
            case "IN" -> 9331456; case "US" -> 530056; default -> 120000; });
        data.put("changePercent", switch (marketId) {
            case "IN" -> 6.42;   case "US" -> 4.75;   default -> 2.1; });
        data.put("changeAmount",  switch (marketId) {
            case "IN" -> 562100; case "US" -> 24000;  default -> 2520; });
        data.put("riskScore",     switch (marketId) {
            case "IN" -> 76;     case "US" -> 58;     default -> 82; });
        data.put("allocation",    switch (marketId) {
            case "IN" -> List.of(
                Map.of("label","Stocks","pct",62),
                Map.of("label","Funds","pct",28),
                Map.of("label","Other","pct",10));
            case "US" -> List.of(
                Map.of("label","Stocks","pct",48),
                Map.of("label","Crypto","pct",30),
                Map.of("label","Funds","pct",22));
            default -> List.of(
                Map.of("label","Crypto","pct",70),
                Map.of("label","Stablecoins","pct",20),
                Map.of("label","DeFi","pct",10));
        });
        return ResponseEntity.ok(data);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Minimal JSON parser for NewsAPI response.
     * Avoids adding Jackson dependency — reads articles array manually.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseNewsResponse(String json) {
        List<Map<String, Object>> result = new ArrayList<>();
        try {
            // Use Spring's built-in Jackson if available via ObjectMapper
            com.fasterxml.jackson.databind.ObjectMapper mapper =
                new com.fasterxml.jackson.databind.ObjectMapper();
            Map<String, Object> root = mapper.readValue(json, Map.class);
            List<Map<String, Object>> articles =
                (List<Map<String, Object>>) root.get("articles");

            if (articles == null) return result;

            for (Map<String, Object> a : articles) {
                String title       = str(a, "title", "");
                String description = str(a, "description", "");
                String url         = str(a, "url", "");
                String publishedAt = str(a, "publishedAt", "");
                String urlToImage  = str(a, "urlToImage", "");

                Object sourceObj = a.get("source");
                String sourceName = "";
                if (sourceObj instanceof Map) {
                    sourceName = str((Map<String, Object>) sourceObj, "name", "");
                }

                if (title.isEmpty() || title.equals("[Removed]")) continue;

                Map<String, Object> article = new LinkedHashMap<>();
                article.put("title",       title);
                article.put("description", description);
                article.put("url",         url);
                article.put("source",      sourceName);
                article.put("publishedAt", publishedAt);
                article.put("urlToImage",  urlToImage);
                result.add(article);
            }
        } catch (Exception e) {
            // Return empty — caller falls back to mock
        }
        return result;
    }

    private String str(Map<String, Object> map, String key, String def) {
        Object v = map.get(key);
        return (v != null && !v.toString().equals("null")) ? v.toString() : def;
    }

    private List<Map<String, Object>> getMockNews(String symbol) {
        String now = java.time.Instant.now().toString();
        return List.of(
            Map.of("title", symbol + " shows resilience amid market volatility",
                   "description", "Analysts remain cautiously optimistic as the stock holds key support levels.",
                   "url", "#", "source", "StockSense", "publishedAt", now, "urlToImage", ""),
            Map.of("title", "Institutional investors increase stake in " + symbol,
                   "description", "Recent filings show major funds have added to their positions this quarter.",
                   "url", "#", "source", "StockSense", "publishedAt", now, "urlToImage", ""),
            Map.of("title", symbol + " technical analysis: key levels to watch",
                   "description", "RSI divergence and volume patterns suggest a potential breakout in the near term.",
                   "url", "#", "source", "StockSense", "publishedAt", now, "urlToImage", "")
        );
    }

    private List<Map<String, Object>> filterByRange(
            List<Map<String, Object>> all, String range) {
        if (all == null || all.isEmpty()) return Collections.emptyList();
        long nowSec    = System.currentTimeMillis() / 1000L;
        long cutoffSec = switch (range.toUpperCase()) {
            case "1W"  -> nowSec - 7L   * 86400;
            case "1M"  -> nowSec - 30L  * 86400;
            case "1Y"  -> nowSec - 365L * 86400;
            default    -> 0L;
        };
        final long cut = cutoffSec;
        return all.stream()
                .filter(c -> ((Number) c.getOrDefault("time", 0L)).longValue() >= cut)
                .toList();
    }

    private List<Map<String, Object>> generateMockCandles(String range) {
        int days = switch (range.toUpperCase()) {
            case "1D"  -> 78;
            case "1W"  -> 7;
            case "1M"  -> 30;
            case "1Y"  -> 252;
            default    -> 500;
        };
        List<Map<String, Object>> candles = new ArrayList<>();
        long   now   = System.currentTimeMillis() / 1000L;
        double price = 3500;
        for (int i = days; i >= 0; i--) {
            long   time  = now - (long) i * 86400;
            double open  = price;
            double high  = open  * (1 + Math.random() * 0.02);
            double low   = open  * (1 - Math.random() * 0.02);
            double close = low   + Math.random() * (high - low);
            price = close;
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("time",   time);
            c.put("open",   Math.round(open  * 100.0) / 100.0);
            c.put("high",   Math.round(high  * 100.0) / 100.0);
            c.put("low",    Math.round(low   * 100.0) / 100.0);
            c.put("close",  Math.round(close * 100.0) / 100.0);
            c.put("volume", (long)(Math.random() * 2_000_000 + 500_000));
            candles.add(c);
        }
        return candles;
    }

    private double parseDouble(Object val) {
        if (val == null) return 0.0;
        try { return Double.parseDouble(val.toString()); }
        catch (NumberFormatException e) { return 0.0; }
    }
}