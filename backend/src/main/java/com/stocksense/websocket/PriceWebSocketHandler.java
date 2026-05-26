package com.stocksense.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stocksense.service.StockService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler at ws://localhost:8081/ws/prices
 *
 * Protocol (JSON):
 *   Client → Server:  { "action": "subscribe",   "symbols": ["AAPL","TSLA","BTC","RELIANCE"] }
 *   Client → Server:  { "action": "unsubscribe", "symbols": ["AAPL"] }
 *
 *   Server → Client (one object per symbol):
 *     { "symbol": "AAPL", "price": 189.42, "change": 1.23,
 *       "changePct": 0.65, "timestamp": 1714900000000 }
 *
 *   Server → Client (on error):
 *     { "type": "error", "symbol": "X", "message": "Price unavailable" }
 *
 * Routing:
 *   BTC, ETH, SOL, BNB, AVAX, DOGE, ADA, XRP, MATIC, DOT
 *     → CoinGecko via StockService.getCryptoQuote(coinId)
 *   EUR/USD, GBP/USD, USD/JPY, ... (contains "/")
 *     → Yahoo Finance FX format: EURUSD=X
 *   RELIANCE, TCS, INFY, HDFCBANK, WIPRO (known BSE symbols, no suffix yet)
 *     → Yahoo Finance with .BSE suffix: RELIANCE.BSE
 *   Everything else (AAPL, TSLA, NVDA, MSFT...)
 *     → Yahoo Finance via StockService.getQuote() with Alpha Vantage fallback
 */
