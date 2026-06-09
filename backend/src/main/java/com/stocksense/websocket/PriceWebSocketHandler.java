package com.stocksense.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stocksense.service.StockService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * WebSocket handler at ws://localhost:8081/ws/prices
 *
 * Protocol (JSON):
 *   Client → Server: { "action": "subscribe",   "symbols": ["AAPL","TSLA"] }
 *   Client → Server: { "action": "unsubscribe", "symbols": ["AAPL"] }
 *
 *   Server → Client (pushed by RedisWebSocketBridge on each price tick):
 *   { "symbol": "AAPL", "price": 189.42, "changePct": 0.65, "timestamp": ... }
 *
 *   Server → Client (on subscribe — immediate snapshot):
 *   { "symbol": "AAPL", "price": 189.42, "changePct": 0.65, "timestamp": ..., "snapshot": true }
 */
@Component
public class PriceWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(PriceWebSocketHandler.class);

    private final RedisWebSocketBridge bridge;
    private final StockService         stockService;
    private final ObjectMapper         mapper = new ObjectMapper();

    public PriceWebSocketHandler(RedisWebSocketBridge bridge, StockService stockService) {
        this.bridge       = bridge;
        this.stockService = stockService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        bridge.registerSession(session.getId(), session);
        log.info("[WS] Connected: {}", session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        bridge.removeSession(session.getId());
        log.info("[WS] Disconnected: {}", session.getId());
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = mapper.readValue(message.getPayload(), Map.class);
        String       action  = (String)       payload.get("action");
        List<String> symbols = (List<String>) payload.get("symbols");

        if (symbols == null || symbols.isEmpty()) return;

        if ("subscribe".equals(action)) {
            for (String s : symbols) {
                bridge.subscribe(session.getId(), s);
            }
            log.info("[WS] {} subscribed to: {}", session.getId(), symbols);
            // Push immediate snapshot from Redis/cache so client doesn't wait 60s
            pushSnapshot(session, symbols);

        } else if ("unsubscribe".equals(action)) {
            for (String s : symbols) {
                bridge.unsubscribe(session.getId(), s);
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        bridge.removeSession(session.getId());
        log.warn("[WS] Transport error for {}: {}", session.getId(), exception.getMessage());
    }

    // ── Snapshot on subscribe ─────────────────────────────────────────────────

    private void pushSnapshot(WebSocketSession session, List<String> symbols) {
        for (String symbol : symbols) {
            try {
                Map<String, Object> quote = stockService.getQuote(symbol.toUpperCase());
                if (quote == null || quote.isEmpty()) continue;

                Object price     = quote.get("price");
                Object changePct = quote.get("changePct");
                if (price == null) continue;

                Map<String, Object> tick = Map.of(
                    "symbol",    symbol.toUpperCase(),
                    "price",     price,
                    "changePct", changePct != null ? changePct : 0,
                    "timestamp", System.currentTimeMillis(),
                    "snapshot",  true
                );

                synchronized (session) {
                    session.sendMessage(new TextMessage(mapper.writeValueAsString(tick)));
                }
            } catch (Exception e) {
                log.warn("[WS] Snapshot failed for {}: {}", symbol, e.getMessage());
            }
        }
    }
}
