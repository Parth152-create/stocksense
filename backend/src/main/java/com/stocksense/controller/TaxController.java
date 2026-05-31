package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.service.TaxLotService;
import com.stocksense.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * TaxController
 *
 * GET /api/portfolio/tax-lots
 *   Returns open FIFO buy lots per symbol with unrealized gain per lot.
 *
 * GET /api/portfolio/tax-report?year=2026
 *   Returns realized gain/loss summary for the given tax year (defaults to current year).
 */
@RestController
@RequestMapping("/api/portfolio")
public class TaxController {

    private final TaxLotService taxLotService;
    private final UserService   userService;

    public TaxController(TaxLotService taxLotService, UserService userService) {
        this.taxLotService = taxLotService;
        this.userService   = userService;
    }

    @GetMapping("/tax-lots")
    public ResponseEntity<?> getTaxLots(@AuthenticationPrincipal String email) {
        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        List<Map<String, Object>> lots = taxLotService.getTaxLots(user.getId());
        return ResponseEntity.ok(lots);
    }

    @GetMapping("/tax-report")
    public ResponseEntity<?> getTaxReport(
            @AuthenticationPrincipal String email,
            @RequestParam(required = false) Integer year) {
        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user    = userService.getUserByEmail(email);
        int taxYear  = year != null ? year : LocalDate.now().getYear();
        Map<String, Object> report = taxLotService.getTaxReport(user.getId(), taxYear);
        return ResponseEntity.ok(report);
    }
}