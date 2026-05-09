package com.stocksense.scheduler;

import com.stocksense.model.Notification;
import com.stocksense.model.WatchlistItem;
import com.stocksense.repository.NotificationRepository;
import com.stocksense.repository.WatchlistRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Component
public class PriceAlertJob {

    private static final Logger log = LoggerFactory.getLogger(PriceAlertJob.class);

    private static final String ALPHA_VANTAGE_URL =
        "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={apiKey}";

    @Value("${alphavantage.api.key:HXW27CL9C8V78EXL}")
    private String apiKey;

    @Autowired
    private WatchlistRepository watchlistRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    @Scheduled(fixedDelay = 5 * 60 * 1000)
    @Transactional
    public void checkPriceAlerts() {
        List<WatchlistItem> alertItems = watchlistRepository.findAllWithAlertPrice();

        if (alertItems.isEmpty()) return;

        log.info("[PriceAlertJob] Checking {} alert(s)...", alertItems.size());

        for (WatchlistItem item : alertItems) {
            try {
                BigDecimal currentPrice = fetchCurrentPrice(item.getSymbol());
                if (currentPrice == null) continue;

                BigDecimal alertPrice = item.getAlertPrice();
                BigDecimal lastPrice  = item.getLastCheckedPrice();

                boolean shouldFire = false;
                String direction = "";

                if (lastPrice != null) {
                    if (alertPrice.compareTo(lastPrice) > 0
                            && currentPrice.compareTo(alertPrice) >= 0) {
                        shouldFire = true;
                        direction = "above";
                    } else if (alertPrice.compareTo(lastPrice) < 0
                            && currentPrice.compareTo(alertPrice) <= 0) {
                        shouldFire = true;
                        direction = "below";
                    }
                } else {
                    if (currentPrice.compareTo(alertPrice) >= 0) {
                        shouldFire = true;
                        direction = "above";
                    } else if (currentPrice.compareTo(alertPrice) <= 0) {
                        shouldFire = true;
                        direction = "below";
                    }
                }

                item.setLastCheckedPrice(currentPrice);
                watchlistRepository.save(item);

                if (shouldFire) {
                    String message = String.format(
                        "%s price alert: $%.2f crossed %s your target of $%.2f",
                        item.getSymbol(),
                        currentPrice,
                        direction,
                        alertPrice
                    );

                    Notification notification = new Notification(
                        item.getUserId(),
                        Notification.Type.PRICE_ALERT,
                        item.getSymbol() + " Price Alert",
                        message,
                        item.getSymbol()
                    );
                    notificationRepository.save(notification);

                    log.info("[PriceAlertJob] Fired alert for user {} — {}", item.getUserId(), message);

                    item.setAlertPrice(null);
                    watchlistRepository.save(item);
                }

            } catch (Exception e) {
                log.error("[PriceAlertJob] Error checking alert for {}: {}", item.getSymbol(), e.getMessage());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private BigDecimal fetchCurrentPrice(String symbol) {
        try {
            Map<String, Object> response = restTemplate.getForObject(
                ALPHA_VANTAGE_URL, Map.class, symbol, apiKey
            );
            if (response == null) return null;

            Map<String, String> quote = (Map<String, String>) response.get("Global Quote");
            if (quote == null || quote.isEmpty()) return null;

            String priceStr = quote.get("05. price");
            if (priceStr == null || priceStr.isBlank()) return null;

            return new BigDecimal(priceStr.trim());
        } catch (Exception e) {
            log.warn("[PriceAlertJob] Failed to fetch price for {}: {}", symbol, e.getMessage());
            return null;
        }
    }
}