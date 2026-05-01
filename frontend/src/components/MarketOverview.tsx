"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { useMarket } from "@/lib/MarketContext";

interface MarketStock {
  symbol: string;
  fullSymbol: string;
  price: number;
  change: number;
  changePercent: number;
  market: string;
}

const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

export default function MarketOverview() {
  const { market, formatPrice } = useMarket();
  const router = useRouter();
  const [stocks, setStocks] = useState<MarketStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<string>("");

  const fetchMarket = async (marketId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stocks/market?market=${marketId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setStocks(data);
      setLastFetched(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      // Fall back to static mock so the UI is never empty
      setStocks(getMockStocks(marketId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarket(market.id);
  }, [market.id]);

  const gainers = stocks.filter((s) => s.changePercent >= 0);
  const losers  = stocks.filter((s) => s.changePercent < 0);

  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #1f1f1f",
        borderRadius: 14,
        padding: "20px 24px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
            {market.flag} Market Overview
          </span>
          <span style={{
            marginLeft: 8,
            fontSize: 11,
            color: "#555",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            padding: "2px 8px",
            borderRadius: 5,
          }}>
            {market.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastFetched && (
            <span style={{ color: "#444", fontSize: 11 }}>Updated {lastFetched}</span>
          )}
          <button
            onClick={() => fetchMarket(market.id)}
            disabled={loading}
            style={{
              background: "none",
              border: "1px solid #1f1f1f",
              borderRadius: 7,
              padding: "4px 8px",
              cursor: loading ? "not-allowed" : "pointer",
              color: "#555",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
            }}
          >
            <RefreshCw size={11} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stock rows */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              height: 52,
              background: "#1a1a1a",
              borderRadius: 10,
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
        </div>
      ) : stocks.length === 0 ? (
        <p style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
          API limit reached — try again in a few minutes
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {stocks.map((stock) => {
            const isUp = stock.changePercent >= 0;
            const ticker = stock.symbol.replace(".BSE", "").replace("FX_", "");

            return (
              <div
                key={stock.symbol}
                onClick={() => router.push(`/dashboard/stock/${encodeURIComponent(stock.fullSymbol || stock.symbol)}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  background: "transparent",
                  border: "1px solid transparent",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "#161616";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#1f1f1f";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
                }}
              >
                {/* Symbol badge */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: isUp ? "rgba(143,255,214,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${isUp ? "rgba(143,255,214,0.15)" : "rgba(239,68,68,0.15)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: isUp ? "#8FFFD6" : "#ef4444",
                  flexShrink: 0,
                }}>
                  {ticker.slice(0, 3)}
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {ticker}
                  </p>
                  <p style={{ color: "#555", fontSize: 11, margin: "2px 0 0" }}>
                    {market.label}
                  </p>
                </div>

                {/* Trend icon */}
                {isUp
                  ? <TrendingUp size={14} color="#8FFFD6" />
                  : <TrendingDown size={14} color="#ef4444" />}

                {/* Price + change */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {market.id === "FX"
                      ? stock.price.toFixed(4)
                      : formatPrice(stock.price)}
                  </p>
                  <p style={{
                    color: isUp ? "#8FFFD6" : "#ef4444",
                    fontSize: 11,
                    margin: "2px 0 0",
                    fontWeight: 500,
                  }}>
                    {isUp ? "+" : ""}{stock.changePercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary pills */}
      {!loading && stocks.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid #1a1a1a" }}>
          <div style={{
            flex: 1, textAlign: "center",
            background: "rgba(143,255,214,0.05)",
            border: "1px solid rgba(143,255,214,0.12)",
            borderRadius: 8, padding: "8px 0",
          }}>
            <p style={{ color: "#8FFFD6", fontSize: 16, fontWeight: 700, margin: 0 }}>{gainers.length}</p>
            <p style={{ color: "#555", fontSize: 10, margin: "2px 0 0" }}>Gainers</p>
          </div>
          <div style={{
            flex: 1, textAlign: "center",
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.12)",
            borderRadius: 8, padding: "8px 0",
          }}>
            <p style={{ color: "#ef4444", fontSize: 16, fontWeight: 700, margin: 0 }}>{losers.length}</p>
            <p style={{ color: "#555", fontSize: 10, margin: "2px 0 0" }}>Losers</p>
          </div>
          <div style={{
            flex: 1, textAlign: "center",
            background: "#161616",
            border: "1px solid #1f1f1f",
            borderRadius: 8, padding: "8px 0",
          }}>
            <p style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: 0 }}>{stocks.length}</p>
            <p style={{ color: "#555", fontSize: 10, margin: "2px 0 0" }}>Tracked</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ── Static fallback so UI is never blank when API is rate-limited ──────────────
function getMockStocks(market: string): MarketStock[] {
  const maps: Record<string, MarketStock[]> = {
    IN: [
      { symbol: "RELIANCE", fullSymbol: "RELIANCE.BSE", price: 2847.65, change: 16.45,  changePercent: 0.58,  market: "IN" },
      { symbol: "TCS",      fullSymbol: "TCS.BSE",      price: 3921.10, change: -23.80, changePercent: -0.60, market: "IN" },
      { symbol: "INFY",     fullSymbol: "INFY.BSE",     price: 1456.25, change: 8.90,   changePercent: 0.61,  market: "IN" },
      { symbol: "HDFCBANK", fullSymbol: "HDFCBANK.BSE", price: 1678.40, change: -12.30, changePercent: -0.73, market: "IN" },
      { symbol: "ICICIBANK",fullSymbol: "ICICIBANK.BSE",price: 1134.75, change: 5.60,   changePercent: 0.50,  market: "IN" },
    ],
    US: [
      { symbol: "AAPL",  fullSymbol: "AAPL",  price: 189.30, change: 2.10,  changePercent: 1.12,  market: "US" },
      { symbol: "MSFT",  fullSymbol: "MSFT",  price: 378.85, change: -3.45, changePercent: -0.90, market: "US" },
      { symbol: "GOOGL", fullSymbol: "GOOGL", price: 141.20, change: 1.80,  changePercent: 1.29,  market: "US" },
      { symbol: "AMZN",  fullSymbol: "AMZN",  price: 178.50, change: -0.90, changePercent: -0.50, market: "US" },
      { symbol: "NVDA",  fullSymbol: "NVDA",  price: 495.60, change: 12.30, changePercent: 2.55,  market: "US" },
    ],
    FX: [
      { symbol: "EURUSD", fullSymbol: "FX_EURUSD", price: 1.0842, change: 0.0012,  changePercent: 0.11,  market: "FX" },
      { symbol: "GBPUSD", fullSymbol: "FX_GBPUSD", price: 1.2634, change: -0.0023, changePercent: -0.18, market: "FX" },
      { symbol: "USDJPY", fullSymbol: "FX_USDJPY", price: 153.42, change: 0.28,    changePercent: 0.18,  market: "FX" },
      { symbol: "AUDUSD", fullSymbol: "FX_AUDUSD", price: 0.6521, change: -0.0008, changePercent: -0.12, market: "FX" },
      { symbol: "USDCAD", fullSymbol: "FX_USDCAD", price: 1.3612, change: 0.0015,  changePercent: 0.11,  market: "FX" },
    ],
  };
  return maps[market] ?? maps["IN"];
}