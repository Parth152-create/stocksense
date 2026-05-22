package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.model.WatchlistItem;
import com.stocksense.repository.UserRepository;
import com.stocksense.repository.WatchlistRepository;
import com.stocksense.service.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {

    private final WatchlistRepository watchlistRepository;
    private final JwtService          jwtService;
    private final UserRepository      userRepository;

    public WatchlistController(WatchlistRepository watchlistRepository,
                               JwtService jwtService,
                               UserRepository userRepository) {
        this.watchlistRepository = watchlistRepository;
        this.jwtService          = jwtService;
        this.userRepository      = userRepository;
    }

    // ── GET /api/watchlist ────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<WatchlistItem>> getWatchlist(
            @RequestHeader("Authorization") String authHeader) {
        User user = getUser(extractEmail(authHeader));
        return ResponseEntity.ok(watchlistRepository.findByUserId(user.getId()));
    }

    // ── POST /api/watchlist/{symbol} ──────────────────────────────────────────
    @PostMapping("/{symbol}")
    public ResponseEntity<WatchlistItem> addToWatchlist(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String symbol) {
        User user = getUser(extractEmail(authHeader));

        boolean exists = watchlistRepository.findByUserId(user.getId())
            .stream()
            .anyMatch(w -> w.getSymbol().equalsIgnoreCase(symbol));

        if (exists) return ResponseEntity.ok().build();

        WatchlistItem item = new WatchlistItem();
        item.setUserId(user.getId());
        item.setSymbol(symbol.toUpperCase());

        return ResponseEntity.ok(watchlistRepository.save(item));
    }

    // ── DELETE /api/watchlist/{symbol} ────────────────────────────────────────
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

    // ── PUT /api/watchlist/{symbol}/alert ─────────────────────────────────────
    //
    // Persists the alert price for a watchlist item.
    // The PriceAlertScheduler already reads alertPrice from watchlist_items
    // and fires an email when live price crosses it — this endpoint is the
    // missing piece that actually saves the value the user sets in the UI.
    //
    // Body: { "alertPrice": 185.50 }
    // Pass null or 0 to clear the alert.
    // ─────────────────────────────────────────────────────────────────────────
    @PutMapping("/{symbol}/alert")
    public ResponseEntity<?> setAlert(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String symbol,
            @RequestBody Map<String, Object> body) {

        User user = getUser(extractEmail(authHeader));

        // Find the watchlist item for this user + symbol
        WatchlistItem item = watchlistRepository.findByUserId(user.getId())
            .stream()
            .filter(w -> w.getSymbol().equalsIgnoreCase(symbol))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(
                NOT_FOUND, symbol + " is not in your watchlist"
            ));

        // Parse alertPrice — null / 0 clears the alert
        BigDecimal alertPrice = null;
        Object raw = body.get("alertPrice");
        if (raw != null) {
            try {
                BigDecimal parsed = new BigDecimal(raw.toString());
                alertPrice = parsed.compareTo(BigDecimal.ZERO) > 0 ? parsed : null;
            } catch (NumberFormatException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid alertPrice — must be a positive number or null to clear"
                ));
            }
        }

        item.setAlertPrice(alertPrice);
        watchlistRepository.save(item);

        return ResponseEntity.ok(Map.of(
            "success",    true,
            "symbol",     item.getSymbol(),
            "alertPrice", alertPrice != null ? alertPrice : "cleared"
        ));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractEmail(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer "))
            throw new ResponseStatusException(UNAUTHORIZED, "Missing bearer token");
        return jwtService.extractEmail(authHeader.substring(7).trim());
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found: " + email));
    }
}