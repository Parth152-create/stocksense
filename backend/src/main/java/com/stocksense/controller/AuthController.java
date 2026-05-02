package com.stocksense.controller;

import com.stocksense.dto.LoginRequestDTO;
import com.stocksense.dto.LoginResponseDTO;
import com.stocksense.model.User;
import com.stocksense.service.GoogleOAuthService;
import com.stocksense.service.JwtService;
import com.stocksense.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final JwtService jwtService;
    private final GoogleOAuthService googleOAuthService;

    public AuthController(UserService userService,
                          JwtService jwtService,
                          GoogleOAuthService googleOAuthService) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.googleOAuthService = googleOAuthService;
    }

    // ── Register ────────────────────────────────────────────────────────────
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest body) {
        try {
            User user = new User();
            user.setEmail(body.email());
            user.setPassword(body.password());
            user.setName(body.name());
            user.setProvider("local");
            userService.register(user);

            String token = jwtService.generateToken(body.email());
            return ResponseEntity.ok(new LoginResponseDTO(token, body.email()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Login ────────────────────────────────────────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO body) {
        try {
            User user = userService.login(body.getEmail(), body.getPassword());
            String token = jwtService.generateToken(user.getEmail());
            return ResponseEntity.ok(new LoginResponseDTO(token, user.getEmail()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    // ── Google OAuth ─────────────────────────────────────────────────────────
    @PostMapping("/google")
    public ResponseEntity<?> googleAuth(@RequestBody Map<String, String> body) {
        try {
            String idToken = body.get("idToken");
            if (idToken == null || idToken.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Missing idToken"));
            }

            GoogleOAuthService.GoogleUserInfo info = googleOAuthService.verify(idToken);
            User user = userService.findOrCreateGoogleUser(info.email(), info.name());
            String token = jwtService.generateToken(user.getEmail());
            return ResponseEntity.ok(new LoginResponseDTO(token, user.getEmail()));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Google auth failed: " + e.getMessage()));
        }
    }

    // ── Inner record for register body ───────────────────────────────────────
    record RegisterRequest(String name, String email, String password) {}
}