package com.stocksense.dto;

public class StockResponseDTO {

    private String symbol;
    private double price;
    private double change;
    private double changePercent;

    public StockResponseDTO(String symbol, double price, double change, double changePercent) {
        this.symbol = symbol;
        this.price = price;
        this.change = change;
        this.changePercent = changePercent;
    }

    public String getSymbol() { return symbol; }
    public double getPrice() { return price; }
    public double getChange() { return change; }
    public double getChangePercent() { return changePercent; }
}