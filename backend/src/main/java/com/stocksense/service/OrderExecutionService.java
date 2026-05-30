package com.stocksense.service;

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

/**
 * OrderExecutionService
 *
 * Runs every 60 seconds and checks all PENDING orders against live prices.
 *
 * Execution rules:
 *   LIMIT  BUY       → trigger if livePrice ≤ limitPrice  (buy cheap)
 *   LIMIT  SELL      → trigger if livePrice ≥ limitPrice  (sell high)
 *   STOP_LOSS SELL   → trigger if livePrice ≤ limitPrice  (cut losses)
 *   STOP_LOSS BUY    → trigger if livePrice ≥ limitPrice  (breakout entry)
 *
 * On trigger:
 *   - Sets order.price       = livePrice  (actual fill price)
 *   - Sets order.total       = livePrice × quantity
 *   - Sets order.status      = "EXECUTED"
 *   - Sets order.triggeredAt = now()
 *   - Persists via OrderRepository.save()
 */
@Service
public class OrderExecutionService {

    private static final Logger log = LoggerFactory.getLogger(OrderExecutionService.class);

    private final OrderRepository     orderRepository;
    private final AlphaVantageService alphaVantageService;

    public OrderExecutionService(OrderRepository orderRepository,
                                 AlphaVantageService alphaVantageService) {
        this.orderRepository     = orderRepository;
        this.alphaVantageService = alphaVantageService;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scheduled job — every 60 seconds
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Main execution loop. Spring calls this every 60 s after the previous
     * run completes (fixedDelay = wall-clock gap between end of last run
     * and start of next, so no pile-up if a run takes longer than 60 s).
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void checkPendingOrders() {
        List<Order> pending = orderRepository.findByStatus("PENDING");

        if (pending.isEmpty()) {
            log.debug("[OrderEngine] No pending orders — skipping cycle.");
            return;
        }

        log.info("[OrderEngine] Checking {} pending order(s).", pending.size());

        int executed = 0;
        int skipped  = 0;
        int errors   = 0;

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

    // ─────────────────────────────────────────────────────────────────────────
    // Core evaluation logic
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Evaluates a single pending order against the current live price.
     *
     * @return true if the order was triggered and saved, false if conditions
     *         not met yet (order stays PENDING).
     */
    private boolean evaluate(Order order) {
        if (order.getLimitPrice() == null) {
            // Shouldn't happen — MARKET orders are EXECUTED at creation time.
            // Defensively skip if somehow a market order ends up here.
            log.warn("[OrderEngine] Order id={} is PENDING but has no limitPrice — skipping.", order.getId());
            return false;
        }

        double livePrice = fetchLivePrice(order.getSymbol());
        if (livePrice <= 0) {
            log.debug("[OrderEngine] Could not fetch live price for {} — skipping.", order.getSymbol());
            return false;
        }

        double limitPrice = order.getLimitPrice().doubleValue();
        boolean shouldExecute = shouldTrigger(order.getKind(), order.getType(), livePrice, limitPrice);

        if (!shouldExecute) {
            log.debug("[OrderEngine] Order id={} {} {} @ limit={} | live={} — not triggered.",
                    order.getId(), order.getKind(), order.getType(), limitPrice, livePrice);
            return false;
        }

        // ── Execute the order ──────────────────────────────────────────────
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

        return true;
    }

    /**
     * Pure trigger logic — no side effects.
     *
     * LIMIT  BUY       → buy when price falls to or below limit  (get a deal)
     * LIMIT  SELL      → sell when price rises to or above limit (take profit)
     * STOP_LOSS SELL   → sell when price falls to or below limit (cut losses)
     * STOP_LOSS BUY    → buy  when price rises to or above limit (breakout)
     */
    private boolean shouldTrigger(Order.OrderKind kind,
                                   Order.OrderType type,
                                   double livePrice,
                                   double limitPrice) {
        return switch (kind) {
            case LIMIT -> switch (type) {
                case BUY  -> livePrice <= limitPrice;   // buy cheap
                case SELL -> livePrice >= limitPrice;   // sell high
            };
            case STOP_LOSS -> switch (type) {
                case SELL -> livePrice <= limitPrice;   // stop out
                case BUY  -> livePrice >= limitPrice;   // breakout entry
            };
            case MARKET -> false; // market orders never pending — skip
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Live price fetch (with fallback to 0 on any failure)
    // ─────────────────────────────────────────────────────────────────────────

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