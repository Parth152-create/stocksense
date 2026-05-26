package com.stocksense.service;

import com.stocksense.model.Holding;
import com.stocksense.repository.HoldingRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class HoldingService {

    private final HoldingRepository holdingRepository;
    private final StockService      stockService;

    public HoldingService(HoldingRepository holdingRepository, StockService stockService) {
        this.holdingRepository = holdingRepository;
        this.stockService      = stockService;
    }

    // ➕ ADD HOLDING
    public Holding addHolding(Holding holding) {
        // Default market to "US" if not set
        if (holding.getMarket() == null || holding.getMarket().isBlank()) {
            holding.setMarket(inferMarket(holding.getSymbol()));
        }
        return holdingRepository.save(holding);
    }

    // 📄 GET HOLDINGS
    public List<Holding> getHoldings(UUID portfolioId) {
        return holdingRepository.findByPortfolioId(portfolioId);
    }

    // 📄 GET HOLDINGS BY MARKET
    public List<Holding> getHoldingsByMarket(UUID portfolioId, String market) {
        return holdingRepository.findByPortfolioId(portfolioId)
                .stream()
                .filter(h -> market.equalsIgnoreCase(h.getMarket()))
                .toList();
    }

    // ❌ DELETE HOLDING
    public void deleteHolding(UUID id) {
        holdingRepository.deleteById(id);
    }

    // 💰 TOTAL INVESTMENT (quantity × buyPrice)
    public double getTotalInvestment(UUID portfolioId) {
        return holdingRepository.findByPortfolioId(portfolioId)
                .stream()
                .mapToDouble(h -> h.getQuantity() * h.getBuyPrice())
                .sum();
    }

    // 📈 CURRENT VALUE (quantity × live price, falls back to buyPrice)
    public double getCurrentValue(UUID portfolioId) {
        return holdingRepository.findByPortfolioId(portfolioId)
                .stream()
                .mapToDouble(h -> {
                    double livePrice = stockService.getLivePrice(
                        StockService.resolveSymbol(h.getSymbol(), h.getMarket())
                    );
                    double price = livePrice > 0 ? livePrice : h.getBuyPrice();
                    return h.getQuantity() * price;
                })
                .sum();
    }

    // 💸 PROFIT / LOSS
    public double getProfit(UUID portfolioId) {
        return getCurrentValue(portfolioId) - getTotalInvestment(portfolioId);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static final java.util.Set<String> CRYPTO_SYMBOLS = java.util.Set.of(
        "BTC","ETH","SOL","BNB","AVAX","ADA","DOT","DOGE","XRP","MATIC"
    );
    private static final java.util.Set<String> IN_SYMBOLS = java.util.Set.of(
        "RELIANCE","TCS","INFY","HDFCBANK","WIPRO","ICICIBANK","SBIN",
        "AXISBANK","KOTAKBANK","BAJFINANCE","TATAMOTORS","ADANIENT",
        "MARUTI","SUNPHARMA","NTPC","ONGC","LT","ULTRACEMCO"
    );

    /** Infer market from symbol when not explicitly provided. */
    private String inferMarket(String symbol) {
        if (symbol == null) return "US";
        String s = symbol.toUpperCase()
            .replace(".BSE","").replace(".NS","").replace(".BO","");
        if (s.contains("/"))          return "FX";
        if (CRYPTO_SYMBOLS.contains(s)) return "CRYPTO";
        if (IN_SYMBOLS.contains(s))     return "IN";
        return "US";
    }
}