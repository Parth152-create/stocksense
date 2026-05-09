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

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getSymbol() {
        return symbol;
    }

    public BigDecimal getAlertPrice() {
        return alertPrice;
    }

    public BigDecimal getLastCheckedPrice() {
        return lastCheckedPrice;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    public void setAlertPrice(BigDecimal alertPrice) {
        this.alertPrice = alertPrice;
    }

    public void setLastCheckedPrice(BigDecimal lastCheckedPrice) {
        this.lastCheckedPrice = lastCheckedPrice;
    }
}
