package com.stocksense.controller;

import com.stocksense.service.UserService;
import com.stocksense.model.User;
import com.stocksense.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService     userService;
    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserService userService,
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder) {
        this.userService     = userService;
        this.userRepository  = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ── GET /api/users/me ─────────────────────────────────────────────────────
    @GetMapping("/me")
    public ResponseEntity<?> getMe(@AuthenticationPrincipal String email) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        String displayName = (user.getName() != null && !user.getName().isBlank())
            ? user.getName()
            : email.split("@")[0];
        return ResponseEntity.ok(Map.of(
            "id",          user.getId(),
            "email",       user.getEmail(),
            "name",        displayName,
            "provider",    user.getProvider()    != null ? user.getProvider()    : "local",
            "createdAt",   user.getCreatedAt(),
            "portfolioId", user.getPortfolioId() != null ? user.getPortfolioId() : ""
        ));
    }

    // ── PUT /api/users/me ─────────────────────────────────────────────────────
    @PutMapping("/me")
    public ResponseEntity<?> updateMe(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, Object> body) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        if (body.containsKey("name"))  user.setName((String) body.get("name"));
        if (body.containsKey("email")) user.setEmail((String) body.get("email"));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("success", true, "message", "Profile updated"));
    }

    // ── PUT /api/users/me/password ────────────────────────────────────────────
    @PutMapping("/me/password")
    public ResponseEntity<?> changePassword(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, Object> body) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User   user            = userService.getUserByEmail(email);
        String currentPassword = (String) body.get("currentPassword");
        String newPassword     = (String) body.get("newPassword");

        if (currentPassword == null || newPassword == null)
            return ResponseEntity.badRequest()
                .body(Map.of("error", "currentPassword and newPassword are required"));
        if (newPassword.length() < 8)
            return ResponseEntity.badRequest()
                .body(Map.of("error", "New password must be at least 8 characters"));
        if (!passwordEncoder.matches(currentPassword, user.getPassword()))
            return ResponseEntity.status(401)
                .body(Map.of("error", "Current password is incorrect"));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("success", true, "message", "Password changed successfully"));
    }

    // ── DELETE /api/users/me ──────────────────────────────────────────────────
    //
    // Hard-deletes the authenticated user and all their data.
    // For Google users, password confirmation is skipped.
    //
    // Body (local users): { "password": "current_password" }
    // Body (google users): {} — no password needed
    // ─────────────────────────────────────────────────────────────────────────
    @DeleteMapping("/me")
    public ResponseEntity<?> deleteAccount(
            @AuthenticationPrincipal String email,
            @RequestBody(required = false) Map<String, Object> body) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userService.getUserByEmail(email);

        // Local users must confirm with their password
        if (!"google".equals(user.getProvider())) {
            String password = body != null ? (String) body.get("password") : null;
            if (password == null || password.isBlank())
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Password confirmation required to delete account"));
            if (!passwordEncoder.matches(password, user.getPassword()))
                return ResponseEntity.status(401)
                    .body(Map.of("error", "Incorrect password"));
        }

        // Delegate full cascade delete to UserService
        userService.deleteUser(user);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Account permanently deleted"
        ));
    }
}