package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.model.WatchlistItem;
import com.stocksense.repository.UserRepository;
import com.stocksense.repository.WatchlistRepository;
import com.stocksense.service.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {

    private final WatchlistRepository watchlistRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public WatchlistController(WatchlistRepository watchlistRepository,
                               JwtService jwtService,
                               UserRepository userRepository) {
        this.watchlistRepository = watchlistRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    // GET /api/watchlist
    @GetMapping
    public ResponseEntity<List<WatchlistItem>> getWatchlist(
            @RequestHeader("Authorization") String authHeader) {
        User user = getUser(extractEmail(authHeader));
        return ResponseEntity.ok(watchlistRepository.findByUserId(user.getId()));
    }

    // POST /api/watchlist/{symbol}
    @PostMapping("/{symbol}")
    public ResponseEntity<WatchlistItem> addToWatchlist(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String symbol) {
        User user = getUser(extractEmail(authHeader));

        // Avoid duplicates
        boolean exists = watchlistRepository.findByUserId(user.getId())
            .stream()
            .anyMatch(w -> w.getSymbol().equalsIgnoreCase(symbol));

        if (exists) return ResponseEntity.ok().build();

        WatchlistItem item = new WatchlistItem();
        item.setUserId(user.getId());          // UUID directly — no toString()
        item.setSymbol(symbol.toUpperCase());
        // alertPrice and lastCheckedPrice are optional — leave null

        return ResponseEntity.ok(watchlistRepository.save(item));
    }

    // DELETE /api/watchlist/{symbol}
    @DeleteMapping("/{symbol}")
    public ResponseEntity<Void> removeFromWatchlist(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String symbol) {
        User user = getUser(extractEmail(authHeader));

        watchlistRepository.findByUserId(user.getId())
            .stream()
            .filter(w -> w.getSymbol().equalsIgnoreCase(symbol))
            .findFirst()
            .ifPresent(watchlistRepository::delete);

        return ResponseEntity.ok().build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractEmail(String authHeader) {
        return jwtService.extractEmail(authHeader.replace("Bearer ", "").trim());
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found: " + email));
    }
}