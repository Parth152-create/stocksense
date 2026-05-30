package com.stocksense.controller;

import com.stocksense.service.BenchmarkService;
import com.stocksense.service.PdfExportService;
import com.stocksense.service.PortfolioService;
import com.stocksense.service.UserService;
import com.stocksense.model.User;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolio")
public class PortfolioController {

    private final PortfolioService portfolioService;
    private final BenchmarkService benchmarkService;
    private final PdfExportService pdfExportService;
    private final UserService      userService;

    public PortfolioController(PortfolioService portfolioService,
                               BenchmarkService benchmarkService,
                               PdfExportService pdfExportService,
                               UserService userService) {
        this.portfolioService = portfolioService;
        this.benchmarkService = benchmarkService;
        this.pdfExportService = pdfExportService;
        this.userService      = userService;
    }

    /** GET /api/portfolio */
    @GetMapping
    public ResponseEntity<?> getPortfolio(
            @AuthenticationPrincipal String email,
            @RequestParam(required = false) String market) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        List<Map<String, Object>> holdings = market != null
                ? portfolioService.getHoldingsByMarket(user.getId(), market)
                : portfolioService.getHoldings(user.getId());
        return ResponseEntity.ok(holdings);
    }

    /** GET /api/portfolio/summary */
    @GetMapping("/summary")
    public ResponseEntity<?> getPortfolioSummary(
            @AuthenticationPrincipal String email,
            @RequestParam(required = false) String market) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        Map<String, Object> summary = market != null
                ? portfolioService.getSummaryByMarket(user.getId(), market)
                : portfolioService.getSummary(user.getId());
        return ResponseEntity.ok(summary);
    }

    /** GET /api/portfolio/history */
    @GetMapping("/history")
    public ResponseEntity<?> getPortfolioHistory(
            @AuthenticationPrincipal String email,
            @RequestParam(defaultValue = "1M") String range) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        return ResponseEntity.ok(portfolioService.getHistory(user.getId(), range));
    }

    /** GET /api/portfolio/benchmark */
    @GetMapping("/benchmark")
    public ResponseEntity<?> getBenchmark(
            @AuthenticationPrincipal String email,
            @RequestParam(defaultValue = "1Y")  String range,
            @RequestParam(defaultValue = "US")  String market) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        List<Map<String, Object>> portfolioHistory = portfolioService.getHistory(user.getId(), range);
        List<Map<String, Object>> comparison = benchmarkService.getBenchmarkComparison(portfolioHistory, market, range);
        return ResponseEntity.ok(comparison);
    }

    /**
     * GET /api/portfolio/export/pdf
     * GET /api/portfolio/export/pdf?market=US
     *
     * Returns a PDF binary download of the full portfolio report.
     * Includes: summary cards, P&L breakdown, holdings table, allocation.
     */
    @GetMapping("/export/pdf")
    public ResponseEntity<byte[]> exportPdf(
            @AuthenticationPrincipal String email,
            @RequestParam(required = false) String market) {

        if (email == null)
            return ResponseEntity.status(401).build();

        User user = userService.getUserByEmail(email);

        // Get summary with all fields including holdings + allocation
        Map<String, Object> summary = market != null
                ? portfolioService.getSummaryByMarket(user.getId(), market)
                : portfolioService.getSummary(user.getId());

        // Determine currency symbol from market param
        String currency = "IN".equalsIgnoreCase(market) ? "₹" : "$";

        byte[] pdf = pdfExportService.generatePortfolioReport(summary, currency);

        String filename = "stocksense-portfolio-"
                + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))
                + ".pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(pdf.length)
                .body(pdf);
    }
}