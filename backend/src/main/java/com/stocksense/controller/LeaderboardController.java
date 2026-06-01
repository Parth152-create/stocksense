package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.repository.UserRepository;
import com.stocksense.service.PortfolioService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * LeaderboardController
 *
 * GET /api/community/leaderboard?sort=returnPct&limit=20
 *
 * Returns top public portfolios sorted by:
 *   returnPct  — total P&L % (default)
 *   totalValue — largest portfolio by value
 *   positions  — most holdings
 */
@RestController
@RequestMapping("/api/community")
public class LeaderboardController {

    private final UserRepository   userRepository;
    private final PortfolioService portfolioService;

    public LeaderboardController(UserRepository userRepository,
                                  PortfolioService portfolioService) {
        this.userRepository   = userRepository;
        this.portfolioService = portfolioService;
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<?> getLeaderboard(
            @RequestParam(defaultValue = "returnPct") String sort,
            @RequestParam(defaultValue = "20")        int    limit) {

        List<User> publicUsers = userRepository.findAll().stream()
                .filter(User::isPublicProfile)
                .collect(Collectors.toList());

        // Build leaderboard entries
        List<Map<String, Object>> entries = new ArrayList<>();

        for (User user : publicUsers) {
            try {
                Map<String, Object> summary = portfolioService.getSummary(user.getId());

                double totalValue  = getDouble(summary, "totalValue");
                double totalPnlPct = getDouble(summary, "totalPnlPct");
                double totalPnl    = getDouble(summary, "totalPnl");
                int    positions   = ((List<?>) summary.getOrDefault("holdings", List.of())).size();

                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("userId",      user.getId().toString());
                entry.put("username",    user.getUsername() != null ? user.getUsername() : "");
                entry.put("name",        user.getName()     != null ? user.getName()     : "Anonymous");
                entry.put("bio",         user.getBio()      != null ? user.getBio()      : "");
                entry.put("totalValue",  totalValue);
                entry.put("totalPnl",    totalPnl);
                entry.put("returnPct",   totalPnlPct);
                entry.put("positions",   positions);
                entry.put("allocation",  summary.get("allocation"));
                entries.add(entry);

            } catch (Exception ignored) {}
        }

        // Sort
        Comparator<Map<String, Object>> comparator = switch (sort) {
            case "totalValue" -> Comparator.comparingDouble(e -> -getDouble(e, "totalValue"));
            case "positions"  -> Comparator.comparingDouble(e -> -getDouble(e, "positions"));
            default           -> Comparator.comparingDouble(e -> -getDouble(e, "returnPct"));
        };
        entries.sort(comparator);

        // Add rank
        List<Map<String, Object>> ranked = new ArrayList<>();
        for (int i = 0; i < Math.min(entries.size(), limit); i++) {
            Map<String, Object> entry = new LinkedHashMap<>(entries.get(i));
            entry.put("rank", i + 1);
            ranked.add(entry);
        }

        return ResponseEntity.ok(Map.of(
            "leaderboard", ranked,
            "total",       publicUsers.size(),
            "sort",        sort
        ));
    }

    private double getDouble(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v instanceof Number ? ((Number) v).doubleValue() : 0;
    }
}