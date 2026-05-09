package com.stocksense.repository;

import com.stocksense.model.WatchlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface WatchlistRepository extends JpaRepository<WatchlistItem, UUID> {

    @Query("SELECT w FROM WatchlistItem w WHERE w.alertPrice IS NOT NULL")
    List<WatchlistItem> findAllWithAlertPrice();
}
