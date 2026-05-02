package com.stocksense.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@SuppressWarnings("JpaDataSourceORMInspection")
public class Notification {

    public enum Type {
        PRICE_ALERT, ORDER_FILLED, EARNINGS, ANOMALY
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;

    @Enumerated(EnumType.STRING)
    private Type type;

    private String title;
    private String message;
    private String symbol;       // e.g. "AAPL" — nullable
    private boolean read;
    private LocalDateTime createdAt;

    // CONSTRUCTORS
    public Notification() {
    }

    public Notification(UUID userId, Type type, String title, String message, String symbol) {
        this.userId = userId;
        this.type = type;
        this.title = title;
        this.message = message;
        this.symbol = symbol;
        this.read = false;
        this.createdAt = LocalDateTime.now();
    }

    // GETTERS
    public UUID getId()              { return id; }
    public UUID getUserId()          { return userId; }
    public Type getType()            { return type; }
    public String getTitle()         { return title; }
    public String getMessage()       { return message; }
    public String getSymbol()        { return symbol; }
    public boolean isRead()          { return read; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    // SETTERS
    public void setUserId(UUID userId)          { this.userId = userId; }
    public void setType(Type type)              { this.type = type; }
    public void setTitle(String title)          { this.title = title; }
    public void setMessage(String message)      { this.message = message; }
    public void setSymbol(String symbol)        { this.symbol = symbol; }
    public void setRead(boolean read)           { this.read = read; }
    public void setCreatedAt(LocalDateTime t)   { this.createdAt = t; }
}