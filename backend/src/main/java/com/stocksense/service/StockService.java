package com.stocksense.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * StockService
 *
 * All caching is now delegated to Spring's @Cacheable, backed by Redis
 * (via CacheConfig). The internal Caffeine Cache<> fields have been removed.
 *
 * Cache names + TTLs (defined in CacheConfig):
 *   stockQuote   → 15 min
 *   stockHistory → 60 min
 *   stockSearch  →  5 min
 *   batchQuotes  → 15 min
 *   marketList   → 24 hr
 */
@Service
public class StockService {

    private static final Logger log = LoggerFactory.getLogger(StockService.class);

    @Value("${alphavantage.api.key:demo}")
    private String alphaVantageKey;

    @Autowired
    private StringRedisTemplate redisTemplate;

    private static final String PRICE_KEY_PREFIX = "price:";

    private final HttpClient   http   = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build();

    private final ObjectMapper mapper = new ObjectMapper();

    private static final String YF_USER_AGENT    = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final String YF_ACCEPT        = "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8";
    private static final String YF_ACCEPT_LANG   = "en-US,en;q=0.9";

    private HttpRequest.Builder yahooRequest(String url) {
        return HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("User-Agent",      YF_USER_AGENT)
            .header("Accept",          YF_ACCEPT)
            .header("Accept-Language", YF_ACCEPT_LANG)
            .header("Accept-Encoding", "identity")
            .header("Cache-Control",   "no-cache")
            .header("Pragma",          "no-cache")
            .header("Origin",          "https://finance.yahoo.com")
            .header("Referer",         "https://finance.yahoo.com/")
            .GET();
    }

    // ── resolveSymbol ─────────────────────────────────────────────────────────

    public static String resolveSymbol(String symbol, String market) {
        if (symbol == null) return null;
        String s = symbol.trim().toUpperCase();
        if ("IN".equalsIgnoreCase(market) && !s.contains(".")) return s + ".NS";
        return s;
    }

    // ── getQuote ──────────────────────────────────────────────────────────────
    //
    // Cache key = symbol (upper-cased before call).
    // Falls back to Alpha Vantage if Yahoo returns nothing.
    // ─────────────────────────────────────────────────────────────────────────

