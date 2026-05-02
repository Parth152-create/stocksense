package com.stocksense.controller;

import com.stocksense.model.Notification;
import com.stocksense.service.JwtService;
import com.stocksense.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationsController {

    private final NotificationService notificationService;
    private final JwtService jwtService;

    public NotificationsController(NotificationService notificationService,
                                    JwtService jwtService) {
        this.notificationService = notificationService;
        this.jwtService = jwtService;
    }

    // GET /api/notifications — all notifications for current user
    @GetMapping
    public ResponseEntity<List<Notification>> getAll(
            @RequestHeader("Authorization") String authHeader) {
        String email = extractEmail(authHeader);
        return ResponseEntity.ok(notificationService.getForUser(email));
    }

    // GET /api/notifications/unread-count
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @RequestHeader("Authorization") String authHeader) {
        String email = extractEmail(authHeader);
        long count = notificationService.getUnreadCount(email);
        return ResponseEntity.ok(Map.of("count", count));
    }

    // POST /api/notifications/{id}/read
    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID id) {
        notificationService.markRead(id);
        return ResponseEntity.ok().build();
    }

    // POST /api/notifications/read-all
    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(
            @RequestHeader("Authorization") String authHeader) {
        String email = extractEmail(authHeader);
        notificationService.markAllRead(email);
        return ResponseEntity.ok().build();
    }

    private String extractEmail(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        return jwtService.extractEmail(token);
    }
}