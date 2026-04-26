package com.stocksense.service;

import com.stocksense.dto.PortfolioSummaryDTO;
import com.stocksense.model.Portfolio;
import com.stocksense.repository.PortfolioRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class PortfolioService {

    private final PortfolioRepository portfolioRepository;
    private final HoldingService holdingService;

    public PortfolioService(PortfolioRepository portfolioRepository,
                            HoldingService holdingService) {
        this.portfolioRepository = portfolioRepository;
        this.holdingService = holdingService;
    }

    public Portfolio createPortfolio(UUID userId, String name) {
        Portfolio portfolio = new Portfolio();
        portfolio.setUserId(userId);
        portfolio.setName(name);
        return portfolioRepository.save(portfolio);
    }

    public List<Portfolio> getUserPortfolios(UUID userId) {
        return portfolioRepository.findByUserId(userId);
    }

    // 🚀 NEW SUMMARY METHOD
    public PortfolioSummaryDTO getSummary(UUID portfolioId) {
        double investment = holdingService.getTotalInvestment(portfolioId);
        double currentValue = holdingService.getCurrentValue(portfolioId);
        double profit = holdingService.getProfit(portfolioId);

        return new PortfolioSummaryDTO(investment, currentValue, profit);
    }
}