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

    // ── Social / public profile ───────────────────────────────────────────────
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean publicProfile = false;   // opt-in to appear in community

    @Column(unique = true)
    private String username;                 // @handle, e.g. "parth_trades"

    @Column(length = 200)
    private String bio;                      // short bio shown on public profile

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

    public boolean isPublicProfile()     { return publicProfile; }
    public String getUsername()          { return username; }
    public String getBio()               { return bio; }

    // ── Setters ───────────────────────────────────────────────────────────────
    public void setName(String name)                  { this.name = name; }
    public void setEmail(String email)                { this.email = email; }
    public void setPassword(String password)          { this.password = password; }
    public void setProvider(String provider)          { this.provider = provider; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setPortfolioId(UUID portfolioId)      { this.portfolioId = portfolioId; }

    public void setPrefPriceAlerts(boolean v)        { this.prefPriceAlerts = v; }
    public void setPrefTransactionEmails(boolean v)  { this.prefTransactionEmails = v; }
    public void setPrefMentMessages(boolean v)        { this.prefMentMessages = v; }

    public void setPublicProfile(boolean publicProfile) { this.publicProfile = publicProfile; }
    public void setUsername(String username)            { this.username = username; }
    public void setBio(String bio)                      { this.bio = bio; }
}