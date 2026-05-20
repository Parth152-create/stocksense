package com.stocksense.service;

import com.stocksense.model.Order;
import com.stocksense.model.WalletBalance;
import com.stocksense.model.WalletTransaction;
import com.stocksense.repository.OrderRepository;
import com.stocksense.repository.WalletBalanceRepository;
import com.stocksense.repository.WalletTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class LimitOrderScheduler {

    private static final Logger log = LoggerFactory.getLogger(LimitOrderScheduler.class);

    private final OrderRepository             orderRepository;
    private final WalletBalanceRepository     walletBalanceRepository;
    private final WalletTransactionRepository walletTxRepository;
    private final AlphaVantageService         alphaVantageService;

    public LimitOrderScheduler(OrderRepository orderRepository,
                               WalletBalanceRepository walletBalanceRepository,
                               WalletTransactionRepository walletTxRepository,
                               AlphaVantageService alphaVantageService) {
        this.orderRepository         = orderRepository;
        this.walletBalanceRepository = walletBalanceRepository;
        this.walletTxRepository      = walletTxRepository;
        this.alphaVantageService     = alphaVantageService;
    }

    /**
     * Runs every 60 seconds.
     * Checks all PENDING limit/stop-loss orders against current market price.
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void checkLimitOrders() {
        List<Order> pending = orderRepository.findByStatus("PENDING");
        if (pending.isEmpty()) return;

        log.info("[LimitOrderScheduler] Checking {} pending orders…", pending.size());

        for (Order order : pending) {
            try {
                processOrder(order);
            } catch (Exception e) {
                log.warn("[LimitOrderScheduler] Error processing order {}: {}", order.getId(), e.getMessage());
            }
        }
    }

    private void processOrder(Order order) {
        Map<String, Object> quote = alphaVantageService.getQuote(order.getSymbol());
        if (quote == null || quote.get("price") == null) return;

        BigDecimal currentPrice = new BigDecimal(quote.get("price").toString());
        BigDecimal limitPrice   = order.getLimitPrice();
        if (limitPrice == null) return;

        boolean shouldExecute = false;

        if (order.getKind() == Order.OrderKind.LIMIT) {
            if (order.getType() == Order.OrderType.BUY) {
                // BUY LIMIT: execute when price drops to or below limit
                shouldExecute = currentPrice.compareTo(limitPrice) <= 0;
            } else {
                // SELL LIMIT: execute when price rises to or above limit
                shouldExecute = currentPrice.compareTo(limitPrice) >= 0;
            }
        } else if (order.getKind() == Order.OrderKind.STOP_LOSS) {
            if (order.getType() == Order.OrderType.BUY) {
                // BUY STOP: execute when price rises to or above stop
                shouldExecute = currentPrice.compareTo(limitPrice) >= 0;
            } else {
                // SELL STOP_LOSS: execute when price drops to or below stop
                shouldExecute = currentPrice.compareTo(limitPrice) <= 0;
            }
        }

        if (!shouldExecute) return;

        // Execute — update price/total to actual execution price
        BigDecimal total = currentPrice.multiply(BigDecimal.valueOf(order.getQuantity()));
        order.setPrice(currentPrice);
        order.setTotal(total);
        order.setStatus("EXECUTED");
        order.setTriggeredAt(LocalDateTime.now());

        UUID userId = UUID.fromString(order.getUserId());

        WalletBalance wallet = walletBalanceRepository.findByUserId(userId)
            .orElseGet(() -> walletBalanceRepository.save(new WalletBalance(userId)));

        if (order.getType() == Order.OrderType.BUY) {
            // Wallet was already debited at order placement — no action needed
            walletTxRepository.save(new WalletTransaction(
                userId, "withdrawal", total,
                "LIMIT BUY executed: " + order.getQuantity() + " x " + order.getSymbol() + " @ " + currentPrice
            ));
        } else {
            // Credit wallet on sell execution
            wallet.setBalance(wallet.getBalance().add(total));
            wallet.setUpdatedAt(LocalDateTime.now());
            walletBalanceRepository.save(wallet);

            walletTxRepository.save(new WalletTransaction(
                userId, "deposit", total,
                "LIMIT SELL executed: " + order.getQuantity() + " x " + order.getSymbol() + " @ " + currentPrice
            ));
        }

        orderRepository.save(order);
        log.info("[LimitOrderScheduler] Executed {} {} order {} for {} @ {}",
            order.getKind(), order.getType(), order.getId(), order.getSymbol(), currentPrice);
    }
}