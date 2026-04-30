package com.stocksense.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    /**
     * Cache strategy designed for Alpha Vantage free tier (25 req/day):
     *
     *  stockQuote   — 15 min TTL  (individual quote, most volatile)
     *  stockHistory — 60 min TTL  (daily OHLCV, changes once/day)
     *  stockSearch  — 60 min TTL  (search results rarely change)
     *  batchQuotes  — 15 min TTL  (market list snapshots)
     *  marketList   — 24 hr TTL   (static symbol lists)
     */

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.registerCustomCache("stockQuote",
            Caffeine.newBuilder().expireAfterWrite(15, TimeUnit.MINUTES).maximumSize(500).build());
        manager.registerCustomCache("stockHistory",
            Caffeine.newBuilder().expireAfterWrite(60, TimeUnit.MINUTES).maximumSize(200).build());
        manager.registerCustomCache("stockSearch",
            Caffeine.newBuilder().expireAfterWrite(60, TimeUnit.MINUTES).maximumSize(100).build());
        manager.registerCustomCache("batchQuotes",
            Caffeine.newBuilder().expireAfterWrite(15, TimeUnit.MINUTES).maximumSize(50).build());
        manager.registerCustomCache("marketList",
            Caffeine.newBuilder().expireAfterWrite(24, TimeUnit.HOURS).maximumSize(10).build());
        return manager;
    }
}