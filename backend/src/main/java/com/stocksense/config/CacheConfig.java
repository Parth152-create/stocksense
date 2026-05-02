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

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.registerCustomCache("stockQuote",
            Caffeine.newBuilder().expireAfterWrite(15, TimeUnit.MINUTES).maximumSize(500).build());
        manager.registerCustomCache("stockHistory",
            Caffeine.newBuilder().expireAfterWrite(60, TimeUnit.MINUTES).maximumSize(200).build());
        // 5 min TTL — short so stale empty results from rate-limit spikes expire fast
        manager.registerCustomCache("stockSearch",
            Caffeine.newBuilder().expireAfterWrite(5, TimeUnit.MINUTES).maximumSize(100).build());
        manager.registerCustomCache("batchQuotes",
            Caffeine.newBuilder().expireAfterWrite(15, TimeUnit.MINUTES).maximumSize(50).build());
        manager.registerCustomCache("marketList",
            Caffeine.newBuilder().expireAfterWrite(24, TimeUnit.HOURS).maximumSize(10).build());
        return manager;
    }
}