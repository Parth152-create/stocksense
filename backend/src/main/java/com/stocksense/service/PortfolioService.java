package com.stocksense.service;

import com.stocksense.repository.OrderRepository;
import com.stocksense.model.Order;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class PortfolioService {

    private final OrderRepository orderRepository;
    private final AlphaVantageService alphaVantageService;

    public PortfolioService(OrderRepository orderRepository,
                            AlphaVantageService alphaVantageService) {
        this.orderRepository = orderRepository;
        this.alphaVantageService = alphaVantageService;
    }

    /**
     * Aggregate orders by symbol to compute qty, avgPrice, currentPrice, pnl.
     * Only BUY orders increase position; SELL orders decrease it.
     */
    public List<Map<String, Object>> getHoldings(UUID userId) {
        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId.toString());

        // Group by symbol
        Map<String, List<Order>> bySymbol = orders.stream()
                .collect(Collectors.groupingBy(Order::getSymbol));

        List<Map<String, Object>> holdings = new ArrayList<>();

        for (Map.Entry<String, List<Order>> entry : bySymbol.entrySet()) {
            String symbol = entry.getKey();
            List<Order> symbolOrders = entry.getValue();

            // Weighted average price for BUY orders
            double totalCost = 0;
            double totalQty = 0;

            for (Order o : symbolOrders) {
                double qty = o.getQuantity();
                double price = o.getPrice() != null ? o.getPrice().doubleValue() : 0;
                if (o.getType() == Order.OrderType.BUY) {
                    totalCost += qty * price;
                    totalQty += qty;
                } else if (o.getType() == Order.OrderType.SELL) {
                    // Reduce position proportionally
                    if (totalQty > 0) {
                        double avgSoFar = totalCost / totalQty;
                        totalCost -= qty * avgSoFar;
                    }
                    totalQty -= qty;
                }
            }

            if (totalQty <= 0) continue; // fully sold out

            double avgPrice = totalQty > 0 ? totalCost / totalQty : 0;

            // Fetch live price
            double currentPrice = avgPrice; // fallback
            try {
                Map<String, Object> quote = alphaVantageService.getQuote(symbol);
                if (quote != null && quote.get("price") instanceof Number) {
                    currentPrice = ((Number) quote.get("price")).doubleValue();
                }
            } catch (Exception ignored) {}

            double marketValue = currentPrice * totalQty;
            double cost = avgPrice * totalQty;
            double pnl = marketValue - cost;
            double pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

            // Derive a display name (symbol itself if no lookup available)
            String name = resolveCompanyName(symbol);

            Map<String, Object> holding = new LinkedHashMap<>();
            holding.put("symbol", symbol);
            holding.put("name", name);
            holding.put("qty", totalQty);
            holding.put("avgPrice", round(avgPrice));
            holding.put("currentPrice", round(currentPrice));
            holding.put("marketValue", round(marketValue));
            holding.put("pnl", round(pnl));
            holding.put("pnlPct", round(pnlPct));
            holdings.add(holding);
        }

        return holdings;
    }

    public Map<String, Object> getSummary(UUID userId) {
        List<Map<String, Object>> holdings = getHoldings(userId);

        double totalValue = holdings.stream()
                .mapToDouble(h -> ((Number) h.get("marketValue")).doubleValue()).sum();
        double totalCost = holdings.stream()
                .mapToDouble(h -> {
                    double qty = ((Number) h.get("qty")).doubleValue();
                    double avg = ((Number) h.get("avgPrice")).doubleValue();
                    return qty * avg;
                }).sum();
        double totalPnl = totalValue - totalCost;
        double totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalValue", round(totalValue));
        summary.put("totalCost", round(totalCost));
        summary.put("totalPnl", round(totalPnl));
        summary.put("totalPnlPct", round(totalPnlPct));
        return summary;
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private String resolveCompanyName(String symbol) {
        // Simple static map; extend as needed or call an external API
        Map<String, String> names = Map.of(
                "AAPL", "Apple Inc", "MSFT", "Microsoft Corp",
                "NVDA", "NVIDIA Corp", "TSLA", "Tesla Inc",
                "RELIANCE", "Reliance Industries", "TCS", "TCS Ltd",
                "INFY", "Infosys Ltd", "HDFCBANK", "HDFC Bank",
                "WIPRO", "Wipro Ltd", "AMD", "AMD Inc"
        );
        return names.getOrDefault(symbol, symbol);
    }
}
