package com.stocksense.service;

import com.stocksense.model.Order;
import com.stocksense.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * TaxLotService
 *
 * Provides FIFO tax lot tracking per symbol.
 *
 * Tax Lots endpoint — per symbol:
 *   { symbol, lots: [{ lotId, date, qty, costBasis, currentPrice, unrealizedGain, unrealizedGainPct }] }
 *
 * Tax Report endpoint — realized gains summary:
 *   { year, symbols: [{ symbol, totalProceeds, totalCostBasis, realizedGain, trades: [...] }], totalRealizedGain }
 */
@Service
public class TaxLotService {

    private static final Logger log = LoggerFactory.getLogger(TaxLotService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("d MMM yyyy");

    private final OrderRepository     orderRepository;
    private final AlphaVantageService alphaVantageService;

    public TaxLotService(OrderRepository orderRepository,
                          AlphaVantageService alphaVantageService) {
        this.orderRepository     = orderRepository;
        this.alphaVantageService = alphaVantageService;
    }

    // ── Tax Lots — open positions broken into individual buy lots ─────────────

    /**
     * Returns remaining (unsold) FIFO buy lots for every symbol.
     * Each lot shows: date purchased, qty remaining, cost basis per share,
     * current price, unrealized gain $ and %.
     */
    public List<Map<String, Object>> getTaxLots(UUID userId) {
        List<Order> orders = filledOrders(userId.toString());
        Map<String, List<Order>> bySymbol = orders.stream()
                .collect(Collectors.groupingBy(Order::getSymbol));

        List<Map<String, Object>> result = new ArrayList<>();

        for (Map.Entry<String, List<Order>> entry : bySymbol.entrySet()) {
            String      symbol      = entry.getKey();
            List<Order> sorted      = entry.getValue().stream()
                    .sorted(Comparator.comparing(Order::getCreatedAt))
                    .collect(Collectors.toList());

            // FIFO queue of open lots: [qty, costPerShare, purchaseDate]
            Deque<double[]> openLots = new ArrayDeque<>();

            for (Order o : sorted) {
                double qty   = o.getQuantity();
                double price = o.getPrice() != null ? o.getPrice().doubleValue() : 0;
                long   epoch = o.getCreatedAt().toEpochSecond(java.time.ZoneOffset.UTC);

                if (o.getType() == Order.OrderType.BUY) {
                    openLots.addLast(new double[]{ qty, price, epoch });
                } else if (o.getType() == Order.OrderType.SELL) {
                    double remaining = qty;
                    while (remaining > 1e-9 && !openLots.isEmpty()) {
                        double[] lot = openLots.peekFirst();
                        if (lot[0] <= remaining) {
                            remaining -= lot[0];
                            openLots.pollFirst();
                        } else {
                            lot[0] -= remaining;
                            remaining = 0;
                        }
                    }
                }
            }

            if (openLots.isEmpty()) continue;

            // Fetch live price once per symbol
            double livePrice = fetchLivePrice(symbol, openLots.peekFirst()[1]);

            List<Map<String, Object>> lots = new ArrayList<>();
            int lotIndex = 1;
            for (double[] lot : openLots) {
                double lotQty      = lot[0];
                double costPerShare = lot[1];
                String purchaseDate = java.time.Instant.ofEpochSecond((long) lot[2])
                        .atZone(java.time.ZoneOffset.UTC)
                        .toLocalDate()
                        .format(DATE_FMT);

                double costBasis       = round(lotQty * costPerShare);
                double currentValue    = round(lotQty * livePrice);
                double unrealizedGain  = round(currentValue - costBasis);
                double unrealizedGainPct = costBasis > 0 ? round((unrealizedGain / costBasis) * 100) : 0;

                Map<String, Object> lotMap = new LinkedHashMap<>();
                lotMap.put("lotId",             symbol + "-" + lotIndex);
                lotMap.put("purchaseDate",       purchaseDate);
                lotMap.put("qty",               round(lotQty));
                lotMap.put("costPerShare",       round(costPerShare));
                lotMap.put("costBasis",          costBasis);
                lotMap.put("currentPrice",       round(livePrice));
                lotMap.put("currentValue",       currentValue);
                lotMap.put("unrealizedGain",     unrealizedGain);
                lotMap.put("unrealizedGainPct",  unrealizedGainPct);
                lots.add(lotMap);
                lotIndex++;
            }

            // Symbol-level totals
            double totalCost    = lots.stream().mapToDouble(l -> (Double) l.get("costBasis")).sum();
            double totalValue   = lots.stream().mapToDouble(l -> (Double) l.get("currentValue")).sum();
            double totalGain    = round(totalValue - totalCost);
            double totalGainPct = totalCost > 0 ? round((totalGain / totalCost) * 100) : 0;

            Map<String, Object> sym = new LinkedHashMap<>();
            sym.put("symbol",        symbol);
            sym.put("currentPrice",  round(livePrice));
            sym.put("totalCost",     round(totalCost));
            sym.put("totalValue",    round(totalValue));
            sym.put("totalGain",     totalGain);
            sym.put("totalGainPct",  totalGainPct);
            sym.put("lots",          lots);
            result.add(sym);
        }

        return result;
    }

    // ── Tax Report — realized gains by symbol ─────────────────────────────────

    /**
     * Returns realized gain/loss per symbol using FIFO matching.
     * Groups sell trades with matched buy lots and computes proceeds vs cost basis.
     */
    public Map<String, Object> getTaxReport(UUID userId, int year) {
        List<Order> orders = filledOrders(userId.toString());
        Map<String, List<Order>> bySymbol = orders.stream()
                .collect(Collectors.groupingBy(Order::getSymbol));

        List<Map<String, Object>> symbolReports = new ArrayList<>();
        double totalRealizedGain = 0;

        for (Map.Entry<String, List<Order>> entry : bySymbol.entrySet()) {
            String      symbol = entry.getKey();
            List<Order> sorted = entry.getValue().stream()
                    .sorted(Comparator.comparing(Order::getCreatedAt))
                    .collect(Collectors.toList());

            Deque<double[]> buyLots = new ArrayDeque<>(); // [qty, price, epochSec]
            List<Map<String, Object>> trades = new ArrayList<>();
            double symbolRealized = 0;
            double totalProceeds  = 0;
            double totalCostBasis = 0;

            for (Order o : sorted) {
                double qty   = o.getQuantity();
                double price = o.getPrice() != null ? o.getPrice().doubleValue() : 0;
                long   epoch = o.getCreatedAt().toEpochSecond(java.time.ZoneOffset.UTC);

                if (o.getType() == Order.OrderType.BUY) {
                    buyLots.addLast(new double[]{ qty, price, epoch });
                } else if (o.getType() == Order.OrderType.SELL) {
                    // Only count sells in the requested year
                    int sellYear = o.getCreatedAt().getYear();
                    double remaining  = qty;
                    double sellProceeds  = round(qty * price);
                    double matchedCost   = 0;

                    while (remaining > 1e-9 && !buyLots.isEmpty()) {
                        double[] lot     = buyLots.peekFirst();
                        double   matched = Math.min(remaining, lot[0]);
                        matchedCost += matched * lot[1];
                        lot[0]      -= matched;
                        remaining   -= matched;
                        if (lot[0] <= 1e-9) buyLots.pollFirst();
                    }

                    double gain = round(sellProceeds - matchedCost);

                    if (sellYear == year) {
                        symbolRealized += gain;
                        totalProceeds  += sellProceeds;
                        totalCostBasis += matchedCost;

                        Map<String, Object> trade = new LinkedHashMap<>();
                        trade.put("date",        o.getCreatedAt().toLocalDate().format(DATE_FMT));
                        trade.put("qty",         round(qty));
                        trade.put("salePrice",   round(price));
                        trade.put("proceeds",    round(sellProceeds));
                        trade.put("costBasis",   round(matchedCost));
                        trade.put("gain",        gain);
                        trade.put("gainPct",     matchedCost > 0 ? round((gain / matchedCost) * 100) : 0);
                        trade.put("type",        gain >= 0 ? "GAIN" : "LOSS");
                        trades.add(trade);
                    }
                }
            }

            if (trades.isEmpty()) continue;

            totalRealizedGain += symbolRealized;

            Map<String, Object> symReport = new LinkedHashMap<>();
            symReport.put("symbol",        symbol);
            symReport.put("totalProceeds", round(totalProceeds));
            symReport.put("totalCostBasis",round(totalCostBasis));
            symReport.put("realizedGain",  round(symbolRealized));
            symReport.put("trades",        trades);
            symbolReports.add(symReport);
        }

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("year",              year);
        report.put("totalRealizedGain", round(totalRealizedGain));
        report.put("symbols",           symbolReports);
        report.put("hasActivity",       !symbolReports.isEmpty());
        return report;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<Order> filledOrders(String userId) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(o -> "FILLED".equalsIgnoreCase(o.getStatus())
                          || "EXECUTED".equalsIgnoreCase(o.getStatus()))
                .collect(Collectors.toList());
    }

    private double fetchLivePrice(String symbol, double fallback) {
        try {
            Map<String, Object> quote = alphaVantageService.getQuote(symbol);
            if (quote != null && quote.get("price") instanceof Number n)
                return n.doubleValue();
        } catch (Exception ignored) {}
        return fallback;
    }

    private double round(double v) { return Math.round(v * 100.0) / 100.0; }
}