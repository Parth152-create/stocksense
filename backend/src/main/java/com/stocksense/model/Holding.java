package com.stocksense.model;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "holdings")
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID portfolioId;

    private String symbol;
    private double quantity;
    private double buyPrice;

    @Column(nullable = false, columnDefinition = "VARCHAR(20) DEFAULT 'US'")
    private String market = "US";

    // getters
    public UUID getId()           { return id; }
    public UUID getPortfolioId()  { return portfolioId; }
    public String getSymbol()     { return symbol; }
    public double getQuantity()   { return quantity; }
    public double getBuyPrice()   { return buyPrice; }
    public String getMarket()     { return market; }

    // setters
    public void setPortfolioId(UUID portfolioId) { this.portfolioId = portfolioId; }
    public void setSymbol(String symbol)         { this.symbol = symbol; }
    public void setQuantity(double quantity)     { this.quantity = quantity; }
    public void setBuyPrice(double buyPrice)     { this.buyPrice = buyPrice; }
    public void setMarket(String market)         { this.market = market != null ? market : "US"; }
}