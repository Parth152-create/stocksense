package com.stocksense.service;

import com.stocksense.model.RefreshToken;
import com.stocksense.model.User;
import com.stocksense.repository.RefreshTokenRepository;
import com.stocksense.repository.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private static final long REFRESH_TOKEN_DURATION_MS = 7L * 24 * 60 * 60 * 1000; // 7 days

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository,
                               UserRepository userRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
    }

    // ─── Called by AuthController: createRefreshToken(email) ─────────────────
    @Transactional
    public RefreshToken createRefreshToken(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));

        return createRefreshTokenForUser(user);
    }

    @Transactional
    public RefreshToken createRefreshToken(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        return createRefreshTokenForUser(user);
    }

    private RefreshToken createRefreshTokenForUser(User user) {
        // Delete any existing refresh token for this user (one token per user)
        refreshTokenRepository.deleteByUserId(user.getId());

        RefreshToken token = new RefreshToken(
                UUID.randomUUID().toString(),
                user,
                Instant.now().plusMillis(REFRESH_TOKEN_DURATION_MS)
        );

        return refreshTokenRepository.save(token);
    }

    public Optional<RefreshToken> findByToken(String rawToken) {
        return refreshTokenRepository.findByToken(rawToken);
    }

    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.getExpiryDate().isBefore(Instant.now())) {
            refreshTokenRepository.delete(token);
            throw new RuntimeException("Refresh token expired. Please log in again.");
        }

        return token;
    }

    // ─── Called by AuthController: validateAndRotate(rawToken) ───────────────
    /**
     * Validates the incoming refresh token, deletes it, and issues a new one
     * (token rotation — each refresh token can only be used once).
     */
    @Transactional
    public RefreshToken validateAndRotate(String rawToken) {
        RefreshToken existing = refreshTokenRepository.findByToken(rawToken)
                .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        verifyExpiration(existing);

        // Rotate: delete old, issue new
        refreshTokenRepository.delete(existing);

        RefreshToken newToken = new RefreshToken(
                UUID.randomUUID().toString(),
                existing.getUser(),
                Instant.now().plusMillis(REFRESH_TOKEN_DURATION_MS)
        );

        return refreshTokenRepository.save(newToken);
    }

    // ─── Called by AuthController: deleteByToken(rawToken) ───────────────────
    @Transactional
    public void deleteByToken(String rawToken) {
        refreshTokenRepository.findByToken(rawToken)
                .ifPresent(refreshTokenRepository::delete);
    }

    // ─── Kept for internal use ────────────────────────────────────────────────
    @Transactional
    public void deleteByUserId(UUID userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }

    // ─── Cleanup expired tokens — runs daily at midnight ─────────────────────
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void purgeExpiredTokens() {
        refreshTokenRepository.deleteAllExpiredTokens(Instant.now());
    }
}
