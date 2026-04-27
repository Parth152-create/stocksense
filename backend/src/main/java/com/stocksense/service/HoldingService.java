package com.stocksense.service;

import com.stocksense.model.Holding;
import com.stocksense.repository.HoldingRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class HoldingService {

    private final HoldingRepository holdingRepository;
    private final StockService stockService;

    public HoldingService(HoldingRepository holdingRepository, StockService stockService) {
        this.holdingRepository = holdingRepository;
        this.stockService = stockService;
    }

    // ➕ ADD HOLDING
    public Holding addHolding(Holding holding) {
        return holdingRepository.save(holding);
    }

    // 📄 GET HOLDINGS
    public List<Holding> getHoldings(UUID portfolioId) {
        return holdingRepository.findByPortfolioId(portfolioId);
    }

    // ❌ DELETE HOLDING
    public void deleteHolding(UUID id) {
        holdingRepository.deleteById(id);
    }

    // 💰 TOTAL INVESTMENT (quantity × buyPrice)
    public double getTotalInvestment(UUID portfolioId) {
        List<Holding> holdings = holdingRepository.findByPortfolioId(portfolioId);
        double total = 0;
        for (Holding h : holdings) {
            total += h.getQuantity() * h.getBuyPrice();
        }
        return total;
    }

    // 📈 CURRENT VALUE (quantity × live price, falls back to buyPrice)
    public double getCurrentValue(UUID portfolioId) {
        List<Holding> holdings = holdingRepository.findByPortfolioId(portfolioId);
        double total = 0;
        for (Holding h : holdings) {
            double livePrice = stockService.getLivePrice(h.getSymbol());
            double price = livePrice > 0 ? livePrice : h.getBuyPrice();
            total += h.getQuantity() * price;
        }
        return total;
    }

    // 💸 PROFIT / LOSS
    public double getProfit(UUID portfolioId) {
        return getCurrentValue(portfolioId) - getTotalInvestment(portfolioId);
    }
}