@Component
public class PriceWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(PriceWebSocketHandler.class);

    // sessionId → WebSocketSession
    private final Map<String, WebSocketSession> sessions       = new ConcurrentHashMap<>();
    // sessionId → set of subscribed symbols (as received, uppercase)
    private final Map<String, Set<String>>      subscriptions  = new ConcurrentHashMap<>();
    // symbol → last known price (for computing change on next tick)
    private final Map<String, Double>           lastPrices     = new ConcurrentHashMap<>();

    // Use StockService — it routes Yahoo/CoinGecko/AlphaVantage correctly
    private final StockService   stockService;
    private final ObjectMapper   objectMapper = new ObjectMapper();

    // ── Known crypto coin IDs for CoinGecko ──────────────────────────────────
    private static final Map<String, String> CRYPTO_IDS = Map.ofEntries(
        Map.entry("BTC",  "bitcoin"),
        Map.entry("ETH",  "ethereum"),
        Map.entry("SOL",  "solana"),
        Map.entry("BNB",  "binancecoin"),
        Map.entry("AVAX", "avalanche-2"),
        Map.entry("DOGE", "dogecoin"),
        Map.entry("ADA",  "cardano"),
        Map.entry("XRP",  "ripple"),
        Map.entry("MATIC","matic-network"),
        Map.entry("DOT",  "polkadot")
    );

    // ── Known BSE symbols (raw, no suffix) ───────────────────────────────────
    private static final Set<String> BSE_SYMBOLS = Set.of(
        "RELIANCE", "TCS", "INFY", "HDFCBANK", "WIPRO",
        "ICICIBANK", "SBIN", "BAJFINANCE", "HINDUNILVR",
        "ADANIENT", "TATAMOTORS", "TATASTEEL", "AXISBANK",
        "MARUTI", "SUNPHARMA", "LTIM", "TECHM", "NTPC",
        "POWERGRID", "ONGC", "COALINDIA", "JSWSTEEL"
    );

    public PriceWebSocketHandler(StockService stockService) {
        this.stockService = stockService;
    }

    // ── Connection lifecycle ──────────────────────────────────────────────────

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
        subscriptions.put(session.getId(), ConcurrentHashMap.newKeySet());
        log.info("[WS] Client connected: {}", session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
        subscriptions.remove(session.getId());
        log.info("[WS] Client disconnected: {}", session.getId());
    }

    // ── Incoming messages ─────────────────────────────────────────────────────

    @Override
    @SuppressWarnings("unchecked")
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = objectMapper.readValue(message.getPayload(), Map.class);
        String       action  = (String)       payload.get("action");
        List<String> symbols = (List<String>) payload.get("symbols");

        if (symbols == null || symbols.isEmpty()) return;

        Set<String> sessionSubs = subscriptions.get(session.getId());
        if (sessionSubs == null) return;

        if ("subscribe".equals(action)) {
            for (String s : symbols) {
                sessionSubs.add(s.toUpperCase());
            }
            log.info("[WS] Session {} subscribed to: {}", session.getId(), symbols);
            // Immediately push current prices for newly subscribed symbols
            pushPricesTo(session, sessionSubs);

        } else if ("unsubscribe".equals(action)) {
            for (String s : symbols) {
                sessionSubs.remove(s.toUpperCase());
            }
        }
    }

    // ── Scheduled broadcast every 15 seconds ─────────────────────────────────

    @Scheduled(fixedDelay = 15_000)
    public void broadcastPrices() {
        if (sessions.isEmpty()) return;

        sessions.forEach((sessionId, session) -> {
            if (!session.isOpen()) return;
            Set<String> subs = subscriptions.getOrDefault(sessionId, Set.of());
            if (subs.isEmpty()) return;
            try {
                pushPricesTo(session, subs);
            } catch (Exception e) {
                log.warn("[WS] Broadcast error for session {}: {}", sessionId, e.getMessage());
            }
        });
    }

    // ── Push prices to a single session ──────────────────────────────────────

    private void pushPricesTo(WebSocketSession session, Set<String> symbols) throws Exception {
        for (String symbol : symbols) {
            if (!session.isOpen()) break;
            try {
                double price = fetchPrice(symbol);
                if (price <= 0) continue; // skip if we got nothing

                double prev      = lastPrices.getOrDefault(symbol, price);
                double change    = Math.round((price - prev)          * 100.0) / 100.0;
                double changePct = prev > 0
                    ? Math.round(((price - prev) / prev) * 10000.0) / 100.0
                    : 0.0;

                lastPrices.put(symbol, price);

                Map<String, Object> tick = new LinkedHashMap<>();
                tick.put("symbol",    symbol);
                tick.put("price",     price);
                tick.put("change",    change);
                tick.put("changePct", changePct);
                tick.put("timestamp", System.currentTimeMillis());

                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(tick)));

            } catch (Exception e) {
                log.warn("[WS] Price fetch error for {}: {}", symbol, e.getMessage());
                Map<String, Object> err = Map.of(
                    "type",    "error",
                    "symbol",  symbol,
                    "message", "Price unavailable"
                );
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(err)));
            }
        }
    }

    // ── Smart price routing ───────────────────────────────────────────────────

    /**
     * Routes each symbol to the correct data source:
     *
     * 1. CRYPTO  → CoinGecko  (BTC, ETH, SOL, BNB, AVAX, ...)
     * 2. FX      → Yahoo Finance FX format (EUR/USD → EURUSD=X)
     * 3. BSE     → Yahoo Finance with .BSE suffix (RELIANCE → RELIANCE.BSE)
     *              also handles already-suffixed symbols (RELIANCE.BSE)
     * 4. US/other→ Yahoo Finance via StockService (AAPL, TSLA, NVDA, ...)
     *              with Alpha Vantage fallback
     */
    private double fetchPrice(String symbol) {
        String upper = symbol.toUpperCase();

        // 1. CRYPTO — check against known CoinGecko IDs
        String coinId = CRYPTO_IDS.get(upper);
        if (coinId != null) {
            return fetchCryptoPrice(coinId, upper);
        }

        // 2. FX pairs — contains "/" like "EUR/USD"
        if (upper.contains("/")) {
            return fetchFxPrice(upper);
        }

        // 3. BSE — already has .BSE/.NSE suffix OR is a known BSE symbol
        String base = upper.replace(".BSE", "").replace(".NSE", "");
        if (upper.endsWith(".BSE") || upper.endsWith(".NSE") || BSE_SYMBOLS.contains(base)) {
            String bseSymbol = base + ".BSE";
            return fetchYahooPrice(bseSymbol);
        }

        // 4. US stocks / everything else — Yahoo with Alpha Vantage fallback
        return fetchYahooPrice(upper);
    }

    /** CoinGecko price via StockService.getCryptoQuote() */
    private double fetchCryptoPrice(String coinId, String symbol) {
        try {
            Map<String, Object> quote = stockService.getCryptoQuote(coinId);
            if (quote == null || quote.isEmpty()) return 0;
            Object p = quote.get("price");
            return p instanceof Number n ? n.doubleValue() : 0;
        } catch (Exception e) {
            log.warn("[WS] CoinGecko error for {}: {}", symbol, e.getMessage());
            return 0;
        }
    }

    /**
     * FX price via Yahoo Finance.
     * Converts "EUR/USD" → "EURUSD=X", "GBP/USD" → "GBPUSD=X"
     */
    private double fetchFxPrice(String symbol) {
        try {
            // "EUR/USD" → "EURUSD=X"
            String yahooFx = symbol.replace("/", "") + "=X";
            return fetchYahooPrice(yahooFx);
        } catch (Exception e) {
            log.warn("[WS] FX price error for {}: {}", symbol, e.getMessage());
            return 0;
        }
    }

    /** Yahoo Finance (+ Alpha Vantage fallback) via StockService.getQuote() */
    private double fetchYahooPrice(String symbol) {
        try {
            Map<String, Object> quote = stockService.getQuote(symbol);
            if (quote == null || quote.isEmpty()) return 0;
            Object p = quote.get("price");
            return p instanceof Number n ? n.doubleValue() : 0;
        } catch (Exception e) {
            log.warn("[WS] Yahoo price error for {}: {}", symbol, e.getMessage());
            return 0;
        }
    }
}