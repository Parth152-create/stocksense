package com.stocksense.service;

import com.stocksense.model.Notification;
import com.stocksense.model.Order;
import com.stocksense.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * OrderExecutionService
 *
 * Runs every 60 seconds and checks all PENDING orders against live prices.
 * On trigger: executes the order, saves it, and creates an in-app notification.
 *
 * Execution rules:
 *   LIMIT  BUY       → trigger if livePrice ≤ limitPrice  (buy cheap)
 *   LIMIT  SELL      → trigger if livePrice ≥ limitPrice  (sell high)
 *   STOP_LOSS SELL   → trigger if livePrice ≤ limitPrice  (cut losses)
 *   STOP_LOSS BUY    → trigger if livePrice ≥ limitPrice  (breakout entry)
 */
@Service
public class OrderExecutionService {

    private static final Logger log = LoggerFactory.getLogger(OrderExecutionService.class);

    private final OrderRepository       orderRepository;
    private final AlphaVantageService   alphaVantageService;
    private final NotificationService   notificationService;

    public OrderExecutionService(OrderRepository orderRepository,
                                 AlphaVantageService alphaVantageService,
                                 NotificationService notificationService) {
        this.orderRepository     = orderRepository;
        this.alphaVantageService = alphaVantageService;
        this.notificationService = notificationService;
    }

    // ── Scheduled job — every 60 seconds ─────────────────────────────────────

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void checkPendingOrders() {
        List<Order> pending = orderRepository.findByStatus("PENDING");

        if (pending.isEmpty()) {
            log.debug("[OrderEngine] No pending orders — skipping cycle.");
            return;
        }

        log.info("[OrderEngine] Checking {} pending order(s).", pending.size());

        int executed = 0, skipped = 0, errors = 0;

        for (Order order : pending) {
            try {
                boolean triggered = evaluate(order);
                if (triggered) executed++;
                else           skipped++;
            } catch (Exception e) {
                errors++;
                log.warn("[OrderEngine] Error evaluating order id={} symbol={}: {}",
                        order.getId(), order.getSymbol(), e.getMessage());
            }
        }

        log.info("[OrderEngine] Cycle done — executed={} skipped={} errors={}",
                executed, skipped, errors);
    }

    // ── Core evaluation ───────────────────────────────────────────────────────

    private boolean evaluate(Order order) {
        if (order.getLimitPrice() == null) {
            log.warn("[OrderEngine] Order id={} is PENDING but has no limitPrice — skipping.", order.getId());
            return false;
        }

        double livePrice = fetchLivePrice(order.getSymbol());
        if (livePrice <= 0) {
            log.debug("[OrderEngine] Could not fetch live price for {} — skipping.", order.getSymbol());
            return false;
        }

        double limitPrice    = order.getLimitPrice().doubleValue();
        boolean shouldExecute = shouldTrigger(order.getKind(), order.getType(), livePrice, limitPrice);

        if (!shouldExecute) {
            log.debug("[OrderEngine] Order id={} {} {} @ limit={} | live={} — not triggered.",
                    order.getId(), order.getKind(), order.getType(), limitPrice, livePrice);
            return false;
        }

        // ── Execute ───────────────────────────────────────────────────────────
        BigDecimal fillPrice = BigDecimal.valueOf(livePrice);
        BigDecimal fillTotal = fillPrice.multiply(BigDecimal.valueOf(order.getQuantity()));

        order.setPrice(fillPrice);
        order.setTotal(fillTotal);
        order.setStatus("EXECUTED");
        order.setTriggeredAt(LocalDateTime.now());
        orderRepository.save(order);

        log.info("[OrderEngine] ✅ Executed order id={} | {} {} {} | limit={} | fill={}",
                order.getId(), order.getKind(), order.getType(),
                order.getSymbol(), limitPrice, livePrice);

        // ── In-app notification ───────────────────────────────────────────────
        try {
            UUID userId = UUID.fromString(order.getUserId());

            String direction = order.getType() == Order.OrderType.BUY ? "bought" : "sold";
            String kindLabel = order.getKind() == Order.OrderKind.STOP_LOSS ? "Stop-Loss" : "Limit";

            String title = String.format("%s order executed — %s",
                    kindLabel, order.getSymbol());

            String message = String.format(
                    "Your %s %s order for %d share%s of %s was filled at $%.2f (limit: $%.2f).",
                    kindLabel.toLowerCase(),
                    direction,
                    order.getQuantity(),
                    order.getQuantity() == 1 ? "" : "s",
                    order.getSymbol(),
                    livePrice,
                    limitPrice
            );

            notificationService.createNotification(
                    userId,
                    Notification.Type.ORDER_FILLED,
                    title,
                    message,
                    order.getSymbol()
            );
        } catch (Exception e) {
            // Never let notification failure crash the execution
            log.warn("[OrderEngine] Failed to create notification for order id={}: {}",
                    order.getId(), e.getMessage());
        }

        return true;
    }

    // ── Trigger logic ─────────────────────────────────────────────────────────

    private boolean shouldTrigger(Order.OrderKind kind,
                                   Order.OrderType type,
                                   double livePrice,
                                   double limitPrice) {
        return switch (kind) {
            case LIMIT -> switch (type) {
                case BUY  -> livePrice <= limitPrice;
                case SELL -> livePrice >= limitPrice;
            };
            case STOP_LOSS -> switch (type) {
                case SELL -> livePrice <= limitPrice;
                case BUY  -> livePrice >= limitPrice;
            };
            case MARKET -> false;
        };
    }

    // ── Live price fetch ──────────────────────────────────────────────────────

    private double fetchLivePrice(String symbol) {
        try {
            Map<String, Object> quote = alphaVantageService.getQuote(symbol);
            if (quote != null && quote.get("price") instanceof Number n) {
                return n.doubleValue();
            }
        } catch (Exception e) {
            log.debug("[OrderEngine] Price fetch failed for {}: {}", symbol, e.getMessage());
        }
        return 0;
    }
}