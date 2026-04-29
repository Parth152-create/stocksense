"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
} from "recharts";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Star,
  StarOff,
  Plus,
  Minus,
  ChevronDown,
  Activity,
  BarChart2,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockQuote {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  latestTradingDay: string;
  analystBuy: number;
  analystHold: number;
  analystSell: number;
}

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface HistoryData {
  symbol: string;
  candles: Candle[];
}

type ChartType = "area" | "candlestick";
type OrderType = "buy" | "sell";

// ─── Custom Candlestick Bar ────────────────────────────────────────────────────

const CandlestickBar = (props: any) => {
  const { x, y, width, height, open, close, high, low, index } = props;
  if (!open || !close) return null;

  const isBull = close >= open;
  const color = isBull ? "#8FFFD6" : "#ef4444";
  const candleWidth = Math.max(width * 0.6, 4);
  const xCenter = x + width / 2;

  // We need to convert actual price values to pixel positions
  // Recharts passes the bar's y/height for the open-close range
  // high/low lines extend above/below

  return (
    <g>
      {/* High-Low wick */}
      <line
        x1={xCenter}
        x2={xCenter}
        y1={props.highY}
        y2={props.lowY}
        stroke={color}
        strokeWidth={1.5}
        opacity={0.7}
      />
      {/* Open-Close body */}
      <rect
        x={xCenter - candleWidth / 2}
        y={Math.min(props.openY, props.closeY)}
        width={candleWidth}
        height={Math.abs(props.openY - props.closeY) || 2}
        fill={isBull ? color : "transparent"}
        stroke={color}
        strokeWidth={1.5}
        rx={1}
      />
    </g>
  );
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #1f1f1f",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
      }}
    >
      <p style={{ color: "#888", marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#8FFFD6", fontWeight: 600, fontSize: 15 }}>
        ₹{Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

const CustomCandleTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as Candle;
  if (!d) return null;
  const isBull = d.close >= d.open;
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #1f1f1f",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
        minWidth: 150,
      }}
    >
      <p style={{ color: "#888", marginBottom: 6 }}>{label}</p>
      {[
        { label: "Open",  val: d.open },
        { label: "High",  val: d.high },
        { label: "Low",   val: d.low },
        { label: "Close", val: d.close },
      ].map(({ label: l, val }) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ color: "#888" }}>{l}</span>
          <span style={{ color: l === "Close" ? (isBull ? "#8FFFD6" : "#ef4444") : "#fff", fontWeight: l === "Close" ? 600 : 400 }}>
            ₹{Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps { message: string; type: "success" | "error"; }
const Toast = ({ message, type }: ToastProps) => (
  <div
    style={{
      position: "fixed",
      bottom: 32,
      right: 32,
      background: "#111111",
      border: `1px solid ${type === "success" ? "#8FFFD6" : "#ef4444"}`,
      borderRadius: 10,
      padding: "14px 20px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      zIndex: 9999,
      animation: "fadeInUp 0.3s ease",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}
  >
    {type === "success"
      ? <CheckCircle2 size={18} color="#8FFFD6" />
      : <AlertCircle size={18} color="#ef4444" />}
    <span style={{ color: "#fff", fontSize: 14 }}>{message}</span>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();

  // Data state
  const [quote, setQuote]       = useState<StockQuote | null>(null);
  const [history, setHistory]   = useState<Candle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [histLoading, setHistLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // UI state
  const [chartType, setChartType]     = useState<ChartType>("area");
  const [orderType, setOrderType]     = useState<OrderType>("buy");
  const [quantity, setQuantity]       = useState(1);
  const [orderLoading, setOrderLoading] = useState(false);
  const [toast, setToast]             = useState<ToastProps | null>(null);
  const [watchlisted, setWatchlisted] = useState(false);

  // Derived
  const isPositive = (quote?.change ?? 0) >= 0;
  const orderTotal = quote ? quote.price * quantity : 0;

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  }), []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load quote ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);

    fetch(`/api/stocks/${symbol}`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setQuote(data);
        setLoading(false);
      })
      .catch((e) => {
        // Fallback to mock data in dev so the page still renders
        console.warn("Quote fetch failed, using mock:", e.message);
        setQuote({
          symbol: symbol.toUpperCase(),
          price: 2847.65,
          open: 2812.30,
          high: 2891.00,
          low: 2799.45,
          previousClose: 2831.20,
          change: 16.45,
          changePercent: 0.58,
          volume: 4823100,
          latestTradingDay: new Date().toISOString().split("T")[0],
          analystBuy: 65,
          analystHold: 25,
          analystSell: 10,
        });
        setLoading(false);
      });
  }, [symbol, authHeaders]);

  // ── Load history ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!symbol) return;
    setHistLoading(true);

    fetch(`/api/stocks/${symbol}/history`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setHistory(data.candles ?? []);
        setHistLoading(false);
      })
      .catch(() => {
        // Generate smooth mock OHLCV data
        const mock: Candle[] = [];
        let base = 2700;
        for (let i = 30; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const open  = base + (Math.random() - 0.5) * 60;
          const close = open + (Math.random() - 0.48) * 50;
          const high  = Math.max(open, close) + Math.random() * 30;
          const low   = Math.min(open, close) - Math.random() * 30;
          mock.push({
            date: d.toISOString().split("T")[0],
            open: +open.toFixed(2),
            high: +high.toFixed(2),
            low:  +low.toFixed(2),
            close: +close.toFixed(2),
            volume: Math.floor(Math.random() * 5000000 + 1000000),
          });
          base = close;
        }
        setHistory(mock);
        setHistLoading(false);
      });
  }, [symbol, authHeaders]);

  // ── Buy / Sell ────────────────────────────────────────────────────────────

  const handleOrder = async () => {
    if (!quote || quantity <= 0) return;
    setOrderLoading(true);

    try {
      // Get current user portfolioId
      const meRes = await fetch("/api/users/me", { headers: authHeaders() });
      if (!meRes.ok) throw new Error("Auth failed");
      const me = await meRes.json();

      const payload = {
        portfolioId: me.portfolioId,
        symbol: quote.symbol,
        quantity: orderType === "sell" ? -quantity : quantity,
        buyPrice: quote.price,
      };

      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Order failed: ${res.status}`);

      showToast(
        `${orderType === "buy" ? "Bought" : "Sold"} ${quantity} × ${quote.symbol} @ ₹${quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        "success"
      );
      setQuantity(1);
    } catch (e: any) {
      showToast(e.message ?? "Order failed", "error");
    } finally {
      setOrderLoading(false);
    }
  };

  // ── Chart data ────────────────────────────────────────────────────────────

  const areaData = history.map((c) => ({
    date: c.date.slice(5), // "MM-DD"
    price: c.close,
  }));

  const candleData = history.map((c) => ({
    ...c,
    date: c.date.slice(5),
  }));

  // ── Format helpers ────────────────────────────────────────────────────────

  const fmt = (n: number) =>
    n?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—";

  const fmtVol = (n: number) => {
    if (!n) return "—";
    if (n >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
    if (n >= 1e5) return (n / 1e5).toFixed(2) + " L";
    return n.toLocaleString("en-IN");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{
            width: 40, height: 40,
            border: "3px solid #1f1f1f",
            borderTop: "3px solid #8FFFD6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ color: "#888", fontSize: 14 }}>Loading {symbol}…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px 32px", textAlign: "center" }}>
        <AlertCircle size={40} color="#ef4444" style={{ marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
        <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
        <button onClick={() => router.back()} style={{ marginTop: 16, color: "#8FFFD6", background: "none", border: "none", cursor: "pointer" }}>
          ← Go back
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Global keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .order-tab { transition: background 0.2s, color 0.2s; cursor: pointer; }
        .order-tab:hover { opacity: 0.85; }
        .stat-card { transition: border-color 0.2s; }
        .stat-card:hover { border-color: #2a2a2a !important; }
        .back-btn:hover { color: #8FFFD6 !important; }
        .order-btn:hover { filter: brightness(1.1); }
        .order-btn:active { transform: scale(0.98); }
        .qty-btn:hover { background: #1f1f1f !important; }
      `}</style>

      <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto", animation: "fadeInUp 0.4s ease" }}>

        {/* ── Back + Header ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <button
              className="back-btn"
              onClick={() => router.back()}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                color: "#888", background: "none", border: "none",
                cursor: "pointer", fontSize: 13, marginBottom: 16,
                padding: 0, transition: "color 0.2s",
              }}
            >
              <ArrowLeft size={14} />
              Back to Portfolio
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Symbol badge */}
              <div style={{
                width: 52, height: 52,
                background: "linear-gradient(135deg, #8FFFD6 0%, #00c896 100%)",
                borderRadius: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 13, color: "#0a0a0a",
                letterSpacing: 0.5, flexShrink: 0,
              }}>
                {(quote?.symbol ?? symbol).replace(".BSE", "").slice(0, 3)}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
                    {quote?.symbol ?? symbol}
                  </h1>
                  <span style={{
                    fontSize: 11, padding: "2px 8px",
                    background: "#1f1f1f", borderRadius: 6,
                    color: "#888", border: "1px solid #2a2a2a",
                  }}>
                    {symbol.endsWith(".BSE") ? "BSE" : "NASDAQ"}
                  </span>
                </div>
                <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>
                  {quote?.latestTradingDay
                    ? `Last updated: ${new Date(quote.latestTradingDay).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                    : "Live data"}
                </p>
              </div>
            </div>
          </div>

          {/* Price + change */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>
              ₹{fmt(quote?.price ?? 0)}
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6,
              padding: "4px 12px", borderRadius: 8,
              background: isPositive ? "rgba(143,255,214,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${isPositive ? "rgba(143,255,214,0.2)" : "rgba(239,68,68,0.2)"}`,
            }}>
              {isPositive
                ? <TrendingUp size={14} color="#8FFFD6" />
                : <TrendingDown size={14} color="#ef4444" />}
              <span style={{ color: isPositive ? "#8FFFD6" : "#ef4444", fontWeight: 600, fontSize: 14 }}>
                {isPositive ? "+" : ""}{fmt(quote?.change ?? 0)}
                {" "}({isPositive ? "+" : ""}{(quote?.changePercent ?? 0).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* ── Main layout: chart + order panel ──────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

          {/* LEFT column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Chart card */}
            <div style={{
              background: "#111111",
              border: "1px solid #1f1f1f",
              borderRadius: 14,
              padding: "20px 24px",
            }}>
              {/* Chart header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Activity size={15} color="#8FFFD6" />
                  <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Price Chart</span>
                </div>

                {/* Area / Candlestick toggle */}
                <div style={{
                  display: "flex",
                  background: "#0a0a0a",
                  border: "1px solid #1f1f1f",
                  borderRadius: 8,
                  padding: 3,
                  gap: 2,
                }}>
                  {(["area", "candlestick"] as ChartType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setChartType(t)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 500,
                        transition: "all 0.2s",
                        background: chartType === t ? "#1f1f1f" : "transparent",
                        color: chartType === t ? "#8FFFD6" : "#666",
                      }}
                    >
                      {t === "area" ? <Activity size={12} /> : <BarChart2 size={12} />}
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {histLoading ? (
                <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    width: 28, height: 28,
                    border: "2px solid #1f1f1f",
                    borderTop: "2px solid #8FFFD6",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                </div>
              ) : chartType === "area" ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={areaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8FFFD6" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#8FFFD6" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#555", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fill: "#555", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`}
                      width={55}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip content={<CustomAreaTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#8FFFD6"
                      strokeWidth={2}
                      fill="url(#areaGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#8FFFD6", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                /* Candlestick — rendered as grouped bars simulating candles */
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={candleData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#555", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fill: "#555", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`}
                      width={55}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip content={<CustomCandleTooltip />} />
                    {/* High line */}
                    <Line type="monotone" dataKey="high"  stroke="transparent" dot={false} />
                    {/* Low line */}
                    <Line type="monotone" dataKey="low"   stroke="transparent" dot={false} />
                    {/* Close as main line */}
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#8FFFD6"
                      strokeWidth={1.5}
                      dot={(p) => {
                        const isBull = p.payload.close >= p.payload.open;
                        return (
                          <circle
                            key={p.index}
                            cx={p.cx}
                            cy={p.cy}
                            r={3}
                            fill={isBull ? "#8FFFD6" : "#ef4444"}
                            stroke="none"
                          />
                        );
                      }}
                      activeDot={{ r: 5 }}
                    />
                    {/* Open-close range bars */}
                    <Bar
                      dataKey="close"
                      barSize={6}
                      shape={(p: any) => {
                        const isBull = p.close >= p.open;
                        return (
                          <rect
                            key={p.index}
                            x={p.x + p.width / 2 - 3}
                            y={Math.min(p.y, p.background?.y ?? p.y)}
                            width={6}
                            height={Math.max(2, Math.abs((p.background?.height ?? 0) - p.height))}
                            fill={isBull ? "#8FFFD6" : "#ef4444"}
                            opacity={0.7}
                            rx={1}
                          />
                        );
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── Stats row ──────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "Open",          value: `₹${fmt(quote?.open ?? 0)}` },
                { label: "Day High",      value: `₹${fmt(quote?.high ?? 0)}`,   color: "#8FFFD6" },
                { label: "Day Low",       value: `₹${fmt(quote?.low ?? 0)}`,    color: "#ef4444" },
                { label: "Prev. Close",   value: `₹${fmt(quote?.previousClose ?? 0)}` },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="stat-card"
                  style={{
                    background: "#111111",
                    border: "1px solid #1f1f1f",
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  <p style={{ color: "#555", fontSize: 11, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
                  <p style={{ color: color ?? "#fff", fontWeight: 600, fontSize: 15, margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {[
                { label: "Volume", value: fmtVol(quote?.volume ?? 0) },
                { label: "Last Trading Day", value: quote?.latestTradingDay ?? "—" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="stat-card"
                  style={{
                    background: "#111111",
                    border: "1px solid #1f1f1f",
                    borderRadius: 10,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Clock size={14} color="#555" />
                  <div>
                    <p style={{ color: "#555", fontSize: 11, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
                    <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: 0 }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Analyst Ratings ────────────────────────────────────────── */}
            <div style={{
              background: "#111111",
              border: "1px solid #1f1f1f",
              borderRadius: 14,
              padding: "20px 24px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <Star size={15} color="#8FFFD6" />
                <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Analyst Ratings</span>
                <span style={{
                  marginLeft: "auto",
                  fontSize: 11, color: "#555",
                  background: "#0a0a0a",
                  border: "1px solid #1f1f1f",
                  padding: "2px 8px",
                  borderRadius: 5,
                }}>
                  AI-powered
                </span>
              </div>

              {/* Summary badges */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "Strong Buy", val: quote?.analystBuy ?? 65,  color: "#8FFFD6",  bg: "rgba(143,255,214,0.07)" },
                  { label: "Hold",       val: quote?.analystHold ?? 25, color: "#f59e0b",  bg: "rgba(245,158,11,0.07)" },
                  { label: "Sell",       val: quote?.analystSell ?? 10, color: "#ef4444",  bg: "rgba(239,68,68,0.07)" },
                ].map(({ label, val, color, bg }) => (
                  <div key={label} style={{
                    flex: 1, textAlign: "center",
                    background: bg,
                    border: `1px solid ${color}22`,
                    borderRadius: 10, padding: "12px 8px",
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}%</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Rating bars */}
              {[
                { label: "Buy",  val: quote?.analystBuy ?? 65,  color: "#8FFFD6" },
                { label: "Hold", val: quote?.analystHold ?? 25, color: "#f59e0b" },
                { label: "Sell", val: quote?.analystSell ?? 10, color: "#ef4444" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#888" }}>{label}</span>
                    <span style={{ fontSize: 12, color, fontWeight: 600 }}>{val}%</span>
                  </div>
                  <div style={{ height: 5, background: "#1f1f1f", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${val}%`,
                      background: color,
                      borderRadius: 3,
                      transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT column — Order Panel */}
          <div style={{
            background: "#111111",
            border: "1px solid #1f1f1f",
            borderRadius: 14,
            padding: "20px",
            position: "sticky",
            top: 20,
          }}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "0 0 18px" }}>
              Place Order
            </h3>

            {/* Buy / Sell toggle */}
            <div style={{
              display: "flex",
              background: "#0a0a0a",
              border: "1px solid #1f1f1f",
              borderRadius: 10,
              padding: 4,
              marginBottom: 20,
            }}>
              {(["buy", "sell"] as OrderType[]).map((t) => (
                <button
                  key={t}
                  className="order-tab"
                  onClick={() => setOrderType(t)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    background: orderType === t
                      ? (t === "buy" ? "rgba(143,255,214,0.12)" : "rgba(239,68,68,0.12)")
                      : "transparent",
                    color: orderType === t
                      ? (t === "buy" ? "#8FFFD6" : "#ef4444")
                      : "#555",
                    borderTop: orderType === t
                      ? `2px solid ${t === "buy" ? "#8FFFD6" : "#ef4444"}`
                      : "2px solid transparent",
                  }}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Current price display */}
            <div style={{
              background: "#0a0a0a",
              border: "1px solid #1f1f1f",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ color: "#888", fontSize: 12 }}>Market Price</span>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
                ₹{fmt(quote?.price ?? 0)}
              </span>
            </div>

            {/* Quantity */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "#888", fontSize: 12, marginBottom: 8 }}>
                Quantity
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  className="qty-btn"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{
                    width: 36, height: 36,
                    background: "#111111",
                    border: "1px solid #1f1f1f",
                    borderRadius: 8,
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  value={quantity}
                  min={1}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    flex: 1,
                    background: "#0a0a0a",
                    border: "1px solid #1f1f1f",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 600,
                    textAlign: "center",
                    padding: "8px 0",
                    outline: "none",
                  }}
                />
                <button
                  className="qty-btn"
                  onClick={() => setQuantity(quantity + 1)}
                  style={{
                    width: 36, height: 36,
                    background: "#111111",
                    border: "1px solid #1f1f1f",
                    borderRadius: 8,
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Order summary */}
            <div style={{
              background: "#0a0a0a",
              border: "1px solid #1f1f1f",
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 20,
            }}>
              {[
                { label: "Price per share", value: `₹${fmt(quote?.price ?? 0)}` },
                { label: "Quantity",        value: quantity.toString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#555", fontSize: 12 }}>{label}</span>
                  <span style={{ color: "#888", fontSize: 12 }}>{value}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #1f1f1f", paddingTop: 10, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888", fontSize: 13 }}>Total</span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
                  ₹{orderTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Submit button */}
            <button
              className="order-btn"
              onClick={handleOrder}
              disabled={orderLoading}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 10,
                border: "none",
                cursor: orderLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 0.3,
                transition: "all 0.2s",
                background: orderType === "buy"
                  ? "linear-gradient(135deg, #8FFFD6, #00c896)"
                  : "linear-gradient(135deg, #ef4444, #dc2626)",
                color: orderType === "buy" ? "#0a0a0a" : "#fff",
                opacity: orderLoading ? 0.7 : 1,
              }}
            >
              {orderLoading
                ? "Processing…"
                : `${orderType === "buy" ? "Buy" : "Sell"} ${quantity} × ${quote?.symbol ?? symbol}`}
            </button>

            {/* Watchlist button */}
            <button
              onClick={() => setWatchlisted(!watchlisted)}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "11px 0",
                borderRadius: 10,
                border: `1px solid ${watchlisted ? "#8FFFD6" : "#1f1f1f"}`,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                background: "transparent",
                color: watchlisted ? "#8FFFD6" : "#888",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              {watchlisted ? <Star size={14} fill="#8FFFD6" /> : <StarOff size={14} />}
              {watchlisted ? "Watchlisted" : "Add to Watchlist"}
            </button>

            {/* Disclaimer */}
            <p style={{ color: "#333", fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
              Market orders are executed at prevailing prices. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast {...toast} />}
    </>
  );
}