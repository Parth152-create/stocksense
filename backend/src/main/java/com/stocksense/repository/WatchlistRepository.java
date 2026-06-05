package com.stocksense.repository;

import com.stocksense.model.WatchlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface WatchlistRepository extends JpaRepository<WatchlistItem, UUID> {

    List<WatchlistItem> findByUserId(UUID userId);

    void deleteByUserId(UUID userId);

    @Query("SELECT w FROM WatchlistItem w WHERE w.alertPrice IS NOT NULL")
    List<WatchlistItem> findAllWithAlertPrice();

    // All items that carry a given share token (may belong to one user)
    List<WatchlistItem> findByShareToken(String shareToken);

    // Bulk-update share token + shared flag for all of a user's items
    @Modifying
    @Query("UPDATE WatchlistItem w SET w.shareToken = :token, w.shared = :shared WHERE w.userId = :userId")
    void updateShareTokenForUser(@Param("userId") UUID userId,
                                 @Param("token")  String token,
                                 @Param("shared") boolean shared);
}
