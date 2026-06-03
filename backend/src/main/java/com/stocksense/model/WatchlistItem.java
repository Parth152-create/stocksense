package com.stocksense.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "watchlist_items")
public class WatchlistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;

    private String symbol;

    @Column(precision = 19, scale = 4)
    private BigDecimal alertPrice;

    @Column(precision = 19, scale = 4)
    private BigDecimal lastCheckedPrice;

    // ── Shared watchlist ──────────────────────────────────────────────────────
    // shareToken: a random UUID string generated when the user first shares
    //             their watchlist. Stored on every item belonging to that user
    //             so a single token resolves all their symbols.
    // shared:     true  = this user's watchlist is publicly accessible via token
    //             false = private (default)
    @Column(unique = false)          // same token on all rows for one user — not unique per row
    private String shareToken;

    @Column(nullable = false)
    private boolean shared = false;

    // ── Getters ───────────────────────────────────────────────────────────────

    public UUID getId()                         { return id; }
    public UUID getUserId()                     { return userId; }
    public String getSymbol()                   { return symbol; }
    public BigDecimal getAlertPrice()           { return alertPrice; }
    public BigDecimal getLastCheckedPrice()     { return lastCheckedPrice; }
    public String getShareToken()               { return shareToken; }
    public boolean isShared()                   { return shared; }

    // ── Setters ───────────────────────────────────────────────────────────────

    public void setUserId(UUID userId)                      { this.userId = userId; }
    public void setSymbol(String symbol)                    { this.symbol = symbol; }
    public void setAlertPrice(BigDecimal alertPrice)        { this.alertPrice = alertPrice; }
    public void setLastCheckedPrice(BigDecimal v)           { this.lastCheckedPrice = v; }
    public void setShareToken(String shareToken)            { this.shareToken = shareToken; }
    public void setShared(boolean shared)                   { this.shared = shared; }
}