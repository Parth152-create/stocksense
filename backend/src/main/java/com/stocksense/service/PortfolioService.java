package com.stocksense.service;

import com.stocksense.model.Portfolio;
import com.stocksense.repository.PortfolioRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class PortfolioService {

    private final PortfolioRepository portfolioRepository;

    public PortfolioService(PortfolioRepository portfolioRepository) {
        this.portfolioRepository = portfolioRepository;
    }

    public Portfolio createPortfolio(UUID userId, String name) {
        Portfolio p = new Portfolio();
        p.setUserId(userId);
        p.setName(name);
        return portfolioRepository.save(p);
    }

    public List<Portfolio> getUserPortfolios(UUID userId) {
        return portfolioRepository.findByUserId(userId);
    }
}