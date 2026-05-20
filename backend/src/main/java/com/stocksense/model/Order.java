package com.stocksense.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String symbol;

    @Column(nullable = false)
    private String market;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderType type; // BUY, SELL

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderKind kind; // MARKET, LIMIT, STOP_LOSS

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, precision = 20, scale = 4)
    private BigDecimal price;

    @Column(nullable = false, precision = 20, scale = 4)
    private BigDecimal total;

    // For LIMIT / STOP_LOSS orders — the trigger price
    @Column(precision = 20, scale = 4)
    private BigDecimal limitPrice;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime triggeredAt;

    @Column
    private String status; // EXECUTED, PENDING, CANCELLED

    public enum OrderType { BUY, SELL }
    public enum OrderKind { MARKET, LIMIT, STOP_LOSS }

    // Getters and setters
    public Long getId()                        { return id; }
    public void setId(Long id)                 { this.id = id; }

    public String getUserId()                  { return userId; }
    public void setUserId(String userId)       { this.userId = userId; }

    public String getSymbol()                  { return symbol; }
    public void setSymbol(String symbol)       { this.symbol = symbol; }

    public String getMarket()                  { return market; }
    public void setMarket(String market)       { this.market = market; }

    public OrderType getType()                 { return type; }
    public void setType(OrderType type)        { this.type = type; }

    public OrderKind getKind()                 { return kind; }
    public void setKind(OrderKind kind)        { this.kind = kind; }

    public Integer getQuantity()               { return quantity; }
    public void setQuantity(Integer quantity)  { this.quantity = quantity; }

    public BigDecimal getPrice()               { return price; }
    public void setPrice(BigDecimal price)     { this.price = price; }

    public BigDecimal getTotal()               { return total; }
    public void setTotal(BigDecimal total)     { this.total = total; }

    public BigDecimal getLimitPrice()                    { return limitPrice; }
    public void setLimitPrice(BigDecimal limitPrice)     { this.limitPrice = limitPrice; }

    public LocalDateTime getCreatedAt()                  { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt)    { this.createdAt = createdAt; }

    public LocalDateTime getTriggeredAt()                { return triggeredAt; }
    public void setTriggeredAt(LocalDateTime triggeredAt){ this.triggeredAt = triggeredAt; }

    public String getStatus()                  { return status; }
    public void setStatus(String status)       { this.status = status; }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) status = "EXECUTED";
        if (kind   == null) kind   = OrderKind.MARKET;
    }
}