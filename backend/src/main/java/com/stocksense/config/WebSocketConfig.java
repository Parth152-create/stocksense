package com.stocksense.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stocksense.service.AlphaVantageService;
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
 * Server sends every 15s per session:
 *   { "RELIANCE": 2940.50, "TCS": 3921.00, ... }
 *
 * Falls back to hash-based mock if Alpha Vantage quota is exceeded.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final AlphaVantageService alphaVantageService;

    public WebSocketConfig(AlphaVantageService alphaVantageService) {
        this.alphaVantageService = alphaVantageService;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new RawWebSocketHandler(alphaVantageService), "/ws/prices")
                .setAllowedOriginPatterns("*");
    }

    // ─────────────────────────────────────────────────────────────────────────

    public static class RawWebSocketHandler implements WebSocketHandler {

        private final AlphaVantageService alphaVantageService;
        private final ObjectMapper mapper = new ObjectMapper();
        private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

        // Per-session state
        private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
        private final Map<String, Set<String>> sessionSymbols = new ConcurrentHashMap<>();
        private final Map<String, ScheduledFuture<?>> sessionTasks = new ConcurrentHashMap<>();

        public RawWebSocketHandler(AlphaVantageService alphaVantageService) {
            this.alphaVantageService = alphaVantageService;
        }

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            sessions.put(session.getId(), session);
            sessionSymbols.put(session.getId(), ConcurrentHashMap.newKeySet());
        }

        @Override
        public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
            String payload = message.getPayload().toString();
            Map<?, ?> msg = mapper.readValue(payload, Map.class);

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

        /** Strip .BSE / .NSE suffix — Alpha Vantage uses plain symbols */
        private String normalise(String s) {
            return s.replace(".BSE", "").replace(".NSE", "");
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
            Map<String, Object> prices = new LinkedHashMap<>();

            for (String symbol : symbols) {
                try {
                    Map<String, Object> quote = alphaVantageService.getQuote(symbol);
                    if (quote != null && quote.get("price") instanceof Number) {
                        prices.put(symbol, ((Number) quote.get("price")).doubleValue());
                    } else {
                        prices.put(symbol, mockPrice(symbol));
                    }
                } catch (Exception e) {
                    // Alpha Vantage quota hit or network error — use mock
                    prices.put(symbol, mockPrice(symbol));
                }
            }

            try {
                session.sendMessage(new TextMessage(mapper.writeValueAsString(prices)));
            } catch (IOException ignored) {}
        }

        /** Deterministic mock based on symbol hash, same range 100–900 */
        private double mockPrice(String symbol) {
            int h = Math.abs(symbol.hashCode());
            double base = 100 + (h % 800);
            double jitter = (Math.random() - 0.5) * base * 0.01;
            return Math.round((base + jitter) * 100.0) / 100.0;
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) {
            cleanup(session.getId());
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
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