package com.stocksense.repository;

import com.stocksense.model.WatchlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WatchlistRepository extends JpaRepository<WatchlistItem, UUID> {

    List<WatchlistItem> findByUserId(UUID userId);

    Optional<WatchlistItem> findByUserIdAndSymbol(UUID userId, String symbol);

    @Query("SELECT w FROM WatchlistItem w WHERE w.alertPrice IS NOT NULL")
    List<WatchlistItem> findAllWithAlertPrice();

    // ── used by UserService.deleteUser() ─────────────────────────────────────
    void deleteByUserId(UUID userId);
}