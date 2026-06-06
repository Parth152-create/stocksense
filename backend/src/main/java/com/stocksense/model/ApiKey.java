package com.stocksense.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ApiKey
 *
 * Stores developer API keys for programmatic access to StockSense.
 * The raw key is NEVER stored — only a SHA-256 hash.
 * The full key is returned exactly once (on creation) and never again.
 *
 * Key format: ss_live_<32 random hex chars>
 * Header:     X-API-Key: ss_live_...
 */
@Entity
@Table(name = "api_keys", indexes = {
    @Index(name = "idx_api_keys_user_id",   columnList = "user_id"),
    @Index(name = "idx_api_keys_key_hash",  columnList = "key_hash", unique = true),
})
public class ApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Human-readable label set by the user (e.g. "My trading bot") */
    @Column(nullable = false, length = 100)
    private String name;

    /** SHA-256 hash of the raw key — this is what we store and compare against */
    @Column(name = "key_hash", nullable = false, unique = true, length = 64)
    private String keyHash;

    /** First 8 chars of the raw key shown in UI so user can identify it (e.g. "ss_live_ab12cd34…") */
    @Column(name = "key_prefix", nullable = false, length = 16)
    private String keyPrefix;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    /** Soft-delete — revoked keys are kept for audit trail */
    @Column(nullable = false)
    private boolean revoked = false;

    // ── Getters ───────────────────────────────────────────────────────────────
    public UUID getId()                  { return id; }
    public UUID getUserId()              { return userId; }
    public String getName()              { return name; }
    public String getKeyHash()           { return keyHash; }
    public String getKeyPrefix()         { return keyPrefix; }
    public LocalDateTime getCreatedAt()  { return createdAt; }
    public LocalDateTime getLastUsedAt() { return lastUsedAt; }
    public boolean isRevoked()           { return revoked; }

    // ── Setters ───────────────────────────────────────────────────────────────
    public void setUserId(UUID userId)                    { this.userId = userId; }
    public void setName(String name)                      { this.name = name; }
    public void setKeyHash(String keyHash)                { this.keyHash = keyHash; }
    public void setKeyPrefix(String keyPrefix)            { this.keyPrefix = keyPrefix; }
    public void setCreatedAt(LocalDateTime createdAt)     { this.createdAt = createdAt; }
    public void setLastUsedAt(LocalDateTime lastUsedAt)   { this.lastUsedAt = lastUsedAt; }
    public void setRevoked(boolean revoked)               { this.revoked = revoked; }
}