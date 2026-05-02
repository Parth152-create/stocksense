package com.stocksense.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stocksense.service.AlphaVantageService;
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
 *   Client → Server:  { "action": "subscribe",   "symbols": ["AAPL","TSLA"] }
 *   Client → Server:  { "action": "unsubscribe", "symbols": ["AAPL"] }
 *   Server → Client:  { "symbol": "AAPL", "price": 189.42, "change": 1.23,
 *                        "changePct": 0.65, "timestamp": 1714900000000 }
 *   Server → Client:  { "type": "error", "message": "..." }   (on bad request)
 */
@Component
public class PriceWebSocketHandler extends TextWebSocketHandler {

    // sessionId → WebSocketSession
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    // sessionId → set of subscribed symbols (uppercase)
    private final Map<String, Set<String>> subscriptions = new ConcurrentHashMap<>();

    // symbol → last known price (so we can compute change)
    private final Map<String, Double> lastPrices = new ConcurrentHashMap<>();

    private final AlphaVantageService alphaVantageService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PriceWebSocketHandler(AlphaVantageService alphaVantageService) {
        this.alphaVantageService = alphaVantageService;
    }

    // ── Connection lifecycle ─────────────────────────────────────────────────

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
        subscriptions.put(session.getId(), ConcurrentHashMap.newKeySet());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
        subscriptions.remove(session.getId());
    }

    // ── Incoming messages ────────────────────────────────────────────────────

    @Override
    @SuppressWarnings("unchecked")
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = objectMapper.readValue(message.getPayload(), Map.class);
        String action  = (String) payload.get("action");
        List<String> symbols = (List<String>) payload.get("symbols");

        if (symbols == null || symbols.isEmpty()) return;

        Set<String> sessionSubs = subscriptions.get(session.getId());
        if (sessionSubs == null) return;

        if ("subscribe".equals(action)) {
            for (String s : symbols) {
                sessionSubs.add(s.toUpperCase());
            }
            // Immediately push current price for newly subscribed symbols
            pushPricesTo(session, sessionSubs);

        } else if ("unsubscribe".equals(action)) {
            for (String s : symbols) {
                sessionSubs.remove(s.toUpperCase());
            }
        }
    }

    // ── Scheduled broadcast every 15 seconds ────────────────────────────────

    @Scheduled(fixedDelay = 15_000)
    public void broadcastPrices() {
        // Collect all unique symbols across all sessions
        Set<String> allSymbols = new HashSet<>();
        subscriptions.values().forEach(allSymbols::addAll);
        if (allSymbols.isEmpty()) return;

        // For each session, push its subscribed symbols
        sessions.forEach((sessionId, session) -> {
            if (!session.isOpen()) return;
            Set<String> subs = subscriptions.getOrDefault(sessionId, Set.of());
            if (subs.isEmpty()) return;
            try {
                pushPricesTo(session, subs);
            } catch (Exception e) {
                // Session probably closed mid-broadcast — ignore
            }
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void pushPricesTo(WebSocketSession session, Set<String> symbols) throws Exception {
        for (String symbol : symbols) {
            if (!session.isOpen()) break;
            try {
                double price = fetchPrice(symbol);
                double prev  = lastPrices.getOrDefault(symbol, price);
                double change    = Math.round((price - prev) * 100.0) / 100.0;
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
                // Send error for this specific symbol, don't kill the session
                Map<String, Object> err = Map.of(
                    "type",    "error",
                    "symbol",  symbol,
                    "message", "Price unavailable"
                );
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(err)));
            }
        }
    }

    /**
     * Delegate to AlphaVantageService which already has Caffeine caching.
     * Returns the current price as a double.
     */
    private double fetchPrice(String symbol) {
        Map<String, Object> quote = alphaVantageService.getQuote(symbol);
        Object price = quote.get("price");
        if (price instanceof Number n) return n.doubleValue();
        return 0.0;
    }
}