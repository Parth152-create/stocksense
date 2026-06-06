package com.stocksense.repository;

import com.stocksense.model.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApiKeyRepository extends JpaRepository<ApiKey, UUID> {

    /** All non-revoked keys for a user — shown in settings UI */
    List<ApiKey> findByUserIdAndRevokedFalseOrderByCreatedAtDesc(UUID userId);

    /** Lookup by hash for authentication */
    Optional<ApiKey> findByKeyHashAndRevokedFalse(String keyHash);

    /** Count active keys per user — enforce a max (e.g. 10) */
    long countByUserIdAndRevokedFalse(UUID userId);
}