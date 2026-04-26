package com.stocksense.controller;

import com.stocksense.dto.StockResponseDTO;
import com.stocksense.service.StockService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/stocks")
@CrossOrigin(origins = "http://localhost:3000")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    @GetMapping("/{symbol}")
    public StockResponseDTO getStock(@PathVariable String symbol) {
        return stockService.getStock(symbol);
    }
}