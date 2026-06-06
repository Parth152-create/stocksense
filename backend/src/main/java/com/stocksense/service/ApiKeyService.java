package com.stocksense.service;

import com.stocksense.model.ApiKey;
import com.stocksense.model.User;
import com.stocksense.repository.ApiKeyRepository;
import com.stocksense.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;

/**
 * ApiKeyService
 *
 * Handles generation, validation, and revocation of developer API keys.
 *
 * Security model:
 *   - Raw key is generated once, returned once, never stored
 *   - Only SHA-256(rawKey) is persisted in api_keys.key_hash
 *   - On each request: hash the incoming key, look up hash in DB
 *   - lastUsedAt is updated asynchronously to avoid DB write on every request
 */
@Service
public class ApiKeyService {

    private static final int    MAX_KEYS_PER_USER = 10;
    private static final String KEY_PREFIX_STR    = "ss_live_";

    private final ApiKeyRepository apiKeyRepository;
    private final UserRepository   userRepository;
    private final SecureRandom     random = new SecureRandom();

    public ApiKeyService(ApiKeyRepository apiKeyRepository,
                         UserRepository userRepository) {
        this.apiKeyRepository = apiKeyRepository;
        this.userRepository   = userRepository;
    }

    // ── Result DTO ─────────────────────────────────────────────────────────────

    /** Returned exactly once on key creation — contains the raw key */
    public record CreatedKey(ApiKey apiKey, String rawKey) {}

    // ── Generate ───────────────────────────────────────────────────────────────

    @Transactional
    public CreatedKey generateKey(UUID userId, String name) {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("Key name is required");
        if (name.length() > 100)
            throw new IllegalArgumentException("Key name must be 100 characters or fewer");

        long activeCount = apiKeyRepository.countByUserIdAndRevokedFalse(userId);
        if (activeCount >= MAX_KEYS_PER_USER)
            throw new IllegalStateException("Maximum of " + MAX_KEYS_PER_USER + " API keys per user");

        // Generate random 32-byte key → hex → prefix
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String hex    = HexFormat.of().formatHex(bytes);
        String rawKey = KEY_PREFIX_STR + hex;           // e.g. ss_live_ab12cd34...

        String hash   = sha256(rawKey);
        String prefix = rawKey.substring(0, Math.min(16, rawKey.length())); // ss_live_ab12cd34

        ApiKey apiKey = new ApiKey();
        apiKey.setUserId(userId);
        apiKey.setName(name.trim());
        apiKey.setKeyHash(hash);
        apiKey.setKeyPrefix(prefix);
        apiKey.setCreatedAt(LocalDateTime.now());

        return new CreatedKey(apiKeyRepository.save(apiKey), rawKey);
    }

    // ── List ───────────────────────────────────────────────────────────────────

    public List<ApiKey> listKeys(UUID userId) {
        return apiKeyRepository.findByUserIdAndRevokedFalseOrderByCreatedAtDesc(userId);
    }

    // ── Revoke ─────────────────────────────────────────────────────────────────

    @Transactional
    public void revokeKey(UUID keyId, UUID requestingUserId) {
        ApiKey key = apiKeyRepository.findById(keyId)
            .orElseThrow(() -> new NoSuchElementException("API key not found"));

        if (!key.getUserId().equals(requestingUserId))
            throw new SecurityException("You do not own this API key");

        key.setRevoked(true);
        apiKeyRepository.save(key);
    }

    // ── Validate (called by ApiKeyFilter on each request) ─────────────────────

    /**
     * Validates a raw API key from the X-API-Key header.
     * Returns the owning User if valid, empty if invalid/revoked.
     * Also updates lastUsedAt.
     */
    @Transactional
    public Optional<User> validateKey(String rawKey) {
        if (rawKey == null || !rawKey.startsWith(KEY_PREFIX_STR)) return Optional.empty();

        String hash = sha256(rawKey);
        Optional<ApiKey> keyOpt = apiKeyRepository.findByKeyHashAndRevokedFalse(hash);
        if (keyOpt.isEmpty()) return Optional.empty();

        ApiKey apiKey = keyOpt.get();

        // Update lastUsedAt
        apiKey.setLastUsedAt(LocalDateTime.now());
        apiKeyRepository.save(apiKey);

        return userRepository.findById(apiKey.getUserId());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 unavailable", e);
        }
    }
}