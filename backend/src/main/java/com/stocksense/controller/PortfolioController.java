package com.stocksense.controller;

import com.stocksense.dto.PortfolioSummaryDTO;
import com.stocksense.model.Portfolio;
import com.stocksense.model.User;
import com.stocksense.repository.UserRepository;
import com.stocksense.service.JwtService;
import com.stocksense.service.PortfolioService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/portfolio")
public class PortfolioController {

    private final PortfolioService portfolioService;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public PortfolioController(PortfolioService portfolioService,
                               JwtService jwtService,
                               UserRepository userRepository) {
        this.portfolioService = portfolioService;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    // ➕ CREATE PORTFOLIO
    @PostMapping
    public Portfolio create(@RequestBody Portfolio request,
                            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        String email = jwtService.extractEmail(token);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return portfolioService.createPortfolio(user.getId(), request.getName());
    }

    // 📄 GET USER PORTFOLIOS
    @GetMapping
    public List<Portfolio> get(@RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        String email = jwtService.extractEmail(token);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return portfolioService.getUserPortfolios(user.getId());
    }

    // 🚀 PORTFOLIO SUMMARY (NEW)
    @GetMapping("/summary/{portfolioId}")
    public PortfolioSummaryDTO getSummary(@PathVariable UUID portfolioId) {
        return portfolioService.getSummary(portfolioId);
    }
}