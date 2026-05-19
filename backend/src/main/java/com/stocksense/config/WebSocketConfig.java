package com.stocksense.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stocksense.service.AlphaVantageService;
import com.stocksense.service.NseService;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;

/**
 * Raw WebSocket handler at ws://localhost:8081/ws/prices
 *
 * Client sends:  { "subscribe": ["RELIANCE", "TCS", "AAPL"] }
 *                { "unsubscribe": ["AAPL"] }
 *
 * Server sends every 15s per session — one message per symbol:
 *   { "symbol": "RELIANCE", "price": 2940.50, "changePct": 0.42, "live": true }
 *
 * Price source priority:
 *   Indian symbols (.BSE/.NSE or known NSE tickers) → NseService (real NSE prices)
 *   US/Crypto/FX symbols                            → AlphaVantageService (cached)
 *   Any failure                                     → mock hash-based price
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final AlphaVantageService alphaVantageService;
    private final NseService          nseService;

    public WebSocketConfig(AlphaVantageService alphaVantageService,
                           NseService nseService) {
        this.alphaVantageService = alphaVantageService;
        this.nseService          = nseService;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(
            new RawWebSocketHandler(alphaVantageService, nseService),
            "/ws/prices"
        ).setAllowedOriginPatterns("*");
    }

    // ─────────────────────────────────────────────────────────────────────────

    public static class RawWebSocketHandler implements WebSocketHandler {

        private final AlphaVantageService alphaVantageService;
        private final NseService          nseService;
        private final ObjectMapper        mapper    = new ObjectMapper();
        private final ScheduledExecutorService scheduler =
            Executors.newScheduledThreadPool(4);

        // Known Indian market symbols — these go to NseService
        private static final Set<String> INDIAN_SYMBOLS = Set.of(
            "RELIANCE","TCS","INFY","HDFCBANK","WIPRO","ICICIBANK","SBIN",
            "BAJFINANCE","HINDUNILVR","ADANIENT","TATAMOTORS","TATASTEEL",
            "AXISBANK","KOTAKBANK","LT","SUNPHARMA","ULTRACEMCO","ASIANPAINT",
            "MARUTI","NTPC","POWERGRID","ONGC","COALINDIA","TECHM","HCLTECH",
            "BAJAJFINSV","TITAN","NESTLEIND","BRITANNIA","DIVISLAB"
        );

        // Per-session state
        private final Map<String, WebSocketSession> sessions       = new ConcurrentHashMap<>();
        private final Map<String, Set<String>>      sessionSymbols = new ConcurrentHashMap<>();
        private final Map<String, ScheduledFuture<?>> sessionTasks = new ConcurrentHashMap<>();

        public RawWebSocketHandler(AlphaVantageService alphaVantageService,
                                   NseService nseService) {
            this.alphaVantageService = alphaVantageService;
            this.nseService          = nseService;
        }

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            sessions.put(session.getId(), session);
            sessionSymbols.put(session.getId(), ConcurrentHashMap.newKeySet());
        }

        @Override
        public void handleMessage(WebSocketSession session,
                                  WebSocketMessage<?> message) throws Exception {
            String payload = message.getPayload().toString();
            Map<?, ?> msg  = mapper.readValue(payload, Map.class);

            Set<String> subscribed = sessionSymbols.get(session.getId());
            if (subscribed == null) return;

            if (msg.containsKey("subscribe")) {
                List<?> symbols = (List<?>) msg.get("subscribe");
                symbols.forEach(s -> subscribed.add(normalise(s.toString())));
                restartTask(session);
            }
            if (msg.containsKey("unsubscribe")) {
                List<?> symbols = (List<?>) msg.get("unsubscribe");
                symbols.forEach(s -> subscribed.remove(normalise(s.toString())));
            }
        }

        /** Strip .BSE / .NSE suffix for lookup */
        private String normalise(String s) {
            return s.replace(".BSE", "").replace(".NSE", "").toUpperCase().trim();
        }

        private boolean isIndianSymbol(String symbol) {
            return INDIAN_SYMBOLS.contains(symbol);
        }

        private void restartTask(WebSocketSession session) {
            ScheduledFuture<?> old = sessionTasks.get(session.getId());
            if (old != null) old.cancel(false);

            ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(() -> {
                Set<String> symbols = sessionSymbols.get(session.getId());
                if (symbols == null || symbols.isEmpty()) return;
                sendPrices(session, symbols);
            }, 0, 15, TimeUnit.SECONDS);

            sessionTasks.put(session.getId(), task);
        }

        private void sendPrices(WebSocketSession session, Set<String> symbols) {
            if (!session.isOpen()) return;

            // Send one JSON message per symbol in the format the frontend expects:
            // { "symbol": "RELIANCE", "price": 2940.50, "changePct": 0.42, "live": true }
            List<Map<String, Object>> updates = new ArrayList<>();

            for (String symbol : symbols) {
                double[] priceData = fetchPrice(symbol);
                Map<String, Object> update = new LinkedHashMap<>();
                update.put("symbol",    symbol);
                update.put("price",     priceData[0]);
                update.put("changePct", priceData[1]);
                update.put("live",      priceData[2] == 1.0); // true = real price
                updates.add(update);
            }

            try {
                // Send as array so frontend can handle multiple symbols in one message
                session.sendMessage(new TextMessage(mapper.writeValueAsString(updates)));
            } catch (IOException ignored) {}
        }

        /**
         * Returns [price, changePct, isLive(1/0)]
         * isLive = 1 means real price from NSE/AlphaVantage
         * isLive = 0 means mock fallback
         */
        private double[] fetchPrice(String symbol) {
            try {
                if (isIndianSymbol(symbol)) {
                    // Try NSE first for Indian stocks
                    double[] nsePrice = nseService.getPrice(symbol);
                    if (nsePrice != null) {
                        return new double[]{ nsePrice[0], nsePrice[1], 1.0 };
                    }
                }

                // US/Crypto/FX — use Alpha Vantage (cached)
                Map<String, Object> quote = alphaVantageService.getQuote(symbol);
                if (quote != null && quote.get("price") instanceof Number price) {
                    double changePct = quote.get("changePercent") instanceof Number cp
                        ? cp.doubleValue() : 0.0;
                    return new double[]{ price.doubleValue(), changePct, 1.0 };
                }
            } catch (Exception e) {
                // Fall through to mock
            }

            // Mock fallback
            return new double[]{ mockPrice(symbol), mockChangePct(symbol), 0.0 };
        }

        private double mockPrice(String symbol) {
            int h = Math.abs(symbol.hashCode());
            double base   = 100 + (h % 800);
            double jitter = (Math.random() - 0.5) * base * 0.01;
            return Math.round((base + jitter) * 100.0) / 100.0;
        }

        private double mockChangePct(String symbol) {
            return Math.round(((Math.random() - 0.5) * 4) * 100.0) / 100.0;
        }

        @Override
        public void handleTransportError(WebSocketSession session,
                                         Throwable exception) {
            cleanup(session.getId());
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session,
                                          CloseStatus status) {
            cleanup(session.getId());
        }

        private void cleanup(String id) {
            sessions.remove(id);
            sessionSymbols.remove(id);
            ScheduledFuture<?> task = sessionTasks.remove(id);
            if (task != null) task.cancel(false);
        }

        @Override
        public boolean supportsPartialMessages() { return false; }
    }
}