    @Cacheable(value = "stockQuote", key = "#symbol.toUpperCase()", unless = "#result == null || #result.isEmpty()")
    public Map<String, Object> getQuote(String symbol) {
        log.debug("Cache miss — checking Redis price key for {}", symbol);

        // 1. Check Redis price:{symbol} written by PriceIngestionService
        try {
            String json = redisTemplate.opsForValue().get(PRICE_KEY_PREFIX + symbol.toUpperCase());
            if (json != null) {
                ObjectMapper om = new ObjectMapper();
                Map<String, Object> cached = om.readValue(json,
                    om.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
                log.debug("Redis price hit for {}", symbol);
                return cached;
            }
        } catch (Exception e) {
            log.warn("Redis price read failed for {}: {}", symbol, e.getMessage());
        }

        // 2. Fall back to direct API fetch
        log.debug("Redis miss — fetching live quote for {}", symbol);
        Map<String, Object> result = fetchYahooQuote(symbol);
        if (result == null || result.isEmpty()) {
            log.warn("Yahoo Finance failed for {}, falling back to Alpha Vantage", symbol);
            result = fetchAlphaVantageQuote(symbol);
        }
        return result != null ? result : Collections.emptyMap();
    }

    @CacheEvict(value = "stockQuote", key = "#symbol.toUpperCase()")
    public void invalidateQuote(String symbol) {
        log.debug("Evicted stockQuote cache for {}", symbol);
    }

    // ── getLivePrice ──────────────────────────────────────────────────────────

    public double getLivePrice(String symbol) {
        Map<String, Object> quote = getQuote(symbol);
        if (quote == null || quote.isEmpty()) return 0;
        Object priceObj = quote.get("price");
        return priceObj instanceof Number ? ((Number) priceObj).doubleValue() : 0;
    }

    // ── getHistory ────────────────────────────────────────────────────────────

    @Cacheable(value = "stockHistory", key = "#symbol + ':' + #range + ':' + #interval", unless = "#result == null || #result.isEmpty()")
    public List<Map<String, Object>> getHistory(String symbol, String range, String interval) {
        log.debug("Cache miss — fetching history for {} range={} interval={}", symbol, range, interval);
        List<Map<String, Object>> result = fetchYahooHistory(symbol, range, interval);
        if (result == null || result.isEmpty()) result = fetchAlphaVantageHistory(symbol);
        return result != null ? result : Collections.emptyList();
    }

    // ── getMarketOverview ─────────────────────────────────────────────────────

    @Cacheable(value = "marketList", key = "#market.toUpperCase()", unless = "#result == null || #result.isEmpty()")
    public List<Map<String, Object>> getMarketOverview(String market) {
        log.debug("Cache miss — fetching market overview for {}", market);
        List<String> symbols = switch (market.toUpperCase()) {
            case "US" -> List.of("AAPL","MSFT","GOOGL","AMZN","NVDA","TSLA","META","AMD");
            case "IN" -> List.of("RELIANCE.NS","TCS.NS","INFY.NS","HDFCBANK.NS","ICICIBANK.NS");
            case "FX" -> List.of("EURUSD=X","GBPUSD=X","USDJPY=X","USDCHF=X","AUDUSD=X");
            default   -> List.of("AAPL","MSFT","GOOGL","NVDA");
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
        return results;
    }

    // ── searchSymbol ──────────────────────────────────────────────────────────

    @Cacheable(value = "stockSearch", key = "#query.toLowerCase().trim()", unless = "#result == null || #result.isEmpty()")
    public List<Map<String, Object>> searchSymbol(String query) {
        log.debug("Cache miss — searching symbols for '{}'", query);
        try {
            String url = "https://query1.finance.yahoo.com/v1/finance/search?q="
                + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8)
                + "&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=false"
                + "&enableCb=false&enableNavLinks=false&enableEnhancedTrivialQuery=true";

            HttpRequest req = yahooRequest(url).timeout(Duration.ofSeconds(8)).build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) return Collections.emptyList();

            JsonNode root   = mapper.readTree(resp.body());
            JsonNode quotes = root.path("quotes");
            List<Map<String, Object>> results = new ArrayList<>();

            for (JsonNode q : quotes) {
                String quoteType = q.path("quoteType").asText();
                String type = switch (quoteType.toUpperCase()) {
                    case "EQUITY"         -> "EQUITY";
                    case "ETF"            -> "ETF";
                    case "CRYPTOCURRENCY" -> "CRYPTOCURRENCY";
                    case "CURRENCY"       -> "CURRENCY";
                    case "MUTUALFUND"     -> "MUTUALFUND";
                    case "INDEX"          -> "INDEX";
                    default               -> quoteType.toUpperCase();
                };
                String exch = q.path("exchange").asText().toUpperCase();
                String region = switch (exch) {
                    case "BSE","NSE","BOM","NSI" -> "India";
                    case "NMS","NYQ","NGM","PCX" -> "United States";
                    default -> q.path("region").asText("");
                };
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("symbol",   q.path("symbol").asText());
                item.put("name",     q.path("longname").asText(q.path("shortname").asText()));
                item.put("exchange", q.path("exchange").asText());
                item.put("type",     type);
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

    // ── getTopCrypto ──────────────────────────────────────────────────────────
    // Short TTL (2 min) — crypto moves fast. Defined as default TTL fallback.

    @Cacheable(value = "stockQuote", key = "'crypto:top:' + #limit", unless = "#result == null || #result.isEmpty()")
    public List<Map<String, Object>> getTopCrypto(int limit) {
        log.debug("Cache miss — fetching top {} crypto", limit);
        try {
            String url = "https://api.coingecko.com/api/v3/coins/markets"
                + "?vs_currency=usd&order=market_cap_desc&per_page=" + limit
                + "&page=1&sparkline=false&price_change_percentage=24h";

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "application/json")
                .GET().timeout(Duration.ofSeconds(10)).build();

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
            return results;
        } catch (Exception e) {
            log.error("CoinGecko fetch error: {}", e.getMessage());
            return getMockCrypto();
        }
    }

    @Cacheable(value = "stockQuote", key = "'crypto:' + #coinId", unless = "#result == null || #result.isEmpty()")
    public Map<String, Object> getCryptoQuote(String coinId) {
        log.debug("Cache miss — fetching crypto quote for {}", coinId);
        try {
            String url = "https://api.coingecko.com/api/v3/simple/price"
                + "?ids=" + coinId + "&vs_currencies=usd&include_24hr_change=true"
                + "&include_24hr_vol=true&include_market_cap=true";

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url)).header("Accept","application/json")
                .GET().timeout(Duration.ofSeconds(8)).build();

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

    @Cacheable(value = "stockHistory", key = "'crypto:history:' + #coinId + ':' + #range", unless = "#result == null || #result.isEmpty()")
    public List<Map<String, Object>> getCryptoHistory(String coinId, String range) {
        log.debug("Cache miss — fetching crypto history for {} range={}", coinId, range);
        try {
            int days = switch (range.toUpperCase()) {
                case "1D"  -> 1;
                case "1W"  -> 7;
                case "1M"  -> 30;
                case "1Y"  -> 365;
                case "ALL" -> 1825;
                default    -> 30;
            };
            String url = "https://api.coingecko.com/api/v3/coins/" + coinId + "/ohlc?vs_currency=usd&days=" + days;

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url)).header("Accept","application/json")
                .GET().timeout(Duration.ofSeconds(10)).build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 429) { log.warn("CoinGecko rate limit hit for history: {}", coinId); return Collections.emptyList(); }
            if (resp.statusCode() != 200)  return Collections.emptyList();

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
            return candles;
        } catch (Exception e) {
            log.error("CoinGecko history error for {}: {}", coinId, e.getMessage());
            return Collections.emptyList();
        }
    }

    // ── getCacheStats — now reports Redis key counts via Spring CacheManager ──
    // (Removed — Redis doesn't expose estimatedSize like Caffeine.
    //  Use Spring Actuator /actuator/caches or RedisInsight instead.)

    // ── Private fetch helpers (no caching — called by @Cacheable methods) ────

    private Map<String, Object> fetchYahooQuote(String symbol) {
        try {
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol
                + "?interval=1d&range=5d&includePrePost=false";

            HttpRequest req = yahooRequest(url).timeout(Duration.ofSeconds(8)).build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) { log.warn("Yahoo quote HTTP {} for {}", resp.statusCode(), symbol); return null; }

            JsonNode root    = mapper.readTree(resp.body());
            JsonNode result0 = root.path("chart").path("result");
            if (!result0.isArray() || result0.isEmpty()) return null;

            JsonNode node = result0.get(0);
            JsonNode meta = node.path("meta");
            double price  = meta.path("regularMarketPrice").asDouble();
            if (price == 0) return null;

            double prevClose = meta.path("previousClose").asDouble();
            if (prevClose == 0) prevClose = meta.path("chartPreviousClose").asDouble();
            if (prevClose == 0) {
                JsonNode closes = node.path("indicators").path("quote").path(0).path("close");
                if (closes.isArray() && closes.size() >= 2) {
                    double last = 0, secondLast = 0;
                    for (int i = closes.size() - 1; i >= 0; i--) {
                        JsonNode c = closes.get(i);
                        if (!c.isNull() && c.asDouble() > 0) {
                            if (last == 0) last = c.asDouble();
                            else { secondLast = c.asDouble(); break; }
                        }
                    }
                    if (secondLast > 0) prevClose = secondLast;
                }
            }

            double change    = price - prevClose;
            double changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

            Map<String, Object> quote = new LinkedHashMap<>();
            quote.put("symbol",        symbol.toUpperCase());
            quote.put("name",          meta.path("longName").asText(meta.path("shortName").asText(symbol)));
            quote.put("price",         Math.round(price     * 100.0) / 100.0);
            quote.put("previousClose", Math.round(prevClose * 100.0) / 100.0);
            quote.put("open",          meta.path("regularMarketOpen").asDouble());
            quote.put("high",          meta.path("regularMarketDayHigh").asDouble());
            quote.put("low",           meta.path("regularMarketDayLow").asDouble());
            quote.put("volume",        meta.path("regularMarketVolume").asLong());
            quote.put("marketCap",     meta.path("marketCap").asLong());
            quote.put("currency",      meta.path("currency").asText("USD"));
            quote.put("exchange",      meta.path("exchangeName").asText());
            quote.put("change",        Math.round(change    * 100.0) / 100.0);
            quote.put("changePct",     Math.round(changePct * 100.0) / 100.0);
            quote.put("source",        "yahoo");
            return quote;
        } catch (Exception e) {
            log.error("Yahoo Finance quote error for {}: {}", symbol, e.getMessage());
            return null;
        }
    }

    private Map<String, Object> fetchAlphaVantageQuote(String symbol) {
        try {
            String url = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=" + symbol + "&apikey=" + alphaVantageKey;
            HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url)).GET().timeout(Duration.ofSeconds(10)).build();
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
            quote.put("changePct",     Double.parseDouble(q.path("10. change percent").asText("0%").replace("%","").trim()));
            quote.put("source",        "alphavantage");
            return quote;
        } catch (Exception e) {
            log.error("Alpha Vantage quote error for {}: {}", symbol, e.getMessage());
            return null;
        }
    }

    private List<Map<String, Object>> fetchYahooHistory(String symbol, String range, String interval) {
        try {
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol
                + "?interval=" + interval + "&range=" + range + "&includePrePost=false";

            HttpRequest req = yahooRequest(url).timeout(Duration.ofSeconds(12)).build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) return null;

            JsonNode root   = mapper.readTree(resp.body());
            JsonNode result = root.path("chart").path("result");
            if (!result.isArray() || result.isEmpty()) return null;

            JsonNode r0         = result.get(0);
            JsonNode timestamps = r0.path("timestamp");
            JsonNode ohlcv      = r0.path("indicators").path("quote").get(0);
            if (ohlcv == null) return null;

            List<Map<String, Object>> candles = new ArrayList<>();
            for (int i = 0; i < timestamps.size(); i++) {
                try {
                    JsonNode openNode  = ohlcv.path("open").get(i);
                    JsonNode closeNode = ohlcv.path("close").get(i);
                    if (openNode == null || openNode.isNull()) continue;
                    if (closeNode == null || closeNode.isNull()) continue;
                    double open = openNode.asDouble(), close = closeNode.asDouble();
                    if (open == 0 && close == 0) continue;

                    Map<String, Object> candle = new LinkedHashMap<>();
                    candle.put("timestamp", timestamps.get(i).asLong());
                    candle.put("open",   Math.round(open  * 100.0) / 100.0);
                    candle.put("high",   Math.round(ohlcv.path("high").get(i).asDouble()  * 100.0) / 100.0);
                    candle.put("low",    Math.round(ohlcv.path("low").get(i).asDouble()   * 100.0) / 100.0);
                    candle.put("close",  Math.round(close * 100.0) / 100.0);
                    candle.put("volume", ohlcv.path("volume").get(i).asLong());
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
            String url = "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=" + symbol + "&outputsize=compact&apikey=" + alphaVantageKey;
            HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url)).GET().timeout(Duration.ofSeconds(15)).build();
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

    private List<Map<String, Object>> getMockCrypto() {
        return List.of(
            Map.of("symbol","BTC","name","Bitcoin",  "price",67420.0,"changePct", 2.45,"source","mock"),
            Map.of("symbol","ETH","name","Ethereum", "price", 3580.0,"changePct", 1.87,"source","mock"),
            Map.of("symbol","SOL","name","Solana",   "price",  185.0,"changePct",-0.93,"source","mock")
        );
    }
}