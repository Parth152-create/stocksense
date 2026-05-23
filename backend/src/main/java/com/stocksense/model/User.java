package com.stocksense.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String name;
    private String email;
    private String password;
    private String provider;       // "local" | "google"
    private LocalDateTime createdAt;

    @Column(name = "portfolio_id")
    private UUID portfolioId;

    // ── Notification preferences ──────────────────────────────────────────────
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean prefPriceAlerts = true;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean prefTransactionEmails = true;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean prefMentMessages = true;

    // ── Getters ───────────────────────────────────────────────────────────────
    public UUID getId()                  { return id; }
    public String getName()              { return name; }
    public String getEmail()             { return email; }
    public String getPassword()          { return password; }
    public String getProvider()          { return provider; }
    public LocalDateTime getCreatedAt()  { return createdAt; }
    public UUID getPortfolioId()         { return portfolioId; }

    public boolean isPrefPriceAlerts()       { return prefPriceAlerts; }
    public boolean isPrefTransactionEmails() { return prefTransactionEmails; }
    public boolean isPrefMentMessages()      { return prefMentMessages; }

    // ── Setters ───────────────────────────────────────────────────────────────
    public void setName(String name)                  { this.name = name; }
    public void setEmail(String email)                { this.email = email; }
    public void setPassword(String password)          { this.password = password; }
    public void setProvider(String provider)          { this.provider = provider; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setPortfolioId(UUID portfolioId)      { this.portfolioId = portfolioId; }

    public void setPrefPriceAlerts(boolean prefPriceAlerts)           { this.prefPriceAlerts = prefPriceAlerts; }
    public void setPrefTransactionEmails(boolean prefTransactionEmails){ this.prefTransactionEmails = prefTransactionEmails; }
    public void setPrefMentMessages(boolean prefMentMessages)          { this.prefMentMessages = prefMentMessages; }
}