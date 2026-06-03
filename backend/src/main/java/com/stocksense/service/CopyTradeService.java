package com.stocksense.service;

import com.stocksense.model.Notification;
import com.stocksense.model.Order;
import com.stocksense.model.Order.OrderKind;
import com.stocksense.model.Order.OrderType;
import com.stocksense.model.User;
import com.stocksense.model.WalletBalance;
import com.stocksense.model.WalletTransaction;
import com.stocksense.repository.OrderRepository;
import com.stocksense.repository.UserRepository;
import com.stocksense.repository.WalletBalanceRepository;
import com.stocksense.repository.WalletTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

/**
 * CopyTradeService
 *
 * Replicates a source user's current portfolio for the copying user,
 * scaled proportionally to the copier's available wallet balance.
 *
 * Flow:
 *  1. Load source user's holdings via PortfolioService.getSummary()
 *  2. Compute each holding's weight in the source portfolio (by value)
 *  3. Apply those weights to copier's wallet balance → target allocations
 *  4. For each holding, place a MARKET BUY order using the live price
 *     returned by PortfolioService (same price already fetched — no extra call)
 *  5. Deduct wallet, record WalletTransaction, save Order — same pattern as OrderController
 *
 * Constraints:
 *  - Copier must have enough balance for at least 1 share of each holding
 *  - Skips any holding whose allocation < minTradeAmount (default $1 / ₹1)
 *  - Does NOT sell copier's existing positions (additive copy, not mirror)
 */
@Service
public class CopyTradeService {

    private static final BigDecimal MIN_TRADE_AMOUNT = new BigDecimal("1.00");

    private final UserRepository              userRepository;
    private final PortfolioService            portfolioService;
    private final StockService                stockService;
    private final OrderRepository             orderRepository;
    private final WalletBalanceRepository     walletBalanceRepository;
    private final WalletTransactionRepository walletTxRepository;
    private final NotificationService         notificationService;

    public CopyTradeService(UserRepository userRepository,
                            PortfolioService portfolioService,
                            StockService stockService,
                            OrderRepository orderRepository,
                            WalletBalanceRepository walletBalanceRepository,
                            WalletTransactionRepository walletTxRepository,
                            NotificationService notificationService) {
        this.userRepository       = userRepository;
        this.portfolioService     = portfolioService;
        this.stockService         = stockService;
        this.orderRepository      = orderRepository;
        this.walletBalanceRepository = walletBalanceRepository;
        this.walletTxRepository   = walletTxRepository;
        this.notificationService  = notificationService;
    }

    // ── Result DTO ─────────────────────────────────────────────────────────────

    public static class CopyTradeResult {
        public final boolean success;
        public final String  message;
        public final List<OrderSummary> orders;
        public final BigDecimal totalSpent;
        public final int skipped;

        public CopyTradeResult(boolean success, String message,
                               List<OrderSummary> orders,
                               BigDecimal totalSpent, int skipped) {
            this.success    = success;
            this.message    = message;
            this.orders     = orders;
            this.totalSpent = totalSpent;
            this.skipped    = skipped;
        }
    }

    public static class OrderSummary {
        public final String     symbol;
        public final int        quantity;
        public final BigDecimal price;
        public final BigDecimal total;

        public OrderSummary(String symbol, int quantity,
                            BigDecimal price, BigDecimal total) {
            this.symbol   = symbol;
            this.quantity = quantity;
            this.price    = price;
            this.total    = total;
        }
    }

    // ── Main entry point ───────────────────────────────────────────────────────

