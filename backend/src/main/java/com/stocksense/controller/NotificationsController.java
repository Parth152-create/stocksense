package com.stocksense.controller;

import com.stocksense.model.Notification;
import com.stocksense.model.User;
import com.stocksense.repository.UserRepository;
import com.stocksense.service.JwtService;
import com.stocksense.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationsController {

    private final NotificationService notificationService;
    private final JwtService          jwtService;
    private final UserRepository      userRepository;

    public NotificationsController(NotificationService notificationService,
                                   JwtService jwtService,
                                   UserRepository userRepository) {
        this.notificationService = notificationService;
        this.jwtService          = jwtService;
        this.userRepository      = userRepository;
    }

    // ── GET /api/notifications ────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<Notification>> getAll(
            @RequestHeader("Authorization") String authHeader) {
        String email = extractEmail(authHeader);
        return ResponseEntity.ok(notificationService.getForUser(email));
    }

    // ── GET /api/notifications/unread-count ───────────────────────────────────
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @RequestHeader("Authorization") String authHeader) {
        String email = extractEmail(authHeader);
        long count = notificationService.getUnreadCount(email);
        return ResponseEntity.ok(Map.of("count", count));
    }

    // ── POST /api/notifications/{id}/read ────────────────────────────────────
    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID id) {
        notificationService.markRead(id);
        return ResponseEntity.ok().build();
    }

    // ── POST /api/notifications/read-all ─────────────────────────────────────
    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(
            @RequestHeader("Authorization") String authHeader) {
        String email = extractEmail(authHeader);
        notificationService.markAllRead(email);
        return ResponseEntity.ok().build();
    }

    // ── GET /api/notifications/preferences ───────────────────────────────────
    //
    // Returns the user's notification preference toggles.
    // Stored as boolean columns on the User entity.
    // Falls back to true (all on) if not yet set.
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/preferences")
    public ResponseEntity<?> getPreferences(
            @RequestHeader("Authorization") String authHeader) {
        User user = getUser(extractEmail(authHeader));
        return ResponseEntity.ok(Map.of(
            "priceAlerts",        user.isPrefPriceAlerts(),
            "transactionEmails",  user.isPrefTransactionEmails(),
            "mentMessages",       user.isPrefMentMessages()
        ));
    }

    // ── PUT /api/notifications/preferences ───────────────────────────────────
    //
    // Persists notification preference toggles.
    // Only updates keys that are present in the request body —
    // omitted keys are left unchanged.
    //
    // Body (all optional):
    // {
    //   "priceAlerts":       true,
    //   "transactionEmails": false,
    //   "mentMessages":      true
    // }
    // ─────────────────────────────────────────────────────────────────────────
    @PutMapping("/preferences")
    public ResponseEntity<?> updatePreferences(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> body) {

        User user = getUser(extractEmail(authHeader));

        if (body.containsKey("priceAlerts")) {
            user.setPrefPriceAlerts(Boolean.parseBoolean(body.get("priceAlerts").toString()));
        }
        if (body.containsKey("transactionEmails")) {
            user.setPrefTransactionEmails(Boolean.parseBoolean(body.get("transactionEmails").toString()));
        }
        if (body.containsKey("mentMessages")) {
            user.setPrefMentMessages(Boolean.parseBoolean(body.get("mentMessages").toString()));
        }

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
            "success",            true,
            "priceAlerts",        user.isPrefPriceAlerts(),
            "transactionEmails",  user.isPrefTransactionEmails(),
            "mentMessages",       user.isPrefMentMessages()
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
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));
    }
}