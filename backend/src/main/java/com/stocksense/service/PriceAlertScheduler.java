package com.stocksense.service;

import com.stocksense.model.Notification;
import com.stocksense.model.User;
import com.stocksense.model.WatchlistItem;
import com.stocksense.repository.NotificationRepository;
import com.stocksense.repository.UserRepository;
import com.stocksense.repository.WatchlistRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

@Service
public class PriceAlertScheduler {

    private static final Logger log = LoggerFactory.getLogger(PriceAlertScheduler.class);

    private final WatchlistRepository    watchlistRepository;
    private final NotificationRepository notificationRepository;
    private final AlphaVantageService    alphaVantageService;
    private final EmailService           emailService;
    private final UserRepository         userRepository;

    public PriceAlertScheduler(WatchlistRepository watchlistRepository,
                               NotificationRepository notificationRepository,
                               AlphaVantageService alphaVantageService,
                               EmailService emailService,
                               UserRepository userRepository) {
        this.watchlistRepository    = watchlistRepository;
        this.notificationRepository = notificationRepository;
        this.alphaVantageService    = alphaVantageService;
        this.emailService           = emailService;
        this.userRepository         = userRepository;
    }

    /**
     * Runs every 5 minutes.
     * fixedDelay = 5 * 60 * 1000 ms, initialDelay = 30s so app fully starts first.
     */
    @Scheduled(fixedDelay = 300_000, initialDelay = 30_000)
    public void checkPriceAlerts() {
        log.info("[PriceAlertScheduler] Running price alert check…");

        List<WatchlistItem> items = watchlistRepository.findAll()
            .stream()
            .filter(w -> w.getAlertPrice() != null)
            .toList();

        if (items.isEmpty()) {
            log.info("[PriceAlertScheduler] No watchlist items with alert prices — skipping.");
            return;
        }

        for (WatchlistItem item : items) {
            try {
                processItem(item);
            } catch (Exception e) {
                log.warn("[PriceAlertScheduler] Error processing {}: {}", item.getSymbol(), e.getMessage());
            }
        }

        log.info("[PriceAlertScheduler] Done. Processed {} items.", items.size());
    }

    private void processItem(WatchlistItem item) {
        String symbol    = item.getSymbol();
        BigDecimal alert = item.getAlertPrice();

        Map<String, Object> quote = alphaVantageService.getQuote(symbol);
        if (quote == null || quote.get("price") == null) {
            log.debug("[PriceAlertScheduler] No quote for {}", symbol);
            return;
        }

        BigDecimal current = new BigDecimal(quote.get("price").toString())
            .setScale(4, RoundingMode.HALF_UP);

        BigDecimal last = item.getLastCheckedPrice();

        item.setLastCheckedPrice(current);
        watchlistRepository.save(item);

        if (last == null) {
            log.debug("[PriceAlertScheduler] First check for {} — recording price {}", symbol, current);
            return;
        }

        boolean wasBelow = last.compareTo(alert) < 0;
        boolean wasAbove = last.compareTo(alert) > 0;
        boolean nowAbove = current.compareTo(alert) >= 0;
        boolean nowBelow = current.compareTo(alert) <= 0;

        boolean crossedUp   = wasBelow && nowAbove;
        boolean crossedDown = wasAbove && nowBelow;

        if (crossedUp) {
            fireNotification(item, current, alert, "above");
        } else if (crossedDown) {
            fireNotification(item, current, alert, "below");
        }
    }

    private void fireNotification(WatchlistItem item, BigDecimal current,
                                  BigDecimal alert, String direction) {
        String symbol = item.getSymbol().replace(".BSE", "").replace(".NSE", "");
        String title  = symbol + " price alert triggered";
        String msg    = String.format(
            "%s has moved %s your alert of %s — current price is %s.",
            symbol, direction, alert.toPlainString(), current.toPlainString()
        );

        // Save in-app notification
        Notification notif = new Notification(
            item.getUserId(),
            Notification.Type.PRICE_ALERT,
            title,
            msg,
            symbol
        );
        notificationRepository.save(notif);

        // Send email to user's registered address
        userRepository.findById(item.getUserId()).ifPresentOrElse(
            user -> emailService.sendPriceAlert(
                user.getEmail(),
                user.getName() != null ? user.getName() : "Investor",
                symbol,
                direction,
                alert,
                current
            ),
            () -> log.warn("[PriceAlertScheduler] User {} not found — skipping email", item.getUserId())
        );

        log.info("[PriceAlertScheduler] Fired alert for {} ({}) — crossed {} alert {}",
            symbol, item.getUserId(), direction, alert);
    }
}