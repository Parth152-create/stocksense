package com.stocksense.service;

import com.stocksense.model.Holding;
import com.stocksense.repository.HoldingRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class HoldingService {

    private final HoldingRepository holdingRepository;

    public HoldingService(HoldingRepository holdingRepository) {
        this.holdingRepository = holdingRepository;
    }

    // ➕ ADD STOCK
    public Holding addHolding(Holding holding) {
        return holdingRepository.save(holding);
    }

    // 📄 GET HOLDINGS
    public List<Holding> getHoldings(UUID portfolioId) {
        return holdingRepository.findByPortfolioId(portfolioId);
    }

    // ❌ DELETE STOCK
    public void deleteHolding(UUID id) {
        holdingRepository.deleteById(id);
    }

    // 💰 TOTAL INVESTMENT
    public double getTotalInvestment(UUID portfolioId) {
        List<Holding> holdings = holdingRepository.findByPortfolioId(portfolioId);

        double total = 0;

        for (Holding h : holdings) {
            total += h.getQuantity() * h.getBuyPrice();
        }

        return total;
    }

    // 📈 MOCK CURRENT PRICE (TEMP)
    private double getCurrentPrice(String symbol) {
        return switch (symbol) {
            case "AAPL" -> 180;
            case "TSLA" -> 250;
            case "GOOGL" -> 140;
            default -> 100;
        };
    }

    // 📊 CURRENT VALUE
    public double getCurrentValue(UUID portfolioId) {
        List<Holding> holdings = holdingRepository.findByPortfolioId(portfolioId);

        double total = 0;

        for (Holding h : holdings) {
            double currentPrice = getCurrentPrice(h.getSymbol());
            total += h.getQuantity() * currentPrice;
        }

        return total;
    }

    // 💸 PROFIT
    public double getProfit(UUID portfolioId) {
        double investment = getTotalInvestment(portfolioId);
        double currentValue = getCurrentValue(portfolioId);

        return currentValue - investment;
    }
}