"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "@/lib/auth";
import {
  TrendingUp, TrendingDown, Minus, Zap, Brain,
  AlertTriangle, Activity, Target, BarChart2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MLSentiment {
  score: number; label: string; article_count: number;
  positive: number; negative: number; neutral: number;
}
interface MLPrediction {
  current_price: number; next_day: number; next_day_change_pct: number;
  next_week: number; next_week_change_pct: number;
  rsi: number; momentum_5d: number; confidence: number; mock: boolean;
}
interface MLSignal {
  signal: "BUY" | "SELL" | "HOLD"; signal_color: string;
  composite_score: number; strength: number; reasoning: string;
  components: { sentiment: number; momentum: number; rsi: number; trend: number };
}
interface MLAnomaly {
  is_anomaly: boolean; severity: "normal" | "medium" | "high";
  summary: string; z_scores: { price: number; volume: number; range: number };
  anomalies: string[];
}
interface MLFull {
  symbol: string;
  sentiment: MLSentiment;
  prediction: MLPrediction;
  signal: MLSignal;
  anomaly: MLAnomaly;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT = "#8FFFD6";
const BULL   = "#22c55e";
const BEAR   = "#ef4444";
const WARN   = "#f59e0b";

function ring(pct: number, color: string, size = 52, stroke = 5) {
  const r   = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--color-line)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(Math.abs(value) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 64, fontSize: 10, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: "var(--color-line)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ width: 28, fontSize: 10, fontWeight: 700, color, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function Skeleton({ w, h = 12 }: { w: string | number; h?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 4,
      background: "var(--color-line)", animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

// ─── Main ML Panel ────────────────────────────────────────────────────────────

export function MLInsightsPanel({ symbol }: { symbol: string }) {
  const [data,    setData]    = useState<MLFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch(`http://localhost:8082/ml/full/${symbol.toUpperCase()}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { void load(); }, [load]);

  if (error) return null; // fail silently — don't break stock page

  const signal     = data?.signal;
  const sentiment  = data?.sentiment;
  const prediction = data?.prediction;
  const anomaly    = data?.anomaly;

  const signalColor = signal?.signal === "BUY" ? BULL
    : signal?.signal === "SELL" ? BEAR : WARN;

  const sentimentColor = (sentiment?.score ?? 0) >= 0.15 ? BULL
    : (sentiment?.score ?? 0) <= -0.15 ? BEAR : WARN;

  return (
    <div style={{
      marginTop: 12,
      border: "1px solid var(--color-line)",
      borderRadius: 12,
      overflow: "hidden",
      background: "var(--color-card)",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--color-line)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Brain size={14} color={ACCENT} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>
          ML Insights
        </span>
        {data?.prediction?.mock && (
          <span style={{
            fontSize: 9, fontWeight: 600, color: "var(--color-muted)",
            background: "var(--color-line)", borderRadius: 4,
            padding: "2px 6px", marginLeft: "auto", textTransform: "uppercase",
          }}>mock data</span>
        )}
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── Signal ───────────────────────────────────────────────────────── */}
        <div style={{
          background: "var(--color-page)", borderRadius: 10,
          padding: "12px 14px", border: `1px solid ${signalColor}22`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Zap size={12} color={signalColor} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                Signal
              </span>
            </div>
            {loading ? <Skeleton w={48} h={20} /> : (
              <span style={{
                fontSize: 13, fontWeight: 800, color: signalColor,
                background: signalColor + "18", borderRadius: 6,
                padding: "3px 10px", letterSpacing: 0.5,
              }}>
                {signal?.signal}
              </span>
            )}
          </div>

          {/* Strength ring + components */}
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton w="100%" h={10} /><Skeleton w="80%" h={10} />
            </div>
          ) : signal && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                {ring(signal.strength, signalColor)}
                <div style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800, color: signalColor,
                }}>
                  {Math.round(signal.strength)}
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <MiniBar label="Sentiment" value={Math.abs(signal.components.sentiment)}
                  color={signal.components.sentiment >= 0 ? BULL : BEAR} />
                <MiniBar label="Momentum"  value={Math.abs(signal.components.momentum)}
                  color={signal.components.momentum >= 0 ? BULL : BEAR} />
                <MiniBar label="RSI"       value={Math.abs(signal.components.rsi)}
                  color={signal.components.rsi >= 0 ? BULL : BEAR} />
                <MiniBar label="Trend"     value={Math.abs(signal.components.trend)}
                  color={signal.components.trend >= 0 ? BULL : BEAR} />
              </div>
            </div>
          )}

          {/* Reasoning */}
          {!loading && signal?.reasoning && (
            <p style={{
              margin: "10px 0 0", fontSize: 11, color: "var(--color-muted)",
              lineHeight: 1.6, borderTop: "1px solid var(--color-line)", paddingTop: 8,
            }}>
              {signal.reasoning}
            </p>
          )}
        </div>

        {/* ── Sentiment ────────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Activity size={12} color="var(--color-muted)" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
              News Sentiment
            </span>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton w="60%" /><Skeleton w="100%" h={8} />
            </div>
          ) : sentiment && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: sentimentColor }}>
                  {sentiment.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
                  {sentiment.article_count} articles
                </span>
              </div>
              {/* Sentiment bar */}
              <div style={{ height: 6, background: "var(--color-line)", borderRadius: 3, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${sentiment.negative * 100}%`, background: BEAR, transition: "width 0.6s" }} />
                <div style={{ width: `${sentiment.neutral * 100}%`, background: "var(--color-line)" }} />
                <div style={{ width: `${sentiment.positive * 100}%`, background: BULL, transition: "width 0.6s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9, color: BEAR }}>{Math.round(sentiment.negative * 100)}% neg</span>
                <span style={{ fontSize: 9, color: "var(--color-muted)" }}>{Math.round(sentiment.neutral * 100)}% neu</span>
                <span style={{ fontSize: 9, color: BULL }}>{Math.round(sentiment.positive * 100)}% pos</span>
              </div>
            </>
          )}
        </div>

        {/* ── Prediction ───────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Target size={12} color="var(--color-muted)" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Price Forecast
            </span>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton w="80%" /><Skeleton w="60%" />
            </div>
          ) : prediction && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Tomorrow", price: prediction.next_day, pct: prediction.next_day_change_pct },
                { label: "Next Week", price: prediction.next_week, pct: prediction.next_week_change_pct },
              ].map(({ label, price, pct }) => {
                const up = pct >= 0;
                return (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 10px", borderRadius: 8,
                    background: "var(--color-page)", border: "1px solid var(--color-line)",
                  }}>
                    <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>
                        {price.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: up ? BULL : BEAR,
                        display: "flex", alignItems: "center", gap: 2 }}>
                        {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {up ? "+" : ""}{pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {/* RSI + Confidence */}
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <div style={{
                  flex: 1, padding: "6px 10px", borderRadius: 8,
                  background: "var(--color-page)", border: "1px solid var(--color-line)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>RSI</div>
                  <div style={{ fontSize: 13, fontWeight: 800,
                    color: prediction.rsi < 30 ? BULL : prediction.rsi > 70 ? BEAR : "var(--color-primary)" }}>
                    {prediction.rsi}
                  </div>
                </div>
                <div style={{
                  flex: 1, padding: "6px 10px", borderRadius: 8,
                  background: "var(--color-page)", border: "1px solid var(--color-line)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Confidence</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>
                    {prediction.confidence}%
                  </div>
                </div>
                <div style={{
                  flex: 1, padding: "6px 10px", borderRadius: 8,
                  background: "var(--color-page)", border: "1px solid var(--color-line)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>5d Mom</div>
                  <div style={{ fontSize: 13, fontWeight: 800,
                    color: prediction.momentum_5d >= 0 ? BULL : BEAR }}>
                    {prediction.momentum_5d > 0 ? "+" : ""}{prediction.momentum_5d.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Anomaly ──────────────────────────────────────────────────────── */}
        {!loading && anomaly && (
          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: anomaly.is_anomaly ? WARN + "10" : "var(--color-page)",
            border: `1px solid ${anomaly.is_anomaly
              ? anomaly.severity === "high" ? BEAR + "44" : WARN + "44"
              : "var(--color-line)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: anomaly.is_anomaly ? 6 : 0 }}>
              <AlertTriangle size={11}
                color={anomaly.is_anomaly
                  ? anomaly.severity === "high" ? BEAR : WARN
                  : "var(--color-muted)"} />
              <span style={{ fontSize: 10, fontWeight: 700,
                color: anomaly.is_anomaly
                  ? anomaly.severity === "high" ? BEAR : WARN
                  : "var(--color-muted)",
                textTransform: "uppercase", letterSpacing: 0.6 }}>
                {anomaly.is_anomaly ? `Anomaly · ${anomaly.severity}` : "No Anomaly"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)", lineHeight: 1.5 }}>
              {anomaly.summary}
            </p>
          </div>
        )}

        {/* Footer */}
        <p style={{ margin: 0, fontSize: 9, color: "var(--color-muted)", textAlign: "center", lineHeight: 1.5 }}>
          ML signals are for informational purposes only. Not financial advice.
        </p>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}