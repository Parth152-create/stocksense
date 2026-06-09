package com.stocksense.config;

import com.stocksense.websocket.PriceWebSocketHandler;
import com.stocksense.websocket.RedisWebSocketBridge;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PriceWebSocketHandler priceWebSocketHandler;
    private final RedisWebSocketBridge  redisWebSocketBridge;

    public WebSocketConfig(PriceWebSocketHandler priceWebSocketHandler,
                           RedisWebSocketBridge redisWebSocketBridge) {
        this.priceWebSocketHandler = priceWebSocketHandler;
        this.redisWebSocketBridge  = redisWebSocketBridge;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(priceWebSocketHandler, "/ws/prices")
                .setAllowedOriginPatterns("*");
    }

    // ── Redis Pub/Sub listener container ─────────────────────────────────────

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory) {

        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(redisWebSocketBridge, new ChannelTopic("prices"));
        return container;
    }
}
