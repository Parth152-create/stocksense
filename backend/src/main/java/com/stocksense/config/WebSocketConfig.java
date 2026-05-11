package com.stocksense.config;

import com.stocksense.service.JwtService;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;
import java.util.concurrent.*;

@Configuration
@EnableWebSocket
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketConfigurer, WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;

    public WebSocketConfig(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    // ── Raw WebSocket at /ws/prices (used by frontend) ────────────────────────
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(priceHandler(), "/ws/prices")
                .setAllowedOriginPatterns("*")
                .addInterceptors(jwtInterceptor());
    }

    // ── STOMP broker (kept for future use) ────────────────────────────────────
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/stomp")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    // ── Price WebSocket handler ───────────────────────────────────────────────

    private WebSocketHandler priceHandler() {
        return new TextWebSocketHandler() {
            private final ScheduledExecutorService scheduler =
                    Executors.newSingleThreadScheduledExecutor();

            @Override
            public void afterConnectionEstablished(WebSocketSession session) {
                String email = (String) session.getAttributes().getOrDefault("email", "anon");
                System.out.println("[WS] Connected: " + session.getId() + " (" + email + ")");

                scheduler.scheduleAtFixedRate(() -> {
                    if (!session.isOpen()) return;
                    try {
                        String[] symbols = {
                            "RELIANCE","TCS","INFY","HDFCBANK","WIPRO",
                            "AAPL","MSFT","NVDA","TSLA","GOOGL"
                        };
                        for (String sym : symbols) {
                            double base   = 100 + (Math.abs(sym.hashCode()) % 900);
                            double price  = base + (Math.random() - 0.5) * 10;
                            double change = (Math.random() - 0.48) * 3;
                            String msg = String.format(
                                "{\"symbol\":\"%s\",\"price\":%.2f,\"changePct\":%.2f}",
                                sym, price, change
                            );
                            session.sendMessage(new TextMessage(msg));
                        }
                    } catch (Exception e) {
                        System.out.println("[WS] Send error: " + e.getMessage());
                    }
                }, 1, 3, TimeUnit.SECONDS);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                System.out.println("[WS] Disconnected: " + session.getId());
            }

            @Override
            public void handleTransportError(WebSocketSession session, Throwable ex) {
                System.out.println("[WS] Error: " + ex.getMessage());
            }
        };
    }

    // ── JWT handshake interceptor ─────────────────────────────────────────────

    private HandshakeInterceptor jwtInterceptor() {
        return new HandshakeInterceptor() {
            @Override
            public boolean beforeHandshake(ServerHttpRequest req, ServerHttpResponse res,
                                           WebSocketHandler handler, Map<String, Object> attrs) {
                String query = req.getURI().getQuery();
                if (query != null) {
                    for (String param : query.split("&")) {
                        if (param.startsWith("token=")) {
                            String token = param.substring(6);
                            try {
                                String email = jwtService.extractEmail(token);
                                attrs.put("email", email != null ? email : "unknown");
                            } catch (Exception e) {
                                attrs.put("email", "invalid");
                            }
                            break;
                        }
                    }
                }
                attrs.putIfAbsent("email", "anonymous");
                return true;
            }

            @Override
            public void afterHandshake(ServerHttpRequest req, ServerHttpResponse res,
                                       WebSocketHandler handler, Exception ex) {}
        };
    }
}