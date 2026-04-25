package com.stocksense.controller;

import com.stocksense.model.Holding;
import com.stocksense.service.HoldingService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/holdings")
public class HoldingController {

    private final HoldingService holdingService;

    public HoldingController(HoldingService holdingService) {
        this.holdingService = holdingService;
    }

    // ➕ ADD STOCK
    @PostMapping
    public Holding add(@RequestBody Holding holding) {
        return holdingService.addHolding(holding);
    }

    // 📄 GET STOCKS IN PORTFOLIO
    @GetMapping("/{portfolioId}")
    public List<Holding> get(@PathVariable UUID portfolioId) {
        return holdingService.getHoldings(portfolioId);
    }

    // ❌ DELETE STOCK
    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        holdingService.deleteHolding(id);
    }

    // 💰 TOTAL INVESTMENT
    @GetMapping("/investment/{portfolioId}")
    public double getInvestment(@PathVariable UUID portfolioId) {
        return holdingService.getTotalInvestment(portfolioId);
    }

    // 📈 CURRENT VALUE
    @GetMapping("/value/{portfolioId}")
    public double getCurrentValue(@PathVariable UUID portfolioId) {
        return holdingService.getCurrentValue(portfolioId);
    }

    // 💸 PROFIT
    @GetMapping("/profit/{portfolioId}")
    public double getProfit(@PathVariable UUID portfolioId) {
        return holdingService.getProfit(portfolioId);
    }
}