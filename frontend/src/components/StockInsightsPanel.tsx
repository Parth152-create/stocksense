"use client";

import { Market } from "@/lib/MarketContext";

interface StockInsightsPanelProps {
  symbol: string;
  market: Market;
}

export default function StockInsightsPanel({ symbol, market }: StockInsightsPanelProps) {
  return (
    <div style={{
      background: "#111111",
      border: "1px solid #1f1f1f",
      borderRadius: 16,
      padding: "22px 24px",
      marginTop: 16,
    }}>
      <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: "0 0 16px" }}>
        Insights & Analysis
      </p>
      <p style={{ color: "#555", fontSize: 12, margin: 0 }}>
        AI insights for {symbol} coming soon...
      </p>
    </div>
  );
}
