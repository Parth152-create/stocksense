package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.model.WatchlistItem;
import com.stocksense.repository.UserRepository;
import com.stocksense.repository.WatchlistRepository;
import com.stocksense.service.JwtService;
import com.stocksense.service.StockService;
import jakarta.transaction.Transactional;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {

    private final WatchlistRepository watchlistRepository;
    private final JwtService          jwtService;
    private final UserRepository      userRepository;
    private final StockService        stockService;

    public WatchlistController(WatchlistRepository watchlistRepository,
                               JwtService jwtService,
                               UserRepository userRepository,
                               StockService stockService) {
        this.watchlistRepository = watchlistRepository;
        this.jwtService          = jwtService;
        this.userRepository      = userRepository;
        this.stockService        = stockService;
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

        // Inherit share token if the user already has one active
        String existingToken = watchlistRepository.findByUserId(user.getId())
            .stream()
            .filter(w -> w.getShareToken() != null)
            .map(WatchlistItem::getShareToken)
            .findFirst()
            .orElse(null);
        boolean isShared = watchlistRepository.findByUserId(user.getId())
            .stream()
            .anyMatch(WatchlistItem::isShared);

        WatchlistItem item = new WatchlistItem();
        item.setUserId(user.getId());
        item.setSymbol(symbol.toUpperCase());
        item.setShareToken(existingToken);
        item.setShared(isShared);

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
    @PutMapping("/{symbol}/alert")
    public ResponseEntity<?> setAlert(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String symbol,
            @RequestBody Map<String, Object> body) {

        User user = getUser(extractEmail(authHeader));

        WatchlistItem item = watchlistRepository.findByUserId(user.getId())
            .stream()
            .filter(w -> w.getSymbol().equalsIgnoreCase(symbol))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(
                NOT_FOUND, symbol + " is not in your watchlist"
            ));

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

    // ── POST /api/watchlist/share ─────────────────────────────────────────────
    //
    // Generates (or reuses) a share token for the authenticated user's watchlist
    // and marks all their items as shared = true.
    // Returns the token so the frontend can build the shareable URL.
    //
    // Idempotent: calling it again returns the same token.
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
    @PostMapping("/share")
    public ResponseEntity<?> shareWatchlist(
            @RequestHeader("Authorization") String authHeader) {

        User user = getUser(extractEmail(authHeader));
        List<WatchlistItem> items = watchlistRepository.findByUserId(user.getId());

        if (items.isEmpty())
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Add at least one symbol before sharing your watchlist"
            ));

        // Reuse existing token or generate a new one
        String token = items.stream()
            .filter(w -> w.getShareToken() != null)
            .map(WatchlistItem::getShareToken)
            .findFirst()
            .orElse(UUID.randomUUID().toString().replace("-", ""));

        watchlistRepository.updateShareTokenForUser(user.getId(), token, true);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "token",   token,
            "symbols", items.stream().map(WatchlistItem::getSymbol).toList()
        ));
    }

    // ── DELETE /api/watchlist/share ───────────────────────────────────────────
    //
    // Revokes the share link — sets shared = false on all items.
    // The token is preserved so re-sharing generates the same URL.
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
    @DeleteMapping("/share")
    public ResponseEntity<?> unshareWatchlist(
            @RequestHeader("Authorization") String authHeader) {

        User user = getUser(extractEmail(authHeader));
        List<WatchlistItem> items = watchlistRepository.findByUserId(user.getId());

        String token = items.stream()
            .filter(w -> w.getShareToken() != null)
            .map(WatchlistItem::getShareToken)
            .findFirst()
            .orElse(null);

        if (token != null)
            watchlistRepository.updateShareTokenForUser(user.getId(), token, false);

        return ResponseEntity.ok(Map.of("success", true, "message", "Watchlist is now private"));
    }

    // ── GET /api/watchlist/shared/{token} — NO AUTH REQUIRED ─────────────────
    //
    // Public endpoint — anyone with the token can view the watchlist.
    // Returns symbols with live prices. Never exposes alertPrice.
    // Returns 404 if token is unknown or the owner has revoked sharing.
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/shared/{token}")
    public ResponseEntity<?> getSharedWatchlist(@PathVariable String token) {

        List<WatchlistItem> items = watchlistRepository.findByShareToken(token);

        // Token unknown or owner revoked sharing
        boolean anyShared = items.stream().anyMatch(WatchlistItem::isShared);
        if (items.isEmpty() || !anyShared)
            return ResponseEntity.status(NOT_FOUND).body(Map.of(
                "error", "This watchlist link is invalid or has been revoked"
            ));

        // Resolve owner's display name (best-effort)
        UUID ownerId = items.get(0).getUserId();
        String ownerName = userRepository.findById(ownerId)
            .map(u -> u.getUsername() != null && !u.getUsername().isBlank()
                ? "@" + u.getUsername()
                : u.getName() != null ? u.getName() : "A StockSense user")
            .orElse("A StockSense user");

        // Build public response — enrich with live prices, hide sensitive fields
        List<Map<String, Object>> result = new ArrayList<>();
        for (WatchlistItem item : items) {
            if (!item.isShared()) continue;

            double livePrice = stockService.getLivePrice(item.getSymbol());
            if (livePrice == 0 && item.getLastCheckedPrice() != null)
                livePrice = item.getLastCheckedPrice().doubleValue();

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("symbol", item.getSymbol());
            entry.put("price",  livePrice);
            // No alertPrice exposed — privacy
            result.add(entry);
        }

        return ResponseEntity.ok(Map.of(
            "owner",   ownerName,
            "symbols", result,
            "count",   result.size()
        ));
    }

    // ── GET /api/watchlist/share/status — own share state ────────────────────
    @GetMapping("/share/status")
    public ResponseEntity<?> getShareStatus(
            @RequestHeader("Authorization") String authHeader) {

        User user = getUser(extractEmail(authHeader));
        List<WatchlistItem> items = watchlistRepository.findByUserId(user.getId());

        String token = items.stream()
            .filter(w -> w.getShareToken() != null)
            .map(WatchlistItem::getShareToken)
            .findFirst()
            .orElse(null);

        boolean isShared = items.stream().anyMatch(WatchlistItem::isShared);

        return ResponseEntity.ok(Map.of(
            "shared", isShared,
            "token",  token != null ? token : "",
            "count",  items.size()
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