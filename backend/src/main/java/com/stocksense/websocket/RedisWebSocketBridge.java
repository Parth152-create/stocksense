package com.stocksense.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * RedisWebSocketBridge
 *
 * Subscribes to Redis Pub/Sub channel "prices".
 * Messages arrive as: SYMBOL:price:changePct
 * Fans out to all locally-connected WebSocket sessions subscribed to that symbol.
 *
 * Enables horizontal scaling — multiple backend instances all receive
 * prices via Redis and independently fan out to their own connected clients.
 */
@Component
public class RedisWebSocketBridge implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(RedisWebSocketBridge.class);

    // sessionId → WebSocketSession
    private final Map<String, WebSocketSession> sessions      = new ConcurrentHashMap<>();
    // sessionId → set of subscribed symbols (uppercase)
    private final Map<String, Set<String>>      subscriptions = new ConcurrentHashMap<>();

    // ── Session registry (called by PriceWebSocketHandler) ───────────────────

    public void registerSession(String sessionId, WebSocketSession session) {
        sessions.put(sessionId, session);
        subscriptions.put(sessionId, ConcurrentHashMap.newKeySet());
        log.info("[Bridge] Session registered: {}", sessionId);
    }

    public void removeSession(String sessionId) {
        sessions.remove(sessionId);
        subscriptions.remove(sessionId);
        log.info("[Bridge] Session removed: {}", sessionId);
    }

    public void subscribe(String sessionId, String symbol) {
        Set<String> subs = subscriptions.get(sessionId);
        if (subs != null) subs.add(symbol.toUpperCase());
    }

    public void unsubscribe(String sessionId, String symbol) {
        Set<String> subs = subscriptions.get(sessionId);
        if (subs != null) subs.remove(symbol.toUpperCase());
    }

    public Set<String> getSubscriptions(String sessionId) {
        return subscriptions.getOrDefault(sessionId, Set.of());
    }

    // ── Redis MessageListener ─────────────────────────────────────────────────

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String body = new String(message.getBody());
            // Format: SYMBOL:price:changePct
            String[] parts = body.split(":");
            if (parts.length < 3) return;

            String symbol    = parts[0].toUpperCase();
            String price     = parts[1];
            String changePct = parts[2];

            String json = String.format(
                "{\"symbol\":\"%s\",\"price\":%s,\"changePct\":%s,\"timestamp\":%d}",
                symbol, price, changePct, System.currentTimeMillis()
            );

            TextMessage wsMessage = new TextMessage(json);
            int sent = 0;

            for (Map.Entry<String, WebSocketSession> entry : sessions.entrySet()) {
                String sessionId = entry.getKey();
                WebSocketSession session = entry.getValue();

                if (!session.isOpen()) {
                    removeSession(sessionId);
                    continue;
                }

                Set<String> subs = subscriptions.get(sessionId);
                if (subs != null && subs.contains(symbol)) {
                    try {
                        synchronized (session) {
                            session.sendMessage(wsMessage);
                        }
                        sent++;
                    } catch (Exception e) {
                        log.warn("[Bridge] Send failed for session {}: {}", sessionId, e.getMessage());
                        removeSession(sessionId);
                    }
                }
            }

            if (sent > 0) {
                log.debug("[Bridge] Fanned out {} → {} sessions", symbol, sent);
            }

        } catch (Exception e) {
            log.error("[Bridge] onMessage error: {}", e.getMessage());
        }
    }
}
