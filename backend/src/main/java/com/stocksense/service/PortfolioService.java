package com.stocksense.service;

import com.stocksense.repository.OrderRepository;
import com.stocksense.model.Order;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PortfolioService {

    private final OrderRepository     orderRepository;
    private final AlphaVantageService alphaVantageService;
    private final StockService  stockService;

    public PortfolioService(OrderRepository orderRepository,
                            AlphaVantageService alphaVantageService,
                            StockService stockService) {
        this.orderRepository     = orderRepository;
        this.alphaVantageService = alphaVantageService;
        this.stockService        = stockService;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /** All holdings for a user (no market filter). */
    public List<Map<String, Object>> getHoldings(UUID userId) {
        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId.toString());
        return buildHoldings(orders);
    }

    /** Holdings filtered by asset class (US / IN / CRYPTO / FX). */
    public List<Map<String, Object>> getHoldingsByMarket(UUID userId, String market) {
        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId.toString())
                .stream()
                .filter(o -> market.equalsIgnoreCase(o.getMarket()))
                .collect(Collectors.toList());
        return buildHoldings(orders);
    }

    /** Portfolio summary — all markets. */
    public Map<String, Object> getSummary(UUID userId) {
        List<Map<String, Object>> holdings = getHoldings(userId);
        List<Order> allOrders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId.toString());
        double realizedPnl = computeRealizedPnl(allOrders);
        return buildSummary(holdings, null, realizedPnl);
    }

    /** Portfolio summary — filtered by market. */
    public Map<String, Object> getSummaryByMarket(UUID userId, String market) {
        List<Map<String, Object>> holdings = getHoldingsByMarket(userId, market);
        List<Order> marketOrders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId.toString())
                .stream()
                .filter(o -> market.equalsIgnoreCase(o.getMarket()))
                .collect(Collectors.toList());
        double realizedPnl = computeRealizedPnl(marketOrders);
        return buildSummary(holdings, market, realizedPnl);
    }

    /**
     * Portfolio value history grouped by date.
     * range: "1M" = daily for last 30 days
     *        "1Y" = weekly for last 52 weeks
     *        "All" = monthly from first order
     */
    public List<Map<String, Object>> getHistory(UUID userId, String range) {
        List<Order> allOrders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId.toString())
                .stream()
                .filter(o -> "FILLED".equalsIgnoreCase(o.getStatus())
                          || "EXECUTED".equalsIgnoreCase(o.getStatus()))
                .sorted(Comparator.comparing(Order::getCreatedAt))
                .collect(Collectors.toList());

        if (allOrders.isEmpty()) return Collections.emptyList();

        Map<String, double[]> positions = new LinkedHashMap<>();
        List<Map<String, Object>> result  = new ArrayList<>();

        java.time.LocalDate today = java.time.LocalDate.now();
        List<java.time.LocalDate> boundaries = buildBoundaries(range, today,
                allOrders.get(0).getCreatedAt().toLocalDate());

        int orderIdx = 0;
        for (java.time.LocalDate boundary : boundaries) {
            while (orderIdx < allOrders.size()) {
                Order o = allOrders.get(orderIdx);
                if (!o.getCreatedAt().toLocalDate().isAfter(boundary)) {
                    applyOrder(o, positions);
                    orderIdx++;
                } else {
                    break;
                }
            }

            double snap = snapshotValue(positions);

            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date",  formatBoundary(boundary, range));
            point.put("value", round(snap));
            result.add(point);
        }

        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Realized P&L — FIFO across all SELL orders
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Walk all FILLED/EXECUTED orders chronologically per symbol.
     * For each SELL, match it against the oldest BUY lots (FIFO)
     * and accumulate (sellPrice - avgCostOfMatchedLots) * qty.
     *
     * Returns total realized gain/loss across all closed positions.
     */
    public double computeRealizedPnl(List<Order> orders) {
        // Group filled orders by symbol, oldest first
        Map<String, List<Order>> bySymbol = orders.stream()
                .filter(o -> "FILLED".equalsIgnoreCase(o.getStatus())
                          || "EXECUTED".equalsIgnoreCase(o.getStatus()))
                .sorted(Comparator.comparing(Order::getCreatedAt))
                .collect(Collectors.groupingBy(Order::getSymbol));

        double totalRealized = 0;

        for (List<Order> symbolOrders : bySymbol.values()) {
            // FIFO queue of buy lots: each entry is [qty, price]
            Deque<double[]> buyLots = new ArrayDeque<>();

            for (Order o : symbolOrders) {
                double qty   = o.getQuantity();
                double price = o.getPrice() != null ? o.getPrice().doubleValue() : 0;

                if (o.getType() == Order.OrderType.BUY) {
                    buyLots.addLast(new double[]{qty, price});
                } else if (o.getType() == Order.OrderType.SELL) {
                    double remaining = qty;
                    while (remaining > 0 && !buyLots.isEmpty()) {
                        double[] lot = buyLots.peekFirst();
                        double matched = Math.min(remaining, lot[0]);
                        totalRealized += matched * (price - lot[1]);
                        lot[0] -= matched;
                        remaining -= matched;
                        if (lot[0] <= 0) buyLots.pollFirst();
                    }
                }
            }
        }

        return round(totalRealized);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core building blocks
    // ─────────────────────────────────────────────────────────────────────────

    private List<Map<String, Object>> buildHoldings(List<Order> orders) {
        Map<String, List<Order>> bySymbol = orders.stream()
                .collect(Collectors.groupingBy(Order::getSymbol));

        List<Map<String, Object>> holdings = new ArrayList<>();

        for (Map.Entry<String, List<Order>> entry : bySymbol.entrySet()) {
            String       symbol       = entry.getKey();
            List<Order>  symbolOrders = entry.getValue();

            double totalCost = 0;
            double totalQty  = 0;

            List<Order> sorted = symbolOrders.stream()
                    .sorted(Comparator.comparing(Order::getCreatedAt))
                    .collect(Collectors.toList());

            for (Order o : sorted) {
                double qty   = o.getQuantity();
                double price = o.getPrice() != null ? o.getPrice().doubleValue() : 0;
                if (o.getType() == Order.OrderType.BUY) {
                    totalCost += qty * price;
                    totalQty  += qty;
                } else if (o.getType() == Order.OrderType.SELL) {
                    if (totalQty > 0) {
                        double avgSoFar = totalCost / totalQty;
                        totalCost -= qty * avgSoFar;
                    }
                    totalQty -= qty;
                }
            }

            if (totalQty <= 0) continue;

            double avgPrice     = totalCost / totalQty;
            double currentPrice = fetchLivePrice(symbol, avgPrice);
            double marketValue  = currentPrice * totalQty;
            double cost         = avgPrice * totalQty;
            double pnl          = marketValue - cost;
            double pnlPct       = cost > 0 ? (pnl / cost) * 100 : 0;

            String market = deriveMarket(symbol, symbolOrders);

            Map<String, Object> holding = new LinkedHashMap<>();
            holding.put("symbol",       symbol);
            holding.put("name",         resolveCompanyName(symbol));
            holding.put("market",       market);
            holding.put("qty",          totalQty);
            holding.put("quantity",     totalQty);
            holding.put("avgPrice",     round(avgPrice));
            holding.put("currentPrice", round(currentPrice));
            holding.put("marketValue",  round(marketValue));
            holding.put("pnl",          round(pnl));
            holding.put("pnlPct",       round(pnlPct));
            holdings.add(holding);
        }

        return holdings;
    }

    private Map<String, Object> buildSummary(List<Map<String, Object>> holdings,
                                              String market,
                                              double realizedPnl) {
        double totalValue = holdings.stream()
                .mapToDouble(h -> ((Number) h.get("marketValue")).doubleValue()).sum();
        double totalCost  = holdings.stream()
                .mapToDouble(h -> {
                    double qty = ((Number) h.get("qty")).doubleValue();
                    double avg = ((Number) h.get("avgPrice")).doubleValue();
                    return qty * avg;
                }).sum();

        // unrealizedPnl = open position mark-to-market gain/loss
        double unrealizedPnl = totalValue - totalCost;
        double totalPnl      = unrealizedPnl + realizedPnl;
        double totalPnlPct   = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

        Map<String, Object> best  = holdings.stream()
                .max(Comparator.comparingDouble(h -> ((Number) h.get("pnlPct")).doubleValue()))
                .orElse(null);
        Map<String, Object> worst = holdings.stream()
                .min(Comparator.comparingDouble(h -> ((Number) h.get("pnlPct")).doubleValue()))
                .orElse(null);
        Map<String, Object> mostHeld = holdings.stream()
                .max(Comparator.comparingDouble(h -> ((Number) h.get("qty")).doubleValue()))
                .orElse(null);

        List<Map<String, Object>> allocation = buildAllocation(holdings, totalValue);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("holdings",       holdings);
        summary.put("totalValue",     round(totalValue));
        summary.put("totalInvested",  round(totalCost));
        summary.put("totalPnl",       round(totalPnl));
        summary.put("totalPnlPct",    round(totalPnlPct));
        summary.put("unrealizedPnl",  round(unrealizedPnl));   // ← NEW
        summary.put("realizedPnl",    round(realizedPnl));      // ← NEW
        summary.put("changePercent",  round(totalPnlPct));
        summary.put("allocation",     allocation);
        if (market != null) summary.put("market", market);

        if (best != null) {
            Map<String, Object> bp = new LinkedHashMap<>();
            bp.put("symbol",    best.get("symbol"));
            bp.put("changePct", best.get("pnlPct"));
            summary.put("bestPerformer", bp);
        }
        if (worst != null) {
            Map<String, Object> wp = new LinkedHashMap<>();
            wp.put("symbol",    worst.get("symbol"));
            wp.put("changePct", worst.get("pnlPct"));
            summary.put("worstPerformer", wp);
        }
        if (mostHeld != null) {
            Map<String, Object> mh = new LinkedHashMap<>();
            mh.put("symbol",   mostHeld.get("symbol"));
            mh.put("quantity", mostHeld.get("qty"));
            summary.put("mostHeld", mh);
        }

        return summary;
    }

    private List<Map<String, Object>> buildAllocation(List<Map<String, Object>> holdings, double totalValue) {
        Map<String, Double> buckets = new LinkedHashMap<>();
        for (Map<String, Object> h : holdings) {
            String market = (String) h.getOrDefault("market", "OTHER");
            String label  = marketToSectorLabel(market);
            double mv     = ((Number) h.get("marketValue")).doubleValue();
            buckets.merge(label, mv, Double::sum);
        }
        List<Map<String, Object>> alloc = new ArrayList<>();
        for (Map.Entry<String, Double> e : buckets.entrySet()) {
            double pct = totalValue > 0 ? (e.getValue() / totalValue) * 100 : 0;
            Map<String, Object> seg = new LinkedHashMap<>();
            seg.put("label", e.getKey());
            seg.put("pct",   round(pct));
            alloc.add(seg);
        }
        return alloc;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // History helpers
    // ─────────────────────────────────────────────────────────────────────────

    private List<java.time.LocalDate> buildBoundaries(String range,
                                                       java.time.LocalDate today,
                                                       java.time.LocalDate firstOrder) {
        List<java.time.LocalDate> dates = new ArrayList<>();
        switch (range) {
            case "1M" -> {
                for (int i = 29; i >= 0; i--)
                    dates.add(today.minusDays(i));
            }
            case "1Y" -> {
                for (int i = 51; i >= 0; i--)
                    dates.add(today.minusWeeks(i));
            }
            default -> {
                java.time.LocalDate cursor = firstOrder.withDayOfMonth(1);
                while (!cursor.isAfter(today)) {
                    dates.add(cursor.withDayOfMonth(cursor.lengthOfMonth()));
                    cursor = cursor.plusMonths(1);
                }
            }
        }
        return dates;
    }

    private void applyOrder(Order o, Map<String, double[]> positions) {
        String  sym   = o.getSymbol();
        double  qty   = o.getQuantity();
        double  price = o.getPrice() != null ? o.getPrice().doubleValue() : 0;
        double[] pos  = positions.getOrDefault(sym, new double[]{0, 0});

        if (o.getType() == Order.OrderType.BUY) {
            pos[0] += qty;
            pos[1] += qty * price;
        } else {
            if (pos[0] > 0) {
                double avg = pos[1] / pos[0];
                pos[1] -= qty * avg;
            }
            pos[0] -= qty;
            if (pos[0] <= 0) { pos[0] = 0; pos[1] = 0; }
        }
        positions.put(sym, pos);
    }

    private double snapshotValue(Map<String, double[]> positions) {
        double total = 0;
        for (double[] pos : positions.values()) {
            if (pos[0] > 0 && pos[1] > 0) {
                double avg = pos[1] / pos[0];
                total += pos[0] * avg;
            }
        }
        return total;
    }

    private String formatBoundary(java.time.LocalDate d, String range) {
        return switch (range) {
            case "1M"  -> d.format(DateTimeFormatter.ofPattern("d MMM"));
            case "1Y"  -> d.format(DateTimeFormatter.ofPattern("MMM yy"));
            default    -> d.format(DateTimeFormatter.ofPattern("MMM yyyy"));
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Utility helpers
    // ─────────────────────────────────────────────────────────────────────────

    private double fetchLivePrice(String symbol, double fallback) {
        try {
            // StockService.getQuote() is @Cacheable — hits Redis first
            double live = stockService.getLivePrice(symbol);
            if (live > 0) return live;
            // Fallback to AlphaVantage if StockService returns 0
            Map<String, Object> quote = alphaVantageService.getQuote(symbol);
            if (quote != null && quote.get("price") instanceof Number n)
                return n.doubleValue();
        } catch (Exception ignored) {}
        return fallback;
    }

    private String deriveMarket(String symbol, List<Order> orders) {
        if (symbol.contains("/"))           return "FX";
        if (symbol.endsWith(".BSE")
         || symbol.endsWith(".NSE"))        return "IN";
        for (Order o : orders) {
            if (o.getMarket() != null && !o.getMarket().isBlank())
                return o.getMarket().toUpperCase();
        }
        Set<String> knownCrypto = Set.of("BTC","ETH","SOL","BNB","AVAX","DOGE","ADA","XRP","MATIC","DOT");
        String base = symbol.replaceAll("\\.(BSE|NSE|NYSE|NASDAQ|US)$", "").toUpperCase();
        if (knownCrypto.contains(base))     return "CRYPTO";
        return "US";
    }

    private String marketToSectorLabel(String market) {
        return switch (market.toUpperCase()) {
            case "CRYPTO" -> "Crypto";
            case "IN"     -> "India";
            case "FX"     -> "Forex";
            default       -> "Stocks";
        };
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private String resolveCompanyName(String symbol) {
        String base = symbol.replaceAll("\\.(BSE|NSE|NYSE|NASDAQ|US)$", "").toUpperCase();
        Map<String, String> names = new HashMap<>();
        names.put("AAPL",        "Apple Inc");
        names.put("MSFT",        "Microsoft Corp");
        names.put("NVDA",        "NVIDIA Corp");
        names.put("TSLA",        "Tesla Inc");
        names.put("GOOGL",       "Alphabet Inc");
        names.put("AMZN",        "Amazon.com Inc");
        names.put("META",        "Meta Platforms");
        names.put("AMD",         "AMD Inc");
        names.put("ADBE",        "Adobe Inc");
        names.put("KO",          "Coca-Cola Co");
        names.put("MCD",         "McDonald's Corp");
        names.put("RELIANCE",    "Reliance Industries");
        names.put("TCS",         "TCS Ltd");
        names.put("INFY",        "Infosys Ltd");
        names.put("HDFCBANK",    "HDFC Bank");
        names.put("WIPRO",       "Wipro Ltd");
        names.put("ICICIBANK",   "ICICI Bank");
        names.put("SBIN",        "State Bank of India");
        names.put("BAJFINANCE",  "Bajaj Finance");
        names.put("HINDUNILVR",  "Hindustan Unilever");
        names.put("ADANIENT",    "Adani Enterprises");
        names.put("TATAMOTORS",  "Tata Motors");
        names.put("TATASTEEL",   "Tata Steel");
        names.put("BTC",         "Bitcoin");
        names.put("ETH",         "Ethereum");
        names.put("SOL",         "Solana");
        names.put("BNB",         "BNB");
        names.put("AVAX",        "Avalanche");
        names.put("DOGE",        "Dogecoin");
        names.put("ADA",         "Cardano");
        names.put("XRP",         "XRP");
        return names.getOrDefault(base, base);
    }
}
