package com.stocksense.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stocksense.model.Notification;
import com.stocksense.repository.HoldingRepository;
import com.stocksense.repository.WatchlistRepository;
import com.stocksense.model.WatchlistItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * PriceIngestionService
 *
 * Polls all active symbols every 60 seconds.
 * Writes price data to Redis: price:{symbol} with 90s TTL.
 * Publishes to Redis Pub/Sub channel "prices" in format SYMBOL:price:changePct
 * Checks price alerts after each write.
 *
 * StockService.getQuote() should read from Redis key price:{symbol} first,
 * falling back to direct API only on miss (handled in getQuote via @Cacheable).
 */
@Service
public class PriceIngestionService {

    private static final Logger log = LoggerFactory.getLogger(PriceIngestionService.class);

    private static final String PRICE_KEY_PREFIX = "price:";
    private static final String PRICES_CHANNEL   = "prices";
    private static final Duration PRICE_TTL      = Duration.ofSeconds(90);

    private final StringRedisTemplate   redisTemplate;
    private final StockService          stockService;
    private final WatchlistRepository   watchlistRepository;
    private final HoldingRepository     holdingRepository;
    private final NotificationService   notificationService;
    private final UserService           userService;
    private final EmailService          emailService;
    private final ObjectMapper          mapper = new ObjectMapper();

    @Value("${ml.service.url:http://ml-service:8082}")
    private String mlServiceUrl;

    private final java.net.http.HttpClient mlHttpClient = java.net.http.HttpClient.newBuilder()
        .connectTimeout(java.time.Duration.ofSeconds(3))
        .build();

    public PriceIngestionService(StringRedisTemplate redisTemplate,
                                 StockService stockService,
                                 WatchlistRepository watchlistRepository,
                                 HoldingRepository holdingRepository,
                                 NotificationService notificationService,
                                 UserService userService,
                                 EmailService emailService) {
        this.redisTemplate       = redisTemplate;
        this.stockService        = stockService;
        this.watchlistRepository = watchlistRepository;
        this.holdingRepository   = holdingRepository;
        this.notificationService = notificationService;
        this.userService         = userService;
        this.emailService        = emailService;
    }

    // ── Main ingestion cycle ──────────────────────────────────────────────────

    @Scheduled(fixedDelay = 60_000, initialDelay = 15_000)
    public void ingest() {
        Set<String> symbols = collectActiveSymbols();
        if (symbols.isEmpty()) {
            log.debug("[PriceIngestion] No active symbols — skipping cycle.");
            return;
        }

        log.info("[PriceIngestion] Ingesting {} symbols: {}", symbols.size(), symbols);

        for (String symbol : symbols) {
            try {
                processSymbol(symbol);
            } catch (Exception e) {
                log.warn("[PriceIngestion] Failed for {}: {}", symbol, e.getMessage());
            }
        }
    }

    // ── Per-symbol processing ─────────────────────────────────────────────────

