package com.stocksense.model;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "portfolios")
public class Portfolio {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;

    private String name;

    // getters
    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getName() { return name; }

    // setters
    public void setUserId(UUID userId) { this.userId = userId; }
    public void setName(String name) { this.name = name; }
}