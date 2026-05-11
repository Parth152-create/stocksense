package com.stocksense.controller;

import com.stocksense.dto.LoginRequestDTO;
import com.stocksense.dto.LoginResponseDTO;
import com.stocksense.dto.RegisterRequestDTO;
import com.stocksense.model.RefreshToken;
import com.stocksense.model.User;
import com.stocksense.service.GoogleOAuthService;
import com.stocksense.service.JwtService;
import com.stocksense.service.RefreshTokenService;
import com.stocksense.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final GoogleOAuthService googleOAuthService;

    public AuthController(UserService userService,
                          JwtService jwtService,
                          RefreshTokenService refreshTokenService,
                          GoogleOAuthService googleOAuthService) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.googleOAuthService = googleOAuthService;
    }

    // ─── POST /api/auth/register ──────────────────────────────────────────────
    @PostMapping("/register")
    public ResponseEntity<LoginResponseDTO> register(
            @RequestBody RegisterRequestDTO request,
            HttpServletResponse response) {

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword()); // UserService BCrypts this
        user.setName(request.getName());
        user.setProvider("local");

        User savedUser = userService.register(user);

        return issueTokens(savedUser, response);
    }

    // ─── POST /api/auth/login ─────────────────────────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(
            @RequestBody LoginRequestDTO request,
            HttpServletResponse response) {

        User user = userService.login(request.getEmail(), request.getPassword());
        return issueTokens(user, response);
    }

    // ─── POST /api/auth/google ────────────────────────────────────────────────
    /**
     * Receives the Google ID token (credential) from the frontend
     * googleAuth(credential) call in lib/auth.ts, verifies it,
     * finds-or-creates the user, and returns the same JWT pair as login.
     *
     * Frontend sends: { credential: "<google-id-token>" }
     */
    @PostMapping("/google")
    public ResponseEntity<LoginResponseDTO> googleAuth(
            @RequestBody Map<String, String> body,
            HttpServletResponse response) {

        String credential = body.get("credential");
        if (credential == null || credential.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        User user = googleOAuthService.verifyAndGetUser(credential);
        return issueTokens(user, response);
    }

    // ─── POST /api/auth/refresh ───────────────────────────────────────────────
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponseDTO> refresh(
            @CookieValue(name = "refreshToken", required = false) String rawToken,
            HttpServletResponse response) {

        if (rawToken == null) {
            return ResponseEntity.status(401).build();
        }

        RefreshToken validated = refreshTokenService.findByToken(rawToken)
                .orElseThrow(() -> new RuntimeException("Refresh token not found"));
        refreshTokenService.verifyExpiration(validated);

        User user = validated.getUser();
        refreshTokenService.deleteByUserId(user.getId());
        RefreshToken rotated = refreshTokenService.createRefreshToken(user.getId());

        String accessToken = jwtService.generateToken(user.getEmail());
        setRefreshTokenCookie(response, rotated.getToken());

        return ResponseEntity.ok(new LoginResponseDTO(accessToken, user.getEmail()));
    }

    // ─── POST /api/auth/logout ────────────────────────────────────────────────
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = "refreshToken", required = false) String rawToken,
            HttpServletResponse response) {

        if (rawToken != null) {
            refreshTokenService.findByToken(rawToken)
                    .map(RefreshToken::getUser)
                    .ifPresent(user -> refreshTokenService.deleteByUserId(user.getId()));
        }

        Cookie cookie = new Cookie("refreshToken", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return ResponseEntity.ok().build();
    }

    // ─── Shared helper ────────────────────────────────────────────────────────
    private ResponseEntity<LoginResponseDTO> issueTokens(User user, HttpServletResponse response) {
        String accessToken = jwtService.generateToken(user.getEmail());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getId());
        setRefreshTokenCookie(response, refreshToken.getToken());
        return ResponseEntity.ok(new LoginResponseDTO(accessToken, user.getEmail()));
    }

    private void setRefreshTokenCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("refreshToken", token);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
        // cookie.setSecure(true); // enable in production (HTTPS only)
        response.addCookie(cookie);
    }
}
