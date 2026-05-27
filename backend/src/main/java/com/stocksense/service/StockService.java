package com.stocksense.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
            .followRedirects(java.net.http.HttpClient.Redirect.NORMAL)
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    // ─── Yahoo Finance headers — fixes geo-blocking / 401 / 429 ────────────
    // These mirror a real browser session well enough to pass Yahoo's gate.
    private static final String YF_USER_AGENT =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36";

    private static final String YF_ACCEPT =
        "text/html,application/xhtml+xml,application/xml;q=0.9," +
        "application/json,*/*;q=0.8";

    private static final String YF_ACCEPT_LANGUAGE = "en-US,en;q=0.9";

    /** Build a Yahoo Finance HTTP request with all anti-block headers set. */
    private HttpRequest.Builder yahooRequest(String url) {
        return HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent",       YF_USER_AGENT)
                .header("Accept",           YF_ACCEPT)
                .header("Accept-Language",  YF_ACCEPT_LANGUAGE)
                .header("Accept-Encoding",  "identity")   // no gzip — keeps body readable
                .header("Cache-Control",    "no-cache")
                .header("Pragma",           "no-cache")
                .header("Origin",           "https://finance.yahoo.com")
                .header("Referer",          "https://finance.yahoo.com/")
                .GET();
    }

    // ─── Caches ─────────────────────────────────────────────────────────────
    private final Cache<String, Map<String, Object>> quoteCache = Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .maximumSize(500)
            .build();

    private final Cache<String, List<Map<String, Object>>> historyCache = Caffeine.newBuilder()
            .expireAfterWrite(30, TimeUnit.MINUTES)
            .maximumSize(200)
            .build();

    private final Cache<String, List<Map<String, Object>>> marketCache = Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .maximumSize(10)
            .build();

    private final Cache<String, List<Map<String, Object>>> cryptoCache = Caffeine.newBuilder()
            .expireAfterWrite(2, TimeUnit.MINUTES)
            .maximumSize(10)
            .build();

    // ─── BSE suffix helper ───────────────────────────────────────────────────
    public static String resolveSymbol(String symbol, String market) {
        if (symbol == null) return null;
        String s = symbol.trim().toUpperCase();
        if ("IN".equalsIgnoreCase(market) && !s.contains(".")) {
            return s + ".NS";
        }
        return s;
    }

    // ─── Quote (Yahoo Finance primary, Alpha Vantage fallback) ───────────────
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
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol
                    + "?interval=1d&range=1d&includePrePost=false";

            HttpRequest req = yahooRequest(url)
                    .timeout(Duration.ofSeconds(8))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("Yahoo quote HTTP {} for symbol {}", resp.statusCode(), symbol);
                return null;
            }

            JsonNode root = mapper.readTree(resp.body());
            JsonNode result0 = root.path("chart").path("result");
            if (!result0.isArray() || result0.size() == 0) return null;
            JsonNode meta = result0.get(0).path("meta");

            Map<String, Object> quote = new LinkedHashMap<>();
            quote.put("symbol",        symbol.toUpperCase());
            quote.put("name",          meta.path("longName").asText(symbol));
            quote.put("price",         meta.path("regularMarketPrice").asDouble());
            quote.put("previousClose", meta.path("previousClose").asDouble());
            quote.put("open",          meta.path("regularMarketOpen").asDouble());
            quote.put("high",          meta.path("regularMarketDayHigh").asDouble());
            quote.put("low",           meta.path("regularMarketDayLow").asDouble());
            quote.put("volume",        meta.path("regularMarketVolume").asLong());
            quote.put("marketCap",     meta.path("marketCap").asLong());
            quote.put("currency",      meta.path("currency").asText("USD"));
            quote.put("exchange",      meta.path("exchangeName").asText());

            double price     = meta.path("regularMarketPrice").asDouble();
            double prevClose = meta.path("previousClose").asDouble();
            double change    = price - prevClose;
            double changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
            quote.put("change",    Math.round(change    * 100.0) / 100.0);
            quote.put("changePct", Math.round(changePct * 100.0) / 100.0);
            quote.put("source",    "yahoo");

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
            JsonNode q    = root.path("Global Quote");

            if (q.isMissingNode() || q.isEmpty()) return null;

            Map<String, Object> quote = new LinkedHashMap<>();
            quote.put("symbol",        q.path("01. symbol").asText());
            quote.put("price",         Double.parseDouble(q.path("05. price").asText("0")));
            quote.put("previousClose", Double.parseDouble(q.path("08. previous close").asText("0")));
            quote.put("open",          Double.parseDouble(q.path("02. open").asText("0")));
            quote.put("high",          Double.parseDouble(q.path("03. high").asText("0")));
            quote.put("low",           Double.parseDouble(q.path("04. low").asText("0")));
            quote.put("volume",        Long.parseLong(q.path("06. volume").asText("0")));
            quote.put("change",        Double.parseDouble(q.path("09. change").asText("0")));
            quote.put("changePct",     Double.parseDouble(
                    q.path("10. change percent").asText("0%").replace("%", "").trim()));
            quote.put("source", "alphavantage");
            return quote;
        } catch (Exception e) {
            log.error("Alpha Vantage quote error for {}: {}", symbol, e.getMessage());
            return null;
        }
    }

    // ─── Get Live Price (convenience) ────────────────────────────────────────
    public double getLivePrice(String symbol) {
        Map<String, Object> quote = getQuote(symbol);
        if (quote == null || quote.isEmpty()) return 0;
        Object priceObj = quote.get("price");
        return priceObj instanceof Number ? ((Number) priceObj).doubleValue() : 0;
    }

    // ─── Historical Data ──────────────────────────────────────────────────────
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
                    + "?interval=" + interval + "&range=" + range + "&includePrePost=false";

            HttpRequest req = yahooRequest(url)
                    .timeout(Duration.ofSeconds(12))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("Yahoo history HTTP {} for symbol {}", resp.statusCode(), symbol);
                return null;
            }

            JsonNode root    = mapper.readTree(resp.body());
            JsonNode result0 = root.path("chart").path("result");
            if (!result0.isArray() || result0.size() == 0) return null;
            JsonNode result  = result0.get(0);

            JsonNode timestamps = result.path("timestamp");
            JsonNode ohlcv      = result.path("indicators").path("quote").get(0);
            if (ohlcv == null) return null;

            List<Map<String, Object>> candles = new ArrayList<>();
            for (int i = 0; i < timestamps.size(); i++) {
                try {
                    JsonNode openNode   = ohlcv.path("open").get(i);
                    JsonNode closeNode  = ohlcv.path("close").get(i);
                    if (openNode  == null || openNode.isNull())  continue;
                    if (closeNode == null || closeNode.isNull()) continue;

                    double open   = openNode.asDouble();
                    double high   = ohlcv.path("high").get(i).asDouble();
                    double low    = ohlcv.path("low").get(i).asDouble();
                    double close  = closeNode.asDouble();
                    long   volume = ohlcv.path("volume").get(i).asLong();

                    if (open == 0 && close == 0) continue;

                    Map<String, Object> candle = new LinkedHashMap<>();
                    // Store as seconds — LightweightCharts expects Unix seconds
                    candle.put("timestamp", timestamps.get(i).asLong());
                    candle.put("open",   Math.round(open  * 100.0) / 100.0);
                    candle.put("high",   Math.round(high  * 100.0) / 100.0);
                    candle.put("low",    Math.round(low   * 100.0) / 100.0);
                    candle.put("close",  Math.round(close * 100.0) / 100.0);
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
            JsonNode root   = mapper.readTree(resp.body());
            JsonNode series = root.path("Time Series (Daily)");
            if (series.isMissingNode()) return null;

            List<Map<String, Object>> candles = new ArrayList<>();
            series.fields().forEachRemaining(entry -> {
                JsonNode day = entry.getValue();
                Map<String, Object> candle = new LinkedHashMap<>();
                candle.put("date",   entry.getKey());
                candle.put("open",   Double.parseDouble(day.path("1. open").asText("0")));
                candle.put("high",   Double.parseDouble(day.path("2. high").asText("0")));
                candle.put("low",    Double.parseDouble(day.path("3. low").asText("0")));
                candle.put("close",  Double.parseDouble(day.path("4. close").asText("0")));
                candle.put("volume", Long.parseLong(day.path("6. volume").asText("0")));
                candles.add(candle);
            });

            Collections.reverse(candles);
            return candles;
        } catch (Exception e) {
            log.error("Alpha Vantage history error: {}", e.getMessage());
            return null;
        }
    }

    // ─── Market Overview ─────────────────────────────────────────────────────
    public List<Map<String, Object>> getMarketOverview(String market) {
        String cacheKey = "market:" + market;
        List<Map<String, Object>> cached = marketCache.getIfPresent(cacheKey);
        if (cached != null) return cached;

        List<String> symbols = switch (market.toUpperCase()) {
            case "US" -> List.of("AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD");
            case "IN" -> List.of("RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS");
            case "FX" -> List.of("EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X", "AUDUSD=X");
            default   -> List.of("AAPL", "MSFT", "GOOGL", "NVDA");
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
            if (resp.statusCode() == 429) { log.warn("CoinGecko rate limit hit"); return getMockCrypto(); }
            if (resp.statusCode() != 200)  return getMockCrypto();

            JsonNode arr = mapper.readTree(resp.body());
            List<Map<String, Object>> results = new ArrayList<>();

            for (JsonNode coin : arr) {
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("id",        coin.path("id").asText());
                c.put("symbol",    coin.path("symbol").asText().toUpperCase());
                c.put("name",      coin.path("name").asText());
                c.put("price",     coin.path("current_price").asDouble());
                c.put("change",    coin.path("price_change_24h").asDouble());
                c.put("changePct", coin.path("price_change_percentage_24h").asDouble());
                c.put("marketCap", coin.path("market_cap").asLong());
                c.put("volume",    coin.path("total_volume").asLong());
                c.put("image",     coin.path("image").asText());
                c.put("high24h",   coin.path("high_24h").asDouble());
                c.put("low24h",    coin.path("low_24h").asDouble());
                c.put("source",    "coingecko");
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
            result.put("id",        coinId);
            result.put("price",     data.path("usd").asDouble());
            result.put("changePct", data.path("usd_24h_change").asDouble());
            result.put("volume",    data.path("usd_24h_vol").asDouble());
            result.put("marketCap", data.path("usd_market_cap").asDouble());
            result.put("source",    "coingecko");
            return result;
        } catch (Exception e) {
            log.error("CoinGecko single quote error for {}: {}", coinId, e.getMessage());
            return Collections.emptyMap();
        }
    }

    public List<Map<String, Object>> getCryptoHistory(String coinId, String range) {
        String cacheKey = "crypto:history:" + coinId + ":" + range;
        List<Map<String, Object>> cached = cryptoCache.getIfPresent(cacheKey);
        if (cached != null) return cached;

        try {
            int days = switch (range.toUpperCase()) {
                case "1D"  -> 1;
                case "1W"  -> 7;
                case "1M"  -> 30;
                case "1Y"  -> 365;
                case "ALL" -> 1825;
                default    -> 30;
            };

            String url = "https://api.coingecko.com/api/v3/coins/" + coinId
                + "/ohlc?vs_currency=usd&days=" + days;

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "application/json")
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() == 429) {
                log.warn("CoinGecko rate limit hit for history: {}", coinId);
                return Collections.emptyList();
            }
            if (resp.statusCode() != 200) return Collections.emptyList();

            JsonNode arr = mapper.readTree(resp.body());
            List<Map<String, Object>> candles = new ArrayList<>();

            for (JsonNode row : arr) {
                if (row.size() < 5) continue;
                Map<String, Object> candle = new LinkedHashMap<>();
                candle.put("time",   row.get(0).asLong() / 1000L);
                candle.put("open",   Math.round(row.get(1).asDouble() * 100.0) / 100.0);
                candle.put("high",   Math.round(row.get(2).asDouble() * 100.0) / 100.0);
                candle.put("low",    Math.round(row.get(3).asDouble() * 100.0) / 100.0);
                candle.put("close",  Math.round(row.get(4).asDouble() * 100.0) / 100.0);
                candle.put("volume", 0L);
                candles.add(candle);
            }

            if (!candles.isEmpty()) cryptoCache.put(cacheKey, candles);
            return candles;

        } catch (Exception e) {
            log.error("CoinGecko history error for {}: {}", coinId, e.getMessage());
            return Collections.emptyList();
        }
    }

    // ─── Search — full Yahoo Finance headers to fix geo-blocking ─────────────
    public List<Map<String, Object>> searchSymbol(String query) {
        try {
            String url = "https://query1.finance.yahoo.com/v1/finance/search?q="
                    + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8)
                    + "&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=false"
                    + "&enableCb=false&enableNavLinks=false&enableEnhancedTrivialQuery=true";

            HttpRequest req = yahooRequest(url)
                    .timeout(Duration.ofSeconds(8))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("Yahoo search HTTP {} for query '{}'", resp.statusCode(), query);
                return Collections.emptyList();
            }

            JsonNode root   = mapper.readTree(resp.body());
            JsonNode quotes = root.path("quotes");

            List<Map<String, Object>> results = new ArrayList<>();
            for (JsonNode q : quotes) {
                String quoteType = q.path("quoteType").asText();
                // Normalise to our type vocabulary
                String type = switch (quoteType.toUpperCase()) {
                    case "EQUITY"       -> "EQUITY";
                    case "ETF"          -> "ETF";
                    case "CRYPTOCURRENCY" -> "CRYPTOCURRENCY";
                    case "CURRENCY"     -> "CURRENCY";
                    case "MUTUALFUND"   -> "MUTUALFUND";
                    case "INDEX"        -> "INDEX";
                    case "FUTURE"       -> "FUTURE";
                    case "OPTION"       -> "OPTION";
                    default             -> quoteType.toUpperCase();
                };

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("symbol",   q.path("symbol").asText());
                item.put("name",     q.path("longname").asText(q.path("shortname").asText()));
                item.put("exchange", q.path("exchange").asText());
                item.put("type",     type);
                // Derive region from exchange for Indian stocks
                String exch = q.path("exchange").asText().toUpperCase();
                String region;
                if (exch.equals("BSE") || exch.equals("NSE") || exch.equals("BOM") || exch.equals("NSI")) {
                    region = "India";
                } else if (exch.equals("NMS") || exch.equals("NYQ") || exch.equals("NGM") || exch.equals("PCX")) {
                    region = "United States";
                } else {
                    region = q.path("region").asText("");
                }
                item.put("region",   region);
                item.put("currency", q.path("currency").asText("USD"));
                results.add(item);
            }
            return results;
        } catch (Exception e) {
            log.error("Symbol search error for '{}': {}", query, e.getMessage());
            return Collections.emptyList();
        }
    }

    // ─── Cache management ────────────────────────────────────────────────────
    public void invalidateQuote(String symbol) {
        quoteCache.invalidate(symbol.toUpperCase());
    }

    public Map<String, Long> getCacheStats() {
        return Map.of(
                "quoteSize",   quoteCache.estimatedSize(),
                "historySize", historyCache.estimatedSize(),
                "marketSize",  marketCache.estimatedSize(),
                "cryptoSize",  cryptoCache.estimatedSize()
        );
    }

    // ─── Fallbacks ───────────────────────────────────────────────────────────
    private List<Map<String, Object>> getMockCrypto() {
        return List.of(
                Map.of("symbol","BTC","name","Bitcoin",  "price",67420.0,"changePct", 2.45,"source","mock"),
                Map.of("symbol","ETH","name","Ethereum", "price", 3580.0,"changePct", 1.87,"source","mock"),
                Map.of("symbol","SOL","name","Solana",   "price",  185.0,"changePct",-0.93,"source","mock")
        );
    }
}