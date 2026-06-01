package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.repository.UserRepository;
import com.stocksense.service.PortfolioService;
import com.stocksense.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * PublicPortfolioController
 *
 * GET  /api/community/profiles          — list all public profiles
 * GET  /api/community/profiles/{username} — single public profile + portfolio
 * POST /api/community/profile           — update own public profile settings
 * PUT  /api/community/profile/visibility — toggle public/private
 */
@RestController
@RequestMapping("/api/community")
public class PublicPortfolioController {

    private final UserRepository   userRepository;
    private final UserService      userService;
    private final PortfolioService portfolioService;

    public PublicPortfolioController(UserRepository userRepository,
                                      UserService userService,
                                      PortfolioService portfolioService) {
        this.userRepository   = userRepository;
        this.userService      = userService;
        this.portfolioService = portfolioService;
    }

    // ── GET /api/community/profiles ───────────────────────────────────────────
    @GetMapping("/profiles")
    public ResponseEntity<?> listPublicProfiles() {
        List<User> publicUsers = userRepository.findAll().stream()
                .filter(User::isPublicProfile)
                .collect(Collectors.toList());

        List<Map<String, Object>> profiles = publicUsers.stream()
                .map(u -> buildProfileCard(u, false))
                .collect(Collectors.toList());

        return ResponseEntity.ok(profiles);
    }

    // ── GET /api/community/profiles/{username} ────────────────────────────────
    @GetMapping("/profiles/{username}")
    public ResponseEntity<?> getPublicProfile(@PathVariable String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body(Map.of("error", "Profile not found"));

        User user = userOpt.get();
        if (!user.isPublicProfile())
            return ResponseEntity.status(403).body(Map.of("error", "This portfolio is private"));

        Map<String, Object> profile = buildProfileCard(user, true);
        return ResponseEntity.ok(profile);
    }

    // ── POST /api/community/profile — update bio + username ──────────────────
    @PostMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, Object> body) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);

        if (body.containsKey("username")) {
            String newUsername = body.get("username").toString().trim().toLowerCase()
                    .replaceAll("[^a-z0-9_]", "");
            if (!newUsername.isEmpty()) {
                // Check uniqueness
                Optional<User> existing = userRepository.findByUsername(newUsername);
                if (existing.isPresent() && !existing.get().getId().equals(user.getId()))
                    return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
                user.setUsername(newUsername);
            }
        }
        if (body.containsKey("bio")) {
            String bio = body.get("bio").toString();
            if (bio.length() > 200)
                return ResponseEntity.badRequest().body(Map.of("error", "Bio max 200 characters"));
            user.setBio(bio);
        }
        if (body.containsKey("name")) {
            user.setName(body.get("name").toString());
        }

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
            "success",  true,
            "username", user.getUsername() != null ? user.getUsername() : "",
            "bio",      user.getBio()      != null ? user.getBio()      : "",
            "name",     user.getName()     != null ? user.getName()     : ""
        ));
    }

    // ── PUT /api/community/profile/visibility — toggle public/private ─────────
    @PutMapping("/profile/visibility")
    public ResponseEntity<?> toggleVisibility(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, Object> body) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);
        boolean isPublic = Boolean.parseBoolean(body.getOrDefault("public", "false").toString());

        // Must have a username to go public
        if (isPublic && (user.getUsername() == null || user.getUsername().isBlank()))
            return ResponseEntity.badRequest().body(Map.of("error", "Set a username before making your portfolio public"));

        user.setPublicProfile(isPublic);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
            "success",       true,
            "publicProfile", isPublic,
            "message",       isPublic ? "Your portfolio is now public" : "Your portfolio is now private"
        ));
    }

    // ── GET /api/community/me — own profile settings ──────────────────────────
    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile(@AuthenticationPrincipal String email) {
        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);
        return ResponseEntity.ok(Map.of(
            "username",      user.getUsername()    != null ? user.getUsername() : "",
            "bio",           user.getBio()         != null ? user.getBio()      : "",
            "name",          user.getName()        != null ? user.getName()     : "",
            "publicProfile", user.isPublicProfile()
        ));
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private Map<String, Object> buildProfileCard(User user, boolean includeHoldings) {
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("userId",   user.getId().toString());
        card.put("username", user.getUsername() != null ? user.getUsername() : "");
        card.put("name",     user.getName()     != null ? user.getName()     : "Anonymous");
        card.put("bio",      user.getBio()      != null ? user.getBio()      : "");
        card.put("joinedAt", user.getCreatedAt() != null ? user.getCreatedAt().toLocalDate().toString() : "");

        // Portfolio summary — safe, no sensitive data
        try {
            Map<String, Object> summary = portfolioService.getSummary(user.getId());
            card.put("totalValue",   summary.get("totalValue"));
            card.put("totalPnlPct",  summary.get("totalPnlPct"));
            card.put("positions",    ((List<?>) summary.getOrDefault("holdings", List.of())).size());
            card.put("allocation",   summary.get("allocation"));

            if (includeHoldings) {
                // Show holdings on full profile view
                card.put("holdings", summary.get("holdings"));
                card.put("bestPerformer",  summary.get("bestPerformer"));
                card.put("worstPerformer", summary.get("worstPerformer"));
            }
        } catch (Exception e) {
            card.put("totalValue",  0);
            card.put("totalPnlPct", 0);
            card.put("positions",   0);
        }

        return card;
    }
}