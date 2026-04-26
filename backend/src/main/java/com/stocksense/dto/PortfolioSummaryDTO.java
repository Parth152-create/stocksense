package com.stocksense.dto;

public class PortfolioSummaryDTO {

    private double investment;
    private double currentValue;
    private double profit;

    public PortfolioSummaryDTO(double investment, double currentValue, double profit) {
        this.investment = investment;
        this.currentValue = currentValue;
        this.profit = profit;
    }

    public double getInvestment() {
        return investment;
    }

    public double getCurrentValue() {
        return currentValue;
    }

    public double getProfit() {
        return profit;
    }
}