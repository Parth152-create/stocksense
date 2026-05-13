package com.stocksense.repository;

import com.stocksense.model.WatchlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WatchlistRepository extends JpaRepository<WatchlistItem, UUID> {

    // Used by WatchlistController
    List<WatchlistItem> findByUserId(UUID userId);

    // Used by WatchlistController to find specific item for deletion
    Optional<WatchlistItem> findByUserIdAndSymbol(UUID userId, String symbol);

    // Used by PriceAlertJob
    @Query("SELECT w FROM WatchlistItem w WHERE w.alertPrice IS NOT NULL")
    List<WatchlistItem> findAllWithAlertPrice();
}