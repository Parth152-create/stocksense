package com.stocksense.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.stocksense.websocket.PriceWebSocketHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PriceWebSocketHandler priceWebSocketHandler;

    public WebSocketConfig(PriceWebSocketHandler priceWebSocketHandler) {
        this.priceWebSocketHandler = priceWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry
            .addHandler(priceWebSocketHandler, "/ws/prices")
            .setAllowedOrigins("http://localhost:3000", "http://127.0.0.1:3000");
    }
}