    private void processSymbol(String symbol) {
        Map<String, Object> quote = stockService.getQuote(symbol);

        double price, changePct;

        if (quote == null || quote.isEmpty()) {
            // Try to read stale cache and mark delayed
            String staleJson = redisTemplate.opsForValue().get(PRICE_KEY_PREFIX + symbol);
            if (staleJson != null) {
                try {
                    Map<String, Object> stale = mapper.readValue(staleJson,
                        mapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
                    stale.put("delayed", true);
                    redisTemplate.opsForValue().set(
                        PRICE_KEY_PREFIX + symbol,
                        mapper.writeValueAsString(stale),
                        PRICE_TTL
                    );
                    log.warn("[PriceIngestion] Using stale cache for {} (delayed=true)", symbol);
                } catch (Exception e) {
                    log.warn("[PriceIngestion] Could not refresh stale cache for {}: {}", symbol, e.getMessage());
                }
            }
            return;
        }

        price     = toDouble(quote.get("price"));
        changePct = toDouble(quote.get("changePct"));

        if (price <= 0) return;

        // Write to Redis: price:{symbol}
        try {
            quote.put("delayed", false);
            quote.put("cachedAt", System.currentTimeMillis());
            String json = mapper.writeValueAsString(quote);
            redisTemplate.opsForValue().set(PRICE_KEY_PREFIX + symbol, json, PRICE_TTL);
        } catch (Exception e) {
            log.error("[PriceIngestion] Redis write failed for {}: {}", symbol, e.getMessage());
            return;
        }

        // Publish to Pub/Sub: prices channel → "SYMBOL:price:changePct"
        String message = symbol + ":" + price + ":" + changePct;
        redisTemplate.convertAndSend(PRICES_CHANNEL, message);

        // Check price alerts for this symbol
        checkPriceAlerts(symbol, BigDecimal.valueOf(price));

        // Check anomaly detection
        checkAnomaly(symbol);
    }

    // ── Price alert execution (Task 13) ───────────────────────────────────────

    private void checkPriceAlerts(String symbol, BigDecimal currentPrice) {
        List<WatchlistItem> items = watchlistRepository
            .findBySymbolAndAlertPriceIsNotNull(symbol);

        for (WatchlistItem item : items) {
            try {
                BigDecimal alertPrice = item.getAlertPrice();
                BigDecimal lastPrice  = item.getLastCheckedPrice();

                // Always update lastCheckedPrice
                item.setLastCheckedPrice(currentPrice);
                watchlistRepository.save(item);

                if (lastPrice == null) continue; // first check, no direction yet

                boolean wasBelow  = lastPrice.compareTo(alertPrice) < 0;
                boolean wasAbove  = lastPrice.compareTo(alertPrice) > 0;
                boolean nowAbove  = currentPrice.compareTo(alertPrice) >= 0;
                boolean nowBelow  = currentPrice.compareTo(alertPrice) <= 0;

                boolean crossedUp   = wasBelow && nowAbove;
                boolean crossedDown = wasAbove && nowBelow;

                if (!crossedUp && !crossedDown) continue;

                String direction = crossedUp ? "above" : "below";
                String cleanSymbol = symbol.replace(".NS", "").replace(".BSE", "");
                String title = cleanSymbol + " price alert triggered";
                String msg = String.format(
                    "%s has moved %s your alert of %s — current price is %s.",
                    cleanSymbol, direction,
                    alertPrice.setScale(2, RoundingMode.HALF_UP).toPlainString(),
                    currentPrice.setScale(2, RoundingMode.HALF_UP).toPlainString()
                );

                // Create in-app notification
                notificationService.createNotification(
                    item.getUserId(),
                    Notification.Type.PRICE_ALERT,
                    title, msg, cleanSymbol
                );

                // Clear alert so it doesn't spam
                item.setAlertPrice(null);
                watchlistRepository.save(item);

                // Send email
                userService.findById(item.getUserId()).ifPresent(user ->
                    emailService.sendPriceAlert(
                        user.getEmail(),
                        user.getName() != null ? user.getName() : "Investor",
                        cleanSymbol, direction, alertPrice, currentPrice
                    )
                );

                log.info("[PriceIngestion] Alert fired for {} userId={} — crossed {} {}",
                    symbol, item.getUserId(), direction, alertPrice);

            } catch (Exception e) {
                log.warn("[PriceIngestion] Alert check failed for {} / {}: {}",
                    symbol, item.getUserId(), e.getMessage());
            }
        }
    }

    // ── Anomaly detection ─────────────────────────────────────────────────────

    private void checkAnomaly(String symbol) {
        try {
            String clean = symbol.replace(".NS","").replace(".BSE","");
            java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(mlServiceUrl + "/ml/anomaly/" + clean))
                .timeout(java.time.Duration.ofSeconds(5))
                .GET().build();

            java.net.http.HttpResponse<String> resp = mlHttpClient.send(req,
                java.net.http.HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() != 200) return;

            Map<String, Object> anomaly = mapper.readValue(resp.body(),
                mapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class));

            boolean isAnomaly = Boolean.TRUE.equals(anomaly.get("is_anomaly"));
            if (!isAnomaly) return;

            String severity = String.valueOf(anomaly.getOrDefault("severity", "normal"));
            String summary  = String.valueOf(anomaly.getOrDefault("summary", ""));
            if (summary.isEmpty()) return;

            // Notify all users who watch or hold this symbol
            watchlistRepository.findBySymbolAndAlertPriceIsNotNull(symbol).stream()
                .map(WatchlistItem::getUserId)
                .distinct()
                .forEach(userId -> notificationService.createNotification(
                    userId,
                    Notification.Type.PRICE_ALERT,
                    "Anomaly detected: " + clean,
                    summary + " (Severity: " + severity + ")",
                    clean
                ));

            log.info("[PriceIngestion] Anomaly notification sent for {} — {}", symbol, severity);
        } catch (Exception e) {
            log.debug("[PriceIngestion] Anomaly check skipped for {}: {}", symbol, e.getMessage());
        }
    }

    // ── Collect all active symbols ────────────────────────────────────────────

    private Set<String> collectActiveSymbols() {
        Set<String> symbols = new HashSet<>();

        // From watchlists
        try {
            watchlistRepository.findAll()
                .forEach(w -> { if (w.getSymbol() != null) symbols.add(w.getSymbol().toUpperCase()); });
        } catch (Exception e) {
            log.warn("[PriceIngestion] Could not load watchlist symbols: {}", e.getMessage());
        }

        // From open holdings
        try {
            holdingRepository.findAll()
                .forEach(h -> { if (h.getSymbol() != null) symbols.add(h.getSymbol().toUpperCase()); });
        } catch (Exception e) {
            log.warn("[PriceIngestion] Could not load holding symbols: {}", e.getMessage());
        }

        return symbols;
    }

    // ── Util ──────────────────────────────────────────────────────────────────

    private double toDouble(Object val) {
        if (val == null) return 0;
        try { return ((Number) val).doubleValue(); }
        catch (Exception e) { return 0; }
    }
}