package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.service.DigestService;
import com.stocksense.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * DigestController
 *
 * POST /api/digest/send-now
 *   Sends the weekly digest immediately to the authenticated user.
 *   Useful for testing without waiting for Monday 08:00 UTC.
 *
 * POST /api/digest/send-all   (admin use — no auth check beyond being logged in)
 *   Triggers the full weekly digest run for all opted-in users.
 */
@RestController
@RequestMapping("/api/digest")
public class DigestController {

    private static final Logger log = LoggerFactory.getLogger(DigestController.class);

    private final DigestService digestService;
    private final UserService   userService;

    public DigestController(DigestService digestService, UserService userService) {
        this.digestService = digestService;
        this.userService   = userService;
    }

    /**
     * POST /api/digest/send-now
     * Sends digest immediately to the calling user.
     */
    @PostMapping("/send-now")
    public ResponseEntity<?> sendNow(@AuthenticationPrincipal String email) {
        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);
        if (user == null)
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));

        try {
            digestService.sendDigestForUser(user);
            log.info("[DigestController] Manual digest sent to {}", email);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Weekly digest sent to " + email
            ));
        } catch (Exception e) {
            log.error("[DigestController] Failed to send digest to {}: {}", email, e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error",   e.getMessage()
            ));
        }
    }

    /**
     * POST /api/digest/send-all
     * Triggers the full weekly run for all opted-in users.
     * Runs async — returns immediately.
     */
    @PostMapping("/send-all")
    public ResponseEntity<?> sendAll(@AuthenticationPrincipal String email) {
        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        // Run in background thread so request doesn't hang
        Thread.ofVirtual().start(() -> {
            try {
                digestService.sendWeeklyDigests();
            } catch (Exception e) {
                log.error("[DigestController] send-all failed: {}", e.getMessage());
            }
        });

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Weekly digest run started — emails will be sent to all opted-in users"
        ));
    }
}