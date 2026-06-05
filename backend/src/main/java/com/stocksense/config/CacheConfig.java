package com.stocksense.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

/**
 * CacheConfig
 *
 * Replaces the previous Caffeine-based CacheManager with Redis.
 * Cache names and TTLs are preserved from the Caffeine config so
 * no call sites need to change.
 *
 * TTL strategy (same as Caffeine):
 *   stockQuote   → 15 min  (live price data, short window)
 *   stockHistory → 60 min  (OHLCV candles, changes slowly)
 *   stockSearch  →  5 min  (search results, rate-limit recovery)
 *   batchQuotes  → 15 min  (multi-symbol batch)
 *   marketList   → 24 hr   (market overview, very stable)
 *
 * Keys are prefixed "ss:" so they're easy to identify in Redis CLI.
 * Values are serialized as JSON (GenericJackson2JsonRedisSerializer) so
 * they're human-readable in RedisInsight / redis-cli.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    private static final String KEY_PREFIX = "ss:";

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {

        // ── Base config: JSON values + string keys ────────────────────────
        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
            .prefixCacheNameWith(KEY_PREFIX)
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new StringRedisSerializer()))
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues();

        // ── Per-cache TTL overrides ────────────────────────────────────────
        Map<String, RedisCacheConfiguration> cacheConfigs = Map.of(
            "stockQuote",   base.entryTtl(Duration.ofMinutes(15)),
            "stockHistory", base.entryTtl(Duration.ofMinutes(60)),
            "stockSearch",  base.entryTtl(Duration.ofMinutes(5)),
            "batchQuotes",  base.entryTtl(Duration.ofMinutes(15)),
            "marketList",   base.entryTtl(Duration.ofHours(24))
        );

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(base.entryTtl(Duration.ofMinutes(10)))
            .withInitialCacheConfigurations(cacheConfigs)
            .build();
    }
}