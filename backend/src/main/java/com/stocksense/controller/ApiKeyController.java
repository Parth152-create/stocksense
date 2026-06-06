package com.stocksense.controller;

import com.stocksense.model.ApiKey;
import com.stocksense.model.User;
import com.stocksense.service.ApiKeyService;
import com.stocksense.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * ApiKeyController
 *
 * GET    /api/keys          — list all active keys for the user
 * POST   /api/keys          — create a new key (returns raw key once)
 * DELETE /api/keys/{id}     — revoke a key
 */
@RestController
@RequestMapping("/api/keys")
public class ApiKeyController {

    private final ApiKeyService apiKeyService;
    private final UserService   userService;

    public ApiKeyController(ApiKeyService apiKeyService, UserService userService) {
        this.apiKeyService = apiKeyService;
        this.userService   = userService;
    }

    @GetMapping
    public ResponseEntity<?> listKeys(@AuthenticationPrincipal String email) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userService.getUserByEmail(email);
        List<Map<String, Object>> result = apiKeyService.listKeys(user.getId()).stream()
            .map(k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id",          k.getId().toString());
                m.put("name",        k.getName());
                m.put("keyPrefix",   k.getKeyPrefix() + "…");
                m.put("createdAt",   k.getCreatedAt().toString());
                m.put("lastUsedAt",  k.getLastUsedAt() != null ? k.getLastUsedAt().toString() : null);
                return m;
            }).toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> createKey(@AuthenticationPrincipal String email,
                                       @RequestBody Map<String, Object> body) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        String name = body.getOrDefault("name", "").toString().trim();
        if (name.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "Key name is required"));

        try {
            User user = userService.getUserByEmail(email);
            ApiKeyService.CreatedKey created = apiKeyService.generateKey(user.getId(), name);
            ApiKey k = created.apiKey();

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id",        k.getId().toString());
            response.put("name",      k.getName());
            response.put("keyPrefix", k.getKeyPrefix() + "…");
            response.put("key",       created.rawKey()); // shown ONCE
            response.put("createdAt", k.getCreatedAt().toString());
            response.put("warning",   "Copy this key now — it will not be shown again.");
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> revokeKey(@AuthenticationPrincipal String email,
                                       @PathVariable UUID id) {
        if (email == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        try {
            User user = userService.getUserByEmail(email);
            apiKeyService.revokeKey(id, user.getId());
            return ResponseEntity.ok(Map.of("success", true, "message", "API key revoked"));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", "Key not found"));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", "You do not own this key"));
        }
    }
}