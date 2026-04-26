package com.stocksense.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class UserResponseDTO {

    private UUID id;
    private String email;
    private String provider;
    private LocalDateTime createdAt;
    private UUID portfolioId;

    public UserResponseDTO(UUID id, String email, String provider,
                           LocalDateTime createdAt, UUID portfolioId) {
        this.id = id;
        this.email = email;
        this.provider = provider;
        this.createdAt = createdAt;
        this.portfolioId = portfolioId;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getProvider() { return provider; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public UUID getPortfolioId() { return portfolioId; }
}