    @Transactional
    public CopyTradeResult copyPortfolio(User copier, String sourceUsername) {

        // 1. Resolve source user
        Optional<User> sourceOpt = userRepository.findByUsername(sourceUsername);
        if (sourceOpt.isEmpty())
            return fail("Trader @" + sourceUsername + " not found");

        User source = sourceOpt.get();

        if (!source.isPublicProfile())
            return fail("@" + sourceUsername + "'s portfolio is private");

        if (source.getId().equals(copier.getId()))
            return fail("You cannot copy your own portfolio");

        // 2. Load source portfolio summary (holdings with live prices)
        Map<String, Object> summary;
        try {
            summary = portfolioService.getSummary(source.getId());
        } catch (Exception e) {
            return fail("Could not load @" + sourceUsername + "'s portfolio");
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> holdings =
            (List<Map<String, Object>>) summary.getOrDefault("holdings", List.of());

        if (holdings.isEmpty())
            return fail("@" + sourceUsername + " has no holdings to copy");

        // 3. Compute total source portfolio value
        // PortfolioService.buildHoldings() uses key "marketValue" (not "currentValue")
        BigDecimal sourceTotalValue = holdings.stream()
            .map(h -> toBigDecimal(h.get("marketValue")))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (sourceTotalValue.compareTo(BigDecimal.ZERO) <= 0)
            return fail("@" + sourceUsername + "'s portfolio has zero value");

        // 4. Copier's available wallet balance
        WalletBalance wallet = walletBalanceRepository
            .findByUserId(copier.getId())
            .orElseGet(() -> walletBalanceRepository.save(new WalletBalance(copier.getId())));

        BigDecimal availableBalance = wallet.getBalance();
        if (availableBalance.compareTo(MIN_TRADE_AMOUNT) <= 0)
            return fail("Insufficient wallet balance to copy trades");

        // 5. Place proportional MARKET BUY orders
        List<OrderSummary> placedOrders = new ArrayList<>();
        BigDecimal totalSpent = BigDecimal.ZERO;
        int skipped = 0;

        for (Map<String, Object> holding : holdings) {
            String symbol = String.valueOf(holding.get("symbol")).toUpperCase();
            String market = holding.containsKey("market")
                ? String.valueOf(holding.get("market")).toUpperCase()
                : (symbol.endsWith(".NS") ? "IN" : "US");

            // marketValue is the key from PortfolioService.buildHoldings()
            BigDecimal holdingValue = toBigDecimal(holding.get("marketValue"));
            if (holdingValue.compareTo(BigDecimal.ZERO) <= 0) { skipped++; continue; }

            // Weight of this holding in source portfolio
            BigDecimal weight = holdingValue.divide(sourceTotalValue, 10, RoundingMode.HALF_UP);

            // Copier's target allocation for this holding
            BigDecimal targetAllocation = availableBalance.multiply(weight)
                                                          .setScale(4, RoundingMode.HALF_UP);

            if (targetAllocation.compareTo(MIN_TRADE_AMOUNT) < 0) { skipped++; continue; }

            // Live price — already in summary from PortfolioService (key: "currentPrice")
            BigDecimal livePrice = toBigDecimal(holding.get("currentPrice"));
            if (livePrice.compareTo(BigDecimal.ZERO) <= 0) {
                // Fallback: StockService.getLivePrice() returns double (0 on failure)
                double raw = stockService.getLivePrice(symbol);
                if (raw <= 0) { skipped++; continue; }
                livePrice = BigDecimal.valueOf(raw);
            }

            // Quantity = floor(targetAllocation / livePrice) — at least 1
            int qty = targetAllocation.divide(livePrice, 0, RoundingMode.FLOOR).intValue();
            if (qty < 1) { skipped++; continue; }

            BigDecimal orderTotal = livePrice.multiply(BigDecimal.valueOf(qty))
                                             .setScale(4, RoundingMode.HALF_UP);

            // Check remaining wallet can cover this order
            if (wallet.getBalance().compareTo(orderTotal) < 0) { skipped++; continue; }

            // Deduct from wallet
            wallet.setBalance(wallet.getBalance().subtract(orderTotal));
            wallet.setUpdatedAt(LocalDateTime.now());

            // Record wallet transaction
            walletTxRepository.save(new WalletTransaction(
                copier.getId(), "withdrawal", orderTotal,
                "COPY @" + sourceUsername + " — BUY " + qty + " x " + symbol + " @ " + livePrice
            ));

            // Save order (MARKET BUY, EXECUTED immediately)
            Order order = new Order();
            order.setUserId(copier.getId().toString());
            order.setSymbol(symbol);
            order.setMarket(market);
            order.setType(OrderType.BUY);
            order.setKind(OrderKind.MARKET);
            order.setQuantity(qty);
            order.setPrice(livePrice);
            order.setTotal(orderTotal);
            order.setStatus("EXECUTED");
            orderRepository.save(order);

            placedOrders.add(new OrderSummary(symbol, qty, livePrice, orderTotal));
            totalSpent = totalSpent.add(orderTotal);
        }

        // Persist updated wallet
        walletBalanceRepository.save(wallet);

        if (placedOrders.isEmpty())
            return fail("No orders could be placed — check your wallet balance or the source portfolio");

        // Notification for copier
        notificationService.createNotification(
            copier.getId(),
            Notification.Type.ORDER_FILLED,
            "Portfolio Copied",
            "You copied @" + sourceUsername + "'s portfolio — " +
            placedOrders.size() + " order(s) placed" +
            (skipped > 0 ? ", " + skipped + " skipped." : "."),
            null
        );

        return new CopyTradeResult(
            true,
            "Successfully copied @" + sourceUsername + "'s portfolio",
            placedOrders,
            totalSpent,
            skipped
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CopyTradeResult fail(String message) {
        return new CopyTradeResult(false, message, List.of(), BigDecimal.ZERO, 0);
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        try { return new BigDecimal(value.toString()); }
        catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }
}