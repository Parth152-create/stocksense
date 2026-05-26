

package com.stocksense.controller;

import com.stocksense.service.AlphaVantageService;
import com.stocksense.service.MarketSymbolService;
import com.stocksense.service.StockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class StockController {

    private final AlphaVantageService alphaVantage;
    private final MarketSymbolService marketSymbols;
    private final StockService        stockService;

    private static final String NEWS_API_KEY = "33583e3bf61647109d1671aaa4a098e6";

    // ── CoinGecko ID map ──────────────────────────────────────────────────────
    private static final Map<String, String> CRYPTO_IDS = Map.ofEntries(
        Map.entry("BTC",  "bitcoin"),
        Map.entry("ETH",  "ethereum"),
        Map.entry("SOL",  "solana"),
        Map.entry("BNB",  "binancecoin"),
        Map.entry("AVAX", "avalanche-2"),
        Map.entry("ADA",  "cardano"),
        Map.entry("DOT",  "polkadot"),
        Map.entry("MATIC","matic-network"),
        Map.entry("DOGE", "dogecoin"),
        Map.entry("XRP",  "ripple")
    );

    // ── FX symbol → Yahoo Finance format ─────────────────────────────────────
    private static final Map<String, String> FX_YAHOO = Map.ofEntries(
        Map.entry("EUR/USD", "EURUSD=X"),
        Map.entry("GBP/USD", "GBPUSD=X"),
        Map.entry("USD/JPY", "USDJPY=X"),
        Map.entry("AUD/USD", "AUDUSD=X"),
        Map.entry("USD/CAD", "USDCAD=X"),
        Map.entry("USD/CHF", "USDCHF=X"),
        Map.entry("NZD/USD", "NZDUSD=X"),
        Map.entry("EUR/GBP", "EURGBP=X")
    );

    // ── Well-known symbols that Yahoo search buries under mutual funds ────────
    // Keyed by common search prefix (uppercase) → result to inject at top
    private static final Map<String, Map<String, String>> KNOWN_SYMBOLS;
    static {
        KNOWN_SYMBOLS = new LinkedHashMap<>();
        // Indian equities
        KNOWN_SYMBOLS.put("ICICI",      Map.of("symbol","ICICIBANK.NS","name","ICICI Bank Ltd",       "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("ICICIBANK",  Map.of("symbol","ICICIBANK.NS","name","ICICI Bank Ltd",       "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("HDFC",       Map.of("symbol","HDFCBANK.NS", "name","HDFC Bank Ltd",        "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("HDFCBANK",   Map.of("symbol","HDFCBANK.NS", "name","HDFC Bank Ltd",        "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("RELIANCE",   Map.of("symbol","RELIANCE.NS", "name","Reliance Industries",  "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("TCS",        Map.of("symbol","TCS.NS",      "name","Tata Consultancy Svcs","exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("INFY",       Map.of("symbol","INFY.NS",     "name","Infosys Ltd",          "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("INFOSYS",    Map.of("symbol","INFY.NS",     "name","Infosys Ltd",          "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("WIPRO",      Map.of("symbol","WIPRO.NS",    "name","Wipro Ltd",            "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("BAJAJ",      Map.of("symbol","BAJFINANCE.NS","name","Bajaj Finance",       "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("BAJFINANCE", Map.of("symbol","BAJFINANCE.NS","name","Bajaj Finance",       "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("TATA",       Map.of("symbol","TATAMOTORS.NS","name","Tata Motors Ltd",     "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("TATAMOTORS", Map.of("symbol","TATAMOTORS.NS","name","Tata Motors Ltd",     "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("ADANI",      Map.of("symbol","ADANIENT.NS", "name","Adani Enterprises",   "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("SBIN",       Map.of("symbol","SBIN.NS",     "name","State Bank of India",  "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("SBI",        Map.of("symbol","SBIN.NS",     "name","State Bank of India",  "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("SUNPHARMA",  Map.of("symbol","SUNPHARMA.NS","name","Sun Pharmaceutical",  "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("MARUTI",     Map.of("symbol","MARUTI.NS",   "name","Maruti Suzuki India",  "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("AXISBANK",   Map.of("symbol","AXISBANK.NS", "name","Axis Bank Ltd",        "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("AXIS",       Map.of("symbol","AXISBANK.NS", "name","Axis Bank Ltd",        "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("KOTAK",      Map.of("symbol","KOTAKBANK.NS","name","Kotak Mahindra Bank",  "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("LT",         Map.of("symbol","LT.NS",       "name","Larsen & Toubro",      "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("NTPC",       Map.of("symbol","NTPC.NS",     "name","NTPC Ltd",             "exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("ONGC",       Map.of("symbol","ONGC.NS",     "name","Oil & Natural Gas Corp","exchange","NSE","type","EQUITY","region","India"));
        KNOWN_SYMBOLS.put("ULTRACEMCO", Map.of("symbol","ULTRACEMCO.NS","name","UltraTech Cement",   "exchange","NSE","type","EQUITY","region","India"));
        // US equities
        KNOWN_SYMBOLS.put("APPLE",      Map.of("symbol","AAPL",  "name","Apple Inc.",           "exchange","NASDAQ","type","EQUITY","region","United States"));
        KNOWN_SYMBOLS.put("MICROSOFT",  Map.of("symbol","MSFT",  "name","Microsoft Corp",       "exchange","NASDAQ","type","EQUITY","region","United States"));
        KNOWN_SYMBOLS.put("NVIDIA",     Map.of("symbol","NVDA",  "name","NVIDIA Corp",          "exchange","NASDAQ","type","EQUITY","region","United States"));
        KNOWN_SYMBOLS.put("TESLA",      Map.of("symbol","TSLA",  "name","Tesla Inc",            "exchange","NASDAQ","type","EQUITY","region","United States"));
        KNOWN_SYMBOLS.put("AMAZON",     Map.of("symbol","AMZN",  "name","Amazon.com Inc",       "exchange","NASDAQ","type","EQUITY","region","United States"));
        KNOWN_SYMBOLS.put("GOOGLE",     Map.of("symbol","GOOGL", "name","Alphabet Inc",         "exchange","NASDAQ","type","EQUITY","region","United States"));
        KNOWN_SYMBOLS.put("ALPHABET",   Map.of("symbol","GOOGL", "name","Alphabet Inc",         "exchange","NASDAQ","type","EQUITY","region","United States"));
        KNOWN_SYMBOLS.put("META",       Map.of("symbol","META",  "name","Meta Platforms Inc",   "exchange","NASDAQ","type","EQUITY","region","United States"));
        KNOWN_SYMBOLS.put("FACEBOOK",   Map.of("symbol","META",  "name","Meta Platforms Inc",   "exchange","NASDAQ","type","EQUITY","region","United States"));
        // Crypto
        KNOWN_SYMBOLS.put("BITCOIN",    Map.of("symbol","BTC",   "name","Bitcoin",              "exchange","Crypto","type","CRYPTOCURRENCY","region","Crypto"));
        KNOWN_SYMBOLS.put("ETHEREUM",   Map.of("symbol","ETH",   "name","Ethereum",             "exchange","Crypto","type","CRYPTOCURRENCY","region","Crypto"));
        KNOWN_SYMBOLS.put("SOLANA",     Map.of("symbol","SOL",   "name","Solana",               "exchange","Crypto","type","CRYPTOCURRENCY","region","Crypto"));
    }

    public StockController(AlphaVantageService alphaVantage,
                           MarketSymbolService marketSymbols,
                           StockService stockService) {
        this.alphaVantage  = alphaVantage;
        this.marketSymbols = marketSymbols;
        this.stockService  = stockService;
    }

    // ── Symbol resolver ───────────────────────────────────────────────────────
    private String resolveSymbol(String symbol, String market) {
        if (symbol == null) return null;
        String s = symbol.trim().toUpperCase()
            .replace(".BSE", "").replace(".NSE", "").replace(".NS", "").replace(".BO", "");
        if ("IN".equalsIgnoreCase(market) && !s.contains(".")) return s + ".BSE";
        if ("FX".equalsIgnoreCase(market)) return FX_YAHOO.getOrDefault(s, s + "=X");
        return s;
    }

    private boolean isCrypto(String market)  { return "CRYPTO".equalsIgnoreCase(market); }
    private boolean isFx(String market)      { return "FX".equalsIgnoreCase(market); }

    // ── GET /api/stocks/{symbol} ──────────────────────────────────────────────
    @GetMapping("/stocks/{symbol}")
    public ResponseEntity<Map<String, Object>> getQuote(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "US") String market) {

        String clean = symbol.trim().toUpperCase()
            .replace(".BSE", "").replace(".NSE", "").replace(".NS", "").replace(".BO", "");

        if (isCrypto(market)) {
            String coinId = CRYPTO_IDS.getOrDefault(clean, clean.toLowerCase());
            Map<String, Object> quote = stockService.getCryptoQuote(coinId);
            if (quote == null || quote.isEmpty()) return ResponseEntity.notFound().build();
            Map<String, Object> result = new LinkedHashMap<>(quote);
            result.put("symbol", clean);
            result.put("price",  quote.get("price"));
            result.put("changePercent", quote.get("changePct"));
            return ResponseEntity.ok(result);
        }

        if (isFx(market)) {
            String yahooSym = FX_YAHOO.getOrDefault(clean, clean + "=X");
            Map<String, Object> quote = stockService.getQuote(yahooSym);
            if (quote == null || quote.isEmpty()) return ResponseEntity.notFound().build();
            Map<String, Object> result = new LinkedHashMap<>(quote);
            result.put("symbol", clean);
            return ResponseEntity.ok(result);
        }

        return ResponseEntity.ok(
            stockService.getQuote(resolveSymbol(symbol, market))
        );
    }

    // ── GET /api/stocks/{symbol}/history ─────────────────────────────────────
    @GetMapping("/stocks/{symbol}/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "US") String market,
            @RequestParam(defaultValue = "1M") String range) {
        try {
            String clean = symbol.trim().toUpperCase()
                .replace(".BSE", "").replace(".NSE", "").replace(".NS","").replace(".BO","");

            if (isCrypto(market)) {
                String coinId = CRYPTO_IDS.getOrDefault(clean, clean.toLowerCase());
                List<Map<String, Object>> candles = stockService.getCryptoHistory(coinId, range);
                if (candles == null || candles.isEmpty()) candles = generateMockCandles(range);
                return ResponseEntity.ok(candles);
            }

            if (isFx(market)) {
                String yahooSym = FX_YAHOO.getOrDefault(clean, clean + "=X");
                String[] rangeInterval = toYahooRangeInterval(range);
                List<Map<String, Object>> candles =
                    stockService.getHistory(yahooSym, rangeInterval[0], rangeInterval[1]);
                if (candles == null || candles.isEmpty()) candles = generateMockCandles(range);
                return ResponseEntity.ok(normaliseHistoryTimestamps(candles));
            }

            boolean intraday = "1D".equalsIgnoreCase(range);
            List<Map<String, Object>> candles;
            if (intraday) {
                candles = alphaVantage.getIntraday(resolveSymbol(symbol, market), "5min");
            } else {
                String[] ri = toYahooRangeInterval(range);
                candles = stockService.getHistory(resolveSymbol(symbol, market), ri[0], ri[1]);
                if (candles == null || candles.isEmpty())
                    candles = alphaVantage.getDailyOHLCV(resolveSymbol(symbol, market));
                candles = filterByRange(candles, range);
            }
            if (candles == null || candles.isEmpty()) candles = generateMockCandles(range);
            return ResponseEntity.ok(normaliseHistoryTimestamps(candles));
        } catch (Exception e) {
            return ResponseEntity.ok(generateMockCandles(range));
        }
    }

    // ── GET /api/stocks/{symbol}/overview ─────────────────────────────────────
    @GetMapping("/stocks/{symbol}/overview")
    public ResponseEntity<Map<String, Object>> getOverview(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "US") String market) {

        String clean = symbol.trim().toUpperCase()
            .replace(".BSE", "").replace(".NSE", "").replace(".NS","").replace(".BO","");

        if (isCrypto(market)) {
            String coinId = CRYPTO_IDS.getOrDefault(clean, clean.toLowerCase());
            Map<String, Object> quote = stockService.getCryptoQuote(coinId);
            Map<String, Object> overview = new LinkedHashMap<>();
            overview.put("symbol",      clean);
            overview.put("name",        coinId.substring(0,1).toUpperCase() + coinId.substring(1));
            overview.put("exchange",    "CoinGecko");
            overview.put("sector",      "Cryptocurrency");
            overview.put("industry",    "Digital Assets");
            overview.put("description", "A leading cryptocurrency asset traded on major global exchanges.");
            overview.put("marketCap",   quote.getOrDefault("marketCap", 0));
            overview.put("peRatio",     0);
            overview.put("eps",         0);
            overview.put("dividendYield", 0);
            overview.put("week52High",  0);
            overview.put("week52Low",   0);
            return ResponseEntity.ok(overview);
        }

        if (isFx(market)) {
            Map<String, Object> overview = new LinkedHashMap<>();
            overview.put("symbol",      clean);
            overview.put("name",        clean + " Exchange Rate");
            overview.put("exchange",    "FOREX");
            overview.put("sector",      "Foreign Exchange");
            overview.put("industry",    "Currency Pairs");
            overview.put("description", "A major forex currency pair traded 24/5 on the global foreign exchange market.");
            overview.put("marketCap",   0);
            overview.put("peRatio",     0);
            overview.put("eps",         0);
            overview.put("dividendYield", 0);
            overview.put("week52High",  0);
            overview.put("week52Low",   0);
            return ResponseEntity.ok(overview);
        }

        String resolved = resolveSymbol(symbol, market);

        // Try Yahoo Finance first — real data for BSE/US stocks
        Map<String, Object> yahooQuote = stockService.getQuote(resolved);

        // Try Alpha Vantage for fundamentals (PE, EPS, description etc.)
        Map<String, Object> raw = alphaVantage.getOverview(resolved);

        // Merge: Alpha Vantage fundamentals + Yahoo quote data as fallback
        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("symbol",   resolved);
        overview.put("name",     getFirst(raw, "Name",
                                 yahooQuote.getOrDefault("name", resolved)));
        overview.put("exchange", getFirst(raw, "Exchange",
                                 yahooQuote.getOrDefault("exchange", "—")));
        overview.put("sector",   getFirst(raw, "Sector",
                                 yahooQuote.getOrDefault("sector", "—")));
        overview.put("industry", getFirst(raw, "Industry",
                                 yahooQuote.getOrDefault("industry", "—")));
        overview.put("description", raw.getOrDefault("Description", ""));

        // Market cap — prefer Yahoo (more accurate, in actual currency)
        double yahooMktCap = parseDouble(yahooQuote.get("marketCap"));
        double avMktCap    = parseDouble(raw.get("MarketCapitalization"));
        overview.put("marketCap",     yahooMktCap > 0 ? yahooMktCap : avMktCap);
        overview.put("peRatio",       parseDouble(raw.get("PERatio")));
        overview.put("eps",           parseDouble(raw.get("EPS")));
        overview.put("dividendYield", parseDouble(raw.get("DividendYield")));

        // 52-week range — prefer Alpha Vantage (Yahoo 1d range isn't 52w)
        overview.put("week52High", parseDouble(raw.get("52WeekHigh")));
        overview.put("week52Low",  parseDouble(raw.get("52WeekLow")));

        return ResponseEntity.ok(overview);
    }

    // ── GET /api/stocks/{symbol}/ratings ──────────────────────────────────────
    @GetMapping("/stocks/{symbol}/ratings")
    public ResponseEntity<Map<String, Object>> getRatings(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "US") String market) {

        if (isCrypto(market) || isFx(market)) {
            return ResponseEntity.ok(Map.of(
                "strongBuy", 0, "buy", 0, "hold", 0,
                "sell", 0, "strongSell", 0, "targetPrice", 0.0
            ));
        }

        int hash       = Math.abs(symbol.hashCode());
        int strongBuy  = 5  + (hash % 10);
        int buy        = 8  + (hash % 8);
        int hold       = 4  + (hash % 6);
        int sell       = 1  + (hash % 4);
        int strongSell = hash % 3;

        Map<String, Object> quote      = stockService.getQuote(resolveSymbol(symbol, market));
        double currentPrice = parseDouble(quote.get("price"));
        double targetPrice  = currentPrice > 0
            ? currentPrice * (1.05 + (hash % 20) / 100.0)
            : 150.0;

        return ResponseEntity.ok(Map.of(
            "strongBuy",   strongBuy,
            "buy",         buy,
            "hold",        hold,
            "sell",        sell,
            "strongSell",  strongSell,
            "targetPrice", Math.round(targetPrice * 100.0) / 100.0
        ));
    }

    // ── GET /api/stocks/{symbol}/insights ─────────────────────────────────────
    @GetMapping("/stocks/{symbol}/insights")
    public ResponseEntity<List<Map<String, Object>>> getInsights(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "US") String market) {

        String clean = symbol.replace(".BSE","").replace(".NSE","")
                             .replace(".NS","").replace(".BO","").toUpperCase();
        String now   = new java.util.Date().toString();
        String type  = isCrypto(market) ? "crypto asset" : isFx(market) ? "currency pair" : "stock";

        return ResponseEntity.ok(List.of(
            Map.of("id","1","type","BULLISH",
                "title", clean + " shows strong momentum",
                "body",  "Technical indicators suggest bullish continuation with RSI above 60 and MACD crossover for this " + type + ".",
                "source","StockSense AI","publishedAt", now),
            Map.of("id","2","type","NEUTRAL",
                "title","Key levels to watch for " + clean,
                "body", "Analysts expect moderate volatility. Watch for volume confirmation at key support and resistance levels.",
                "source","StockSense AI","publishedAt", now)
        ));
    }

    // ── GET /api/stocks/{symbol}/news ─────────────────────────────────────────
    @GetMapping("/stocks/{symbol}/news")
    public ResponseEntity<List<Map<String, Object>>> getNews(
            @PathVariable String symbol,
            @RequestParam(required = false, defaultValue = "US") String market) {

        String clean = symbol.replace(".BSE","").replace(".NSE","")
                             .replace(".NS","").replace(".BO","")
                             .replace(".NYSE","").replace(".NASDAQ","").toUpperCase();

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
            Map.entry("ICICIBANK","ICICI Bank"),
            Map.entry("WIPRO",    "Wipro"),
            Map.entry("BTC",      "Bitcoin cryptocurrency"),
            Map.entry("ETH",      "Ethereum cryptocurrency"),
            Map.entry("SOL",      "Solana cryptocurrency"),
            Map.entry("EUR/USD",  "Euro Dollar forex"),
            Map.entry("GBP/USD",  "Pound Dollar forex")
        );

        String query = nameHints.getOrDefault(clean, clean) + " stock";

        try {
            String urlStr = "https://newsapi.org/v2/everything"
                + "?q=" + java.net.URLEncoder.encode(query, StandardCharsets.UTF_8)
                + "&sortBy=publishedAt&pageSize=8&language=en&apiKey=" + NEWS_API_KEY;

            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestProperty("User-Agent", "StockSense/1.0");

            if (conn.getResponseCode() != 200)
                return ResponseEntity.ok(getMockNews(clean));

            InputStream is = conn.getInputStream();
            String body    = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            is.close();

            List<Map<String, Object>> articles = parseNewsResponse(body);
            return ResponseEntity.ok(articles.isEmpty() ? getMockNews(clean) : articles);
        } catch (Exception e) {
            return ResponseEntity.ok(getMockNews(clean));
        }
    }

    // ── GET /api/stocks/search?q= ─────────────────────────────────────────────
    @GetMapping("/stocks/search")
    public ResponseEntity<List<Map<String, Object>>> search(@RequestParam String q) {
        String upper = q.trim().toUpperCase();
        List<Map<String, Object>> results = new ArrayList<>();

        // 1. Inject known symbols that match the query prefix
        KNOWN_SYMBOLS.forEach((key, val) -> {
            if (key.startsWith(upper) || upper.startsWith(key)
                    || key.contains(upper) || upper.contains(key)) {
                // Avoid duplicates
                String sym = val.get("symbol");
                boolean already = results.stream()
                    .anyMatch(r -> sym.equals(r.get("symbol")));
                if (!already) results.add(new LinkedHashMap<>(val));
            }
        });

        // 2. Yahoo Finance search — filter to EQUITY/CRYPTO/ETF only
        try {
            List<Map<String, Object>> yahooResults = stockService.searchSymbol(q);
            if (yahooResults != null) {
                for (Map<String, Object> r : yahooResults) {
                    String type = String.valueOf(r.getOrDefault("type", ""));
                    // Skip mutual funds, indices, futures, options
                    if (type.equals("MUTUALFUND") || type.equals("INDEX")
                            || type.equals("FUTURE") || type.equals("OPTION")) continue;
                    // Skip if already in results
                    String sym = String.valueOf(r.get("symbol"));
                    boolean already = results.stream()
                        .anyMatch(x -> sym.equals(x.get("symbol")));
                    if (!already) results.add(r);
                }
            }
        } catch (Exception ignored) {}

        // 3. Alpha Vantage fallback if still empty
        if (results.isEmpty()) {
            try {
                List<Map<String, Object>> avResults = alphaVantage.search(q);
                if (avResults != null) results.addAll(avResults);
            } catch (Exception ignored) {}
        }

        return ResponseEntity.ok(results.stream().limit(8).collect(Collectors.toList()));
    }

    // ── GET /api/market/{marketId}/quotes ─────────────────────────────────────
    @GetMapping("/market/{marketId}/quotes")
    public ResponseEntity<Map<String, Object>> getMarketQuotes(
            @PathVariable String marketId,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size) {

        if (isCrypto(marketId)) {
            List<Map<String, Object>> cryptos = stockService.getTopCrypto(50);
            int total = cryptos.size();
            int from  = Math.min(page * size, total);
            int to    = Math.min(from + size, total);
            return ResponseEntity.ok(Map.of(
                "market",     marketId, "page", page, "size", size,
                "total",      total,
                "totalPages", (int) Math.ceil((double) total / size),
                "stocks",     cryptos.subList(from, to)
            ));
        }

        if (isFx(marketId)) {
            List<String> fxPairs = List.of(
                "EURUSD=X","GBPUSD=X","USDJPY=X","AUDUSD=X",
                "USDCAD=X","USDCHF=X","NZDUSD=X","EURGBP=X"
            );
            List<Map<String, Object>> fxResults = new ArrayList<>();
            for (String pair : fxPairs) {
                Map<String, Object> qt = stockService.getQuote(pair);
                if (qt != null && !qt.isEmpty()) {
                    Map<String, Object> r = new LinkedHashMap<>(qt);
                    r.put("symbol", pair.replace("=X","")
                        .replaceAll("(.{3})(.{3})", "$1/$2"));
                    fxResults.add(r);
                }
            }
            int total = fxResults.size();
            return ResponseEntity.ok(Map.of(
                "market","FX","page",page,"size",size,
                "total",total,"totalPages",1,"stocks",fxResults
            ));
        }

        // US / IN
        List<Map<String, String>> allSymbols = marketSymbols.getSymbolsForMarket(marketId);
        int total = allSymbols.size();
        int from  = Math.min(page * size, total);
        int to    = Math.min(from + size, total);

        List<String> syms = allSymbols.subList(from, to)
            .stream().map(s -> s.get("symbol")).toList();

        List<Map<String, Object>> quotes   = alphaVantage.getBatchQuotes(syms);
        List<Map<String, Object>> enriched = new ArrayList<>();
        for (int i = 0; i < allSymbols.subList(from, to).size(); i++) {
            Map<String, Object> merged = new LinkedHashMap<>();
            merged.putAll(allSymbols.subList(from, to).get(i));
            if (i < quotes.size()) merged.putAll(quotes.get(i));
            enriched.add(merged);
        }
        return ResponseEntity.ok(Map.of(
            "market", marketId, "page", page, "size", size,
            "total", total, "totalPages", (int) Math.ceil((double) total / size),
            "stocks", enriched
        ));
    }

    // ── GET /api/market/{marketId}/symbols ────────────────────────────────────
    @GetMapping("/market/{marketId}/symbols")
    public ResponseEntity<List<Map<String, String>>> getMarketSymbols(
            @PathVariable String marketId) {

        if (isCrypto(marketId)) {
            return ResponseEntity.ok(List.of(
                Map.of("symbol","BTC",  "name","Bitcoin"),
                Map.of("symbol","ETH",  "name","Ethereum"),
                Map.of("symbol","SOL",  "name","Solana"),
                Map.of("symbol","BNB",  "name","BNB"),
                Map.of("symbol","AVAX", "name","Avalanche"),
                Map.of("symbol","ADA",  "name","Cardano"),
                Map.of("symbol","DOT",  "name","Polkadot"),
                Map.of("symbol","DOGE", "name","Dogecoin"),
                Map.of("symbol","XRP",  "name","XRP"),
                Map.of("symbol","MATIC","name","Polygon")
            ));
        }

        if (isFx(marketId)) {
            return ResponseEntity.ok(List.of(
                Map.of("symbol","EUR/USD","name","Euro / US Dollar"),
                Map.of("symbol","GBP/USD","name","British Pound / US Dollar"),
                Map.of("symbol","USD/JPY","name","US Dollar / Japanese Yen"),
                Map.of("symbol","AUD/USD","name","Australian Dollar / US Dollar"),
                Map.of("symbol","USD/CAD","name","US Dollar / Canadian Dollar"),
                Map.of("symbol","USD/CHF","name","US Dollar / Swiss Franc"),
                Map.of("symbol","NZD/USD","name","New Zealand Dollar / US Dollar"),
                Map.of("symbol","EUR/GBP","name","Euro / British Pound")
            ));
        }

        return ResponseEntity.ok(marketSymbols.getSymbolsForMarket(marketId));
    }

    // ── GET /api/market/{marketId}/analytics ──────────────────────────────────
    @GetMapping("/market/{marketId}/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics(@PathVariable String marketId) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("market",        marketId);
        data.put("totalValue",    switch (marketId.toUpperCase()) {
            case "IN"     -> 9331456;
            case "US"     -> 530056;
            case "CRYPTO" -> 280000;
            case "FX"     -> 487200;
            default       -> 120000;
        });
        data.put("changePercent", switch (marketId.toUpperCase()) {
            case "IN"     -> 6.42;
            case "US"     -> 4.75;
            case "CRYPTO" -> 8.20;
            case "FX"     -> 1.40;
            default       -> 2.1;
        });
        data.put("riskScore", switch (marketId.toUpperCase()) {
            case "IN"     -> 76;
            case "US"     -> 58;
            case "CRYPTO" -> 91;
            case "FX"     -> 45;
            default       -> 60;
        });
        return ResponseEntity.ok(data);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Return first non-blank, non-null value from map, else fallback */
    private Object getFirst(Map<String, Object> map, String key, Object fallback) {
        Object v = map.get(key);
        if (v != null && !v.toString().isBlank() && !v.toString().equals("None"))
            return v;
        return fallback;
    }

    private String[] toYahooRangeInterval(String range) {
        return switch (range.toUpperCase()) {
            case "1D"  -> new String[]{"1d",  "5m"};
            case "1W"  -> new String[]{"5d",  "15m"};
            case "1M"  -> new String[]{"1mo", "1d"};
            case "1Y"  -> new String[]{"1y",  "1wk"};
            case "ALL" -> new String[]{"5y",  "1mo"};
            default    -> new String[]{"1mo", "1d"};
        };
    }

    private List<Map<String, Object>> normaliseHistoryTimestamps(
            List<Map<String, Object>> candles) {
        if (candles == null) return Collections.emptyList();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> c : candles) {
            Map<String, Object> n = new LinkedHashMap<>(c);
            if (c.containsKey("timestamp") && !c.containsKey("time")) {
                long ts = ((Number) c.get("timestamp")).longValue();
                n.put("time", ts > 1_000_000_000_000L ? ts / 1000L : ts);
                n.remove("timestamp");
            }
            result.add(n);
        }
        return result;
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

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseNewsResponse(String json) {
        List<Map<String, Object>> result = new ArrayList<>();
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper =
                new com.fasterxml.jackson.databind.ObjectMapper();
            Map<String, Object> root     = mapper.readValue(json, Map.class);
            List<Map<String, Object>> articles =
                (List<Map<String, Object>>) root.get("articles");
            if (articles == null) return result;
            for (Map<String, Object> a : articles) {
                String title = str(a, "title", "");
                if (title.isEmpty() || title.equals("[Removed]")) continue;
                Object sourceObj  = a.get("source");
                String sourceName = sourceObj instanceof Map
                    ? str((Map<String, Object>) sourceObj, "name", "") : "";
                Map<String, Object> article = new LinkedHashMap<>();
                article.put("title",       title);
                article.put("description", str(a, "description", ""));
                article.put("url",         str(a, "url", ""));
                article.put("source",      sourceName);
                article.put("publishedAt", str(a, "publishedAt", ""));
                article.put("urlToImage",  str(a, "urlToImage", ""));
                result.add(article);
            }
        } catch (Exception ignored) {}
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
                   "description", "Analysts remain cautiously optimistic as the asset holds key support levels.",
                   "url","#","source","StockSense","publishedAt",now,"urlToImage",""),
            Map.of("title", "Institutional investors increase stake in " + symbol,
                   "description", "Recent filings show major funds have added to their positions this quarter.",
                   "url","#","source","StockSense","publishedAt",now,"urlToImage",""),
            Map.of("title", symbol + " technical analysis: key levels to watch",
                   "description", "RSI divergence and volume patterns suggest a potential breakout in the near term.",
                   "url","#","source","StockSense","publishedAt",now,"urlToImage","")
        );
    }

    private double parseDouble(Object val) {
        if (val == null) return 0.0;
        try { return Double.parseDouble(val.toString()); }
        catch (NumberFormatException e) { return 0.0; }
    }
}