"use client";

import { useState, useEffect } from "react";
import { Market } from "@/lib/MarketContext";
import { Skeleton } from "@/components/ui/skeleton";

interface StockInsightsPanelProps {
  symbol: string;
  market: Market;
}

interface MlData {
  sentiment: { score: number; label: string; article_count: number; positive: number; negative: number; neutral: number };
  prediction: { current_price: number; next_day: number; next_week: number; next_day_change_pct: number; next_week_change_pct: number; rsi: number; momentum_5d: number; confidence: number };
  signal: { signal: string; signal_color: string; strength: number; reasoning: string; composite_score: number; components: Record<string, number> };
  anomaly: { is_anomaly: boolean; severity: string; summary: string; z_scores: Record<string, number> };
}

export default function StockInsightsPanel({ symbol }: StockInsightsPanelProps) {
  const [data, setData] = useState<MlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(false);
    fetch(`http://localhost:8082/ml/full/${symbol}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  if (loading) return (
    <div style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px 24px", marginTop: 16 }}>
      <Skeleton className="h-4 w-40 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );

  if (error || !data) return (
    <div style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px 24px", marginTop: 16 }}>
      <p style={{ color: "#555", fontSize: 12, margin: 0 }}>ML service unavailable — start with: <code style={{ color: "#8FFFD6" }}>uvicorn main:app --port 8082</code></p>
    </div>
  );

  const { sentiment, prediction, signal, anomaly } = data;
  const signalCol = signal.signal === "BUY" ? "#22c55e" : signal.signal === "SELL" ? "#ef4444" : "#f59e0b";
  const sentCol = sentiment.score > 0.1 ? "#22c55e" : sentiment.score < -0.1 ? "#ef4444" : "#f59e0b";

  return (
    <div style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px 24px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: 0 }}>AI Insights</p>
        <span style={{ fontSize: 10, padding: "2px 8px", background: "#8FFFD611", border: "1px solid #8FFFD633", borderRadius: 99, color: "#8FFFD6", fontWeight: 600 }}>LIVE ML</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Signal */}
        <div style={{ background: "#0d0d0d", border: `1px solid ${signalCol}33`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px" }}>Signal</p>
            <p style={{ color: signalCol, fontWeight: 800, fontSize: 20, margin: 0 }}>{signal.signal}</p>
            <p style={{ color: "#666", fontSize: 11, margin: "4px 0 0", lineHeight: 1.4, maxWidth: 220 }}>{signal.reasoning.slice(0, 100)}…</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="30" cy="30" r="24" fill="none" stroke="#1f1f1f" strokeWidth="4" />
              <circle cx="30" cy="30" r="24" fill="none" stroke={signalCol} strokeWidth="4"
                strokeDasharray={2 * Math.PI * 24}
                strokeDashoffset={2 * Math.PI * 24 * (1 - signal.strength / 100)}
                strokeLinecap="round" />
            </svg>
            <p style={{ color: signalCol, fontWeight: 700, fontSize: 13, marginTop: -42, position: "relative", zIndex: 1 }}>{signal.strength}%</p>
          </div>
        </div>

        {/* Prediction */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>Price Prediction</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Current", value: `$${prediction.current_price.toFixed(2)}`, color: "#fff" },
              { label: "Next Day", value: `$${prediction.next_day.toFixed(2)}`, color: prediction.next_day_change_pct >= 0 ? "#22c55e" : "#ef4444", sub: `${prediction.next_day_change_pct >= 0 ? "+" : ""}${prediction.next_day_change_pct}%` },
              { label: "Next Week", value: `$${prediction.next_week.toFixed(2)}`, color: prediction.next_week_change_pct >= 0 ? "#22c55e" : "#ef4444", sub: `${prediction.next_week_change_pct >= 0 ? "+" : ""}${prediction.next_week_change_pct}%` },
            ].map(({ label, value, color, sub }) => (
              <div key={label} style={{ textAlign: "center", padding: "8px", background: "#111", borderRadius: 8 }}>
                <p style={{ color: "#555", fontSize: 9, textTransform: "uppercase", margin: "0 0 4px" }}>{label}</p>
                <p style={{ color, fontWeight: 700, fontSize: 13, margin: 0 }}>{value}</p>
                {sub && <p style={{ color, fontSize: 10, margin: "2px 0 0" }}>{sub}</p>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
            <div style={{ flex: 1, background: "#111", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ color: "#555", fontSize: 9, margin: "0 0 2px" }}>RSI</p>
              <p style={{ color: prediction.rsi > 70 ? "#ef4444" : prediction.rsi < 30 ? "#22c55e" : "#fff", fontWeight: 600, fontSize: 13, margin: 0 }}>{prediction.rsi}</p>
            </div>
            <div style={{ flex: 1, background: "#111", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ color: "#555", fontSize: 9, margin: "0 0 2px" }}>5d Momentum</p>
              <p style={{ color: prediction.momentum_5d >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600, fontSize: 13, margin: 0 }}>{prediction.momentum_5d >= 0 ? "+" : ""}{prediction.momentum_5d}%</p>
            </div>
            <div style={{ flex: 1, background: "#111", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ color: "#555", fontSize: 9, margin: "0 0 2px" }}>Confidence</p>
              <p style={{ color: "#8FFFD6", fontWeight: 600, fontSize: 13, margin: 0 }}>{prediction.confidence}%</p>
            </div>
          </div>
        </div>

        {/* Sentiment */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>News Sentiment</p>
            <span style={{ color: sentCol, fontWeight: 600, fontSize: 12 }}>{sentiment.label}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Positive", value: sentiment.positive, color: "#22c55e" },
              { label: "Neutral",  value: sentiment.neutral,  color: "#f59e0b" },
              { label: "Negative", value: sentiment.negative, color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#555", fontSize: 9 }}>{label}</span>
                  <span style={{ color, fontSize: 9, fontWeight: 600 }}>{Math.round(value * 100)}%</span>
                </div>
                <div style={{ height: 4, background: "#1f1f1f", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${value * 100}%`, background: color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: "#444", fontSize: 10, margin: "8px 0 0" }}>{sentiment.article_count} articles analysed</p>
        </div>

        {/* Anomaly */}
        {anomaly.is_anomaly && (
          <div style={{ background: "#f59e0b0a", border: "1px solid #f59e0b33", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <div>
              <p style={{ color: "#f59e0b", fontWeight: 600, fontSize: 12, margin: "0 0 2px" }}>Anomaly Detected — {anomaly.severity.toUpperCase()}</p>
              <p style={{ color: "#888", fontSize: 11, margin: 0 }}>{anomaly.summary}</p>
            </div>
          </div>
        )}
        {!anomaly.is_anomaly && (
          <div style={{ background: "#22c55e0a", border: "1px solid #22c55e22", borderRadius: 12, padding: "10px 16px", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>✓</span>
            <p style={{ color: "#22c55e", fontSize: 11, margin: 0 }}>No anomalies detected — trading within normal parameters</p>
          </div>
        )}
      </div>
    </div>
  );
}