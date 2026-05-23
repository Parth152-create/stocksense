"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMarket } from "@/hooks/useMarket";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Plus, RefreshCw, ArrowUpRight, Download } from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";
import { exportPortfolioCsv } from "@/lib/csv-export";
import { useCountUp } from "@/hooks/useCountUp";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HoldingRow {
  symbol: string; name: string; qty: number;
  avgPrice: number; currentPrice: number;
  marketValue: number; pnl: number; pnlPct: number;
}
interface PortfolioHoldingApiRow extends HoldingRow {
  quantity?: number;
}
interface PortfolioSummary {
  totalValue: number; totalCost: number;
  totalPnl: number; totalPnlPct: number;
  allocation?: { label: string; pct: number }[];
}
interface PortfolioSummaryApiResponse {
  totalValue?: number;
  totalInvested?: number;
  totalCost?: number;
  totalPnl?: number;
  totalPnlPct?: number;
  allocation?: { label: string; pct: number }[];
}
interface PortfolioHistoryApiPoint {
  date: string;
  value: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const APPLE = [0.22, 1, 0.36, 1] as const;

const LOGO_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com", AAPL: "apple.com", AMD: "amd.com", MSFT: "microsoft.com",
  NVDA: "nvidia.com", ADBE: "adobe.com", KO: "coca-cola.com", MCD: "mcdonalds.com",
  AMZN: "amazon.com", GOOGL: "google.com", RELIANCE: "ril.com", TCS: "tcs.com",
  INFY: "infosys.com", HDFCBANK: "hdfcbank.com", WIPRO: "wipro.com",
};

const SYMBOL_COLORS: Record<string, { color: string; bg: string }> = {
  NVDA:     { color: "#76b900", bg: "#76b90018" },
  AAPL:     { color: "#aaaaaa", bg: "#aaaaaa18" },
  MSFT:     { color: "#00a4ef", bg: "#00a4ef18" },
  ADBE:     { color: "#ff0000", bg: "#ff000018" },
  AMD:      { color: "#ed1c24", bg: "#ed1c2418" },
  TSLA:     { color: "#ef4444", bg: "#ef444418" },
  RELIANCE: { color: "#0ea5e9", bg: "#0ea5e918" },
  TCS:      { color: "#8b5cf6", bg: "#8b5cf618" },
  INFY:     { color: "#f59e0b", bg: "#f59e0b18" },
  HDFCBANK: { color: "#10b981", bg: "#10b98118" },
  WIPRO:    { color: "#ef4444", bg: "#ef444418" },
};
const DEFAULT_COLOR = { color: "#8FFFD6", bg: "#8FFFD618" };

const SECTOR_COLORS = ["#8FFFD6", "#6366f1", "#f59e0b", "#ef4444", "#a855f7", "#0ea5e9"];
const SECTOR_MAP: Record<string, string> = {
  NVDA: "Technology", AAPL: "Technology", MSFT: "Technology", ADBE: "Technology",
  AMD: "Technology", TSLA: "Consumer", KO: "Consumer",
  RELIANCE: "Energy", TCS: "IT", INFY: "IT", WIPRO: "IT", HDFCBANK: "Banking",
};

const PORTFOLIO_HISTORY = [
  { t: "Aug", v: 72000 }, { t: "Sep", v: 74500 }, { t: "Oct", v: 78000 },
  { t: "Nov", v: 81000 }, { t: "Dec", v: 86000 }, { t: "Jan", v: 84000 },
  { t: "Feb", v: 88000 }, { t: "Mar", v: 91000 }, { t: "Apr", v: 90200 },
  { t: "May", v: 93314 },
];

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
  hover:   "var(--color-surface-hover)",
};

// ── Animation variants ────────────────────────────────────────────────────────
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const cardV = {
  hidden:  { opacity: 0, y: 18, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.42, ease: APPLE } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: APPLE } },
};
const rowAnim = {
  hidden:  { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: APPLE } },
};

// ── StockAvatar ───────────────────────────────────────────────────────────────
function StockAvatar({ symbol, color, bg, size = 36 }: {
  symbol: string; color: string; bg: string; size?: number;
}) {
  const [err, setErr] = useState(false);
  const clean  = symbol.replace(/\.(BSE|NSE)$/i, "").replace("/", "").slice(0, 8);
  const domain = LOGO_DOMAINS[clean];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      border: `1px solid ${color}33`, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, color,
      flexShrink: 0, overflow: "hidden",
    }}>
      {domain && !err
        ? <img src={`https://icons.duckduckgo.com/ip3/${domain}.ico`} alt={symbol}
            width={size * 0.6} height={size * 0.6} onError={() => setErr(true)}
            style={{ objectFit: "contain", borderRadius: "50%" }} />
        : clean.charAt(0)}
    </div>
  );
}

// ── Weight bar — shows holding's share of total portfolio ─────────────────────
function WeightBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ width: "100%", height: 4, borderRadius: 99, background: "var(--color-line)", overflow: "hidden", marginTop: 4 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.7, ease: APPLE, delay: 0.1 }}
        style={{ height: "100%", borderRadius: 99, background: color }}
      />
    </div>
  );
}

// ── Custom donut center label ─────────────────────────────────────────────────
function DonutLabel({ value, currency }: { value: number; currency: string }) {
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
      <tspan x="50%" dy="-6" fontSize="11" fill="var(--color-muted)">Total</tspan>
      <tspan x="50%" dy="18" fontSize="13" fontWeight="700" fill="var(--color-primary)">
        {currency}{value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)}
      </tspan>
    </text>
  );
}

function toNavSymbol(symbol: string) {
  return symbol.replace(/\.(BSE|NSE)$/i, "");
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const router   = useRouter();
  const { market } = useMarket();
  const currency = market.currency || "$";

  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [summary,  setSummary]  = useState<PortfolioSummary | null>(null);
  const [portfolioHistory, setPortfolioHistory] = useState<{ t: string; v: number }[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sortBy,   setSortBy]   = useState<"value" | "pnl" | "pnlpct">("value");

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const [holdingsRes, summaryRes, historyRes] = await Promise.all([
        fetchWithAuth(`/api/portfolio?market=${market.id}`),
        fetchWithAuth(`/api/portfolio/summary?market=${market.id}`),
        fetchWithAuth("/api/portfolio/history?range=1Y"),
      ]);
      if (holdingsRes.ok) {
        const data = await holdingsRes.json() as PortfolioHoldingApiRow[] | { holdings?: PortfolioHoldingApiRow[] };
        const rows = Array.isArray(data) ? data : (data.holdings ?? []);
        setHoldings(rows.map((h) => ({
          ...h,
          qty: h.qty ?? h.quantity ?? 0,
        })));
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json() as PortfolioSummaryApiResponse;
        setSummary({
          totalValue: data.totalValue ?? 0,
          totalCost: data.totalInvested ?? data.totalCost ?? 0,
          totalPnl: data.totalPnl ?? 0,
          totalPnlPct: data.totalPnlPct ?? 0,
          allocation: data.allocation,
        });
      }
      if (historyRes.ok) {
        const data = await historyRes.json() as PortfolioHistoryApiPoint[];
        if (Array.isArray(data) && data.length >= 2) {
          setPortfolioHistory(data.map((p) => ({ t: p.date, v: p.value })));
        }
      }
    } catch { /* auth redirect handled upstream */ }
    finally { setLoading(false); }
  }, [market.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadPortfolio(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadPortfolio]);

  // Derived values
  const totalValue  = summary?.totalValue  ?? holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost   = summary?.totalCost   ?? holdings.reduce((s, h) => s + h.avgPrice * h.qty, 0);
  const totalPnl    = summary?.totalPnl    ?? (totalValue - totalCost);
  const totalPnlPct = summary?.totalPnlPct ?? (totalCost > 0 ? (totalPnl / totalCost) * 100 : 0);
  const isUp        = totalPnl >= 0;

  const countedValue = useCountUp(Math.floor(totalValue));
  const countedCost  = useCountUp(Math.floor(totalCost));
  const countedPnl   = useCountUp(Math.floor(Math.abs(totalPnl)));

  // Sector allocation
  const sectorData = (() => {
    const realAlloc = summary?.allocation;
    if (Array.isArray(realAlloc) && realAlloc.length > 0) {
      return realAlloc.map((a, i) => ({
        name: a.label,
        value: totalValue > 0 ? (a.pct / 100) * totalValue : 0,
        color: SECTOR_COLORS[i % SECTOR_COLORS.length],
      }));
    }

    const totals: Record<string, number> = {};
    holdings.forEach(h => {
      const sym    = h.symbol.replace(/\.(BSE|NSE)$/i, "");
      const sector = SECTOR_MAP[sym] ?? "Other";
      totals[sector] = (totals[sector] ?? 0) + h.marketValue;
    });
    return Object.entries(totals).map(([name, value], i) => ({
      name, value, color: SECTOR_COLORS[i % SECTOR_COLORS.length],
    }));
  })();

  const allTimePctLabel = portfolioHistory.length >= 2
    ? (() => {
        const first = portfolioHistory[0].v;
        const last  = portfolioHistory[portfolioHistory.length - 1].v;
        const pct   = first > 0 ? ((last - first) / first) * 100 : 0;
        return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% all time`;
      })()
    : "+29.6% all time";

  const sorted = [...holdings].sort((a, b) =>
    sortBy === "value"  ? b.marketValue - a.marketValue
    : sortBy === "pnl"  ? b.pnl - a.pnl
    : b.pnlPct - a.pnlPct
  );

  const fmt = (n: number) =>
    `${currency}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{
      padding: "24px 32px", maxWidth: 1200, margin: "0 auto",
      fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
      background: C.page, minHeight: "100vh",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .stats-grid       { grid-template-columns: 1fr 1fr !important; }
          .chart-donut-grid { grid-template-columns: 1fr !important; }
          .holdings-cols    { grid-template-columns: 2fr 1fr 1fr 80px !important; }
          .hide-md          { display: none !important; }
        }
        @media (max-width: 640px) {
          .stats-grid       { grid-template-columns: 1fr !important; }
          .holdings-cols    { grid-template-columns: 1fr 1fr 80px !important; }
          .hide-sm          { display: none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: APPLE }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}
      >
        <div>
          <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>
            My Portfolio
          </h1>
          <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>
            {market.flag} {market.label} · {holdings.length} positions
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => exportPortfolioCsv(holdings)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <Download size={13} /> Export CSV
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
            onClick={loadPortfolio}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer", color: "#0a0a0a", fontWeight: 700, fontSize: 13 }}>
            <Plus size={14} /> Add Position
          </motion.button>
        </div>
      </motion.div>

      {/* ── Stats row ── */}
      <motion.div initial="hidden" animate="visible" variants={stagger}
        className="stats-grid"
        style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>

        {/* Total Value — hero card */}
        <motion.div variants={cardV}
          whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: { duration: 0.18 } }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 140, background: `radial-gradient(ellipse at right, ${isUp ? "#8FFFD6" : "#ef4444"}10 0%, transparent 70%)`, pointerEvents: "none" }} />
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>Total Value</p>
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, ease: APPLE }}
            style={{ color: C.primary, fontWeight: 800, fontSize: 28, margin: 0, letterSpacing: -0.5 }}>
            {currency}{countedValue.toLocaleString("en-US")}
          </motion.p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            {isUp ? <TrendingUp size={13} color="#22c55e" /> : <TrendingDown size={13} color="#ef4444" />}
            <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
              {isUp ? "+" : ""}{fmt(totalPnl)} ({isUp ? "+" : ""}{totalPnlPct.toFixed(2)}%)
            </span>
          </div>
        </motion.div>

        {/* Total Cost */}
        <motion.div variants={cardV}
          whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: { duration: 0.18 } }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>Total Cost</p>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4, ease: APPLE }}
            style={{ color: C.muted, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: -0.3 }}>
            {currency}{countedCost.toLocaleString("en-US")}
          </motion.p>
          <p style={{ color: C.muted, fontSize: 11, margin: "6px 0 0" }}>Invested capital</p>
        </motion.div>

        {/* Unrealized P&L */}
        <motion.div variants={cardV}
          whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: { duration: 0.18 } }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"} 0%, transparent 70%)`, pointerEvents: "none" }} />
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>Unrealized P&L</p>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4, ease: APPLE }}
            style={{ color: isUp ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: -0.3 }}>
            {isUp ? "+" : "-"}{currency}{countedPnl.toLocaleString("en-US")}
          </motion.p>
          <p style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 11, margin: "6px 0 0", fontWeight: 600, opacity: 0.75 }}>
            {isUp ? "+" : ""}{totalPnlPct.toFixed(2)}% overall
          </p>
        </motion.div>

        {/* Positions */}
        <motion.div variants={cardV}
          whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: { duration: 0.18 } }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(143,255,214,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>Positions</p>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4, ease: APPLE }}
            style={{ color: "#8FFFD6", fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: -0.3 }}>
            {holdings.length}
          </motion.p>
          <p style={{ color: C.muted, fontSize: 11, margin: "6px 0 0" }}>Active holdings</p>
        </motion.div>
      </motion.div>

      {/* ── Chart + Donut ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible"
        className="chart-donut-grid"
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 290px", gap: 16, marginBottom: 24 }}>

        {/* Performance chart */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>Portfolio Performance</p>
            <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>
              {allTimePctLabel}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={portfolioHistory.length >= 2 ? portfolioHistory : PORTFOLIO_HISTORY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8FFFD6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8FFFD6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${currency}${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 11 }}
                itemStyle={{ color: "#8FFFD6" }}
                labelStyle={{ color: "var(--color-muted)" }}
                formatter={(v: unknown) => {
                  if (typeof v === "number") {
                    return [`${currency}${v.toLocaleString()}`, "Value"];
                  }
                  return ["", "Value"];
                }}
              />
              <Area type="monotone" dataKey="v" stroke="#8FFFD6" strokeWidth={2}
                fill="url(#pg)" dot={false}
                isAnimationActive={true} animationDuration={900} animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation donut — larger with center label */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" }}>
          <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: "0 0 4px" }}>Sector Allocation</p>
          <p style={{ color: C.muted, fontSize: 11, margin: "0 0 12px" }}>{sectorData.length} sectors</p>

          {sectorData.length === 0 ? (
            <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: C.muted, fontSize: 12 }}>No data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie
                  data={sectorData} cx="50%" cy="50%"
                  innerRadius={38} outerRadius={56}
                  dataKey="value" stroke="none"
                  animationBegin={200} animationDuration={800}
                >
                  {sectorData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: unknown) => [`${currency}${typeof v === "number" ? v.toLocaleString() : String(v)}`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
            {sectorData.map(s => {
              const pct = totalValue > 0 ? (s.value / totalValue) * 100 : 0;
              return (
                <div key={s.name}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      <span style={{ color: C.muted, fontSize: 11 }}>{s.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: C.muted, fontSize: 10 }}>{currency}{s.value.toLocaleString()}</span>
                      <span style={{ color: C.primary, fontSize: 11, fontWeight: 700, minWidth: 32, textAlign: "right" }}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {/* Mini allocation bar */}
                  <div style={{ height: 3, borderRadius: 99, background: "var(--color-line)", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: APPLE, delay: 0.3 }}
                      style={{ height: "100%", background: s.color, borderRadius: 99 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Holdings Table ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: APPLE }}
        style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>

        {/* Table header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>Holdings</p>
            {!loading && sorted.length > 0 && (
              <span style={{ background: "var(--color-surface-hover)", color: C.muted, borderRadius: 99, fontSize: 10, fontWeight: 600, padding: "2px 8px" }}>
                {sorted.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: 3, gap: 2 }}>
            {(["value", "pnl", "pnlpct"] as const).map(s => (
              <motion.button key={s} onClick={() => setSortBy(s)} whileTap={{ scale: 0.95 }}
                style={{ padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, transition: "all 0.15s",
                  background: sortBy === s ? C.card : "transparent",
                  color:      sortBy === s ? "#8FFFD6" : C.muted }}>
                {s === "value" ? "Value" : s === "pnl" ? "P&L $" : "P&L %"}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div className="holdings-cols"
          style={{ display: "grid", gridTemplateColumns: "2.2fr 0.8fr 1fr 1fr 1.1fr 1.1fr 90px", padding: "10px 20px", borderBottom: `1px solid ${C.line}`, background: "var(--color-surface-hover)" }}>
          {["Asset", "Weight", "Avg Price", "Current", "Market Value", "P&L", ""].map((h, i) => (
            <span key={i} className={i >= 2 && i <= 4 ? "hide-md" : ""}
              style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: C.muted, fontSize: 13 }}>Loading holdings…</p>
          </div>
        ) : sorted.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: 52, textAlign: "center" }}>
            <p style={{ fontSize: 36, margin: "0 0 12px" }}>📈</p>
            <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No holdings yet</p>
            <p style={{ color: C.muted, fontSize: 13, margin: "0 0 20px" }}>Start building your portfolio by placing your first order.</p>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/dashboard")}
              style={{ padding: "10px 20px", background: "#8FFFD6", borderRadius: 10, border: "none", color: "#0a0a0a", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Browse Stocks
            </motion.button>
          </motion.div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            {sorted.map((h, i) => {
              const up      = h.pnl >= 0;
              const sym     = h.symbol.replace(/\.(BSE|NSE)$/i, "");
              const { color, bg } = SYMBOL_COLORS[sym] ?? DEFAULT_COLOR;
              const nav     = toNavSymbol(h.symbol);
              const weight  = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;

              return (
                <motion.div key={h.symbol}
                  variants={rowAnim}
                  whileHover={{ backgroundColor: "var(--color-surface-hover)", transition: { duration: 0.12 } }}
                  onClick={() => router.push(`/dashboard/stock/${nav}?market=${market.id}`)}
                  className="holdings-cols"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.2fr 0.8fr 1fr 1fr 1.1fr 1.1fr 90px",
                    padding: "14px 20px",
                    borderBottom: i < sorted.length - 1 ? `1px solid ${C.line}` : "none",
                    cursor: "pointer", alignItems: "center",
                  }}>

                  {/* Asset */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <StockAvatar symbol={h.symbol} color={color} bg={bg} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>{sym}</p>
                      <p style={{ color: C.muted, fontSize: 11, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                        {h.name}
                      </p>
                    </div>
                  </div>

                  {/* Weight % + bar */}
                  <div className="hide-sm">
                    <p style={{ color: C.primary, fontSize: 12, fontWeight: 600, margin: 0 }}>
                      {weight.toFixed(1)}%
                    </p>
                    <WeightBar pct={weight} color={color} />
                  </div>

                  {/* Avg Price */}
                  <span className="hide-md" style={{ color: C.muted, fontSize: 13 }}>
                    {currency}{h.avgPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>

                  {/* Current Price */}
                  <span className="hide-md" style={{ color: C.primary, fontSize: 13, fontWeight: 500 }}>
                    {currency}{h.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>

                  {/* Market Value */}
                  <span className="hide-md" style={{ color: C.primary, fontSize: 13, fontWeight: 600 }}>
                    {currency}{h.marketValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>

                  {/* P&L — richer pill */}
                  <div>
                    <div style={{
                      display: "inline-flex", flexDirection: "column", alignItems: "flex-start",
                      padding: "5px 9px", borderRadius: 8,
                      background: up ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${up ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                    }}>
                      <span style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>
                        {up ? "+" : "-"}{currency}{Math.abs(h.pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 10, fontWeight: 500, opacity: 0.8 }}>
                        {up ? "+" : ""}{h.pnlPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Trade button */}
                  <motion.button
                    whileHover={{ scale: 1.04, borderColor: "#8FFFD6", color: "#8FFFD6" }}
                    whileTap={{ scale: 0.96 }}
                    onClick={e => { e.stopPropagation(); router.push(`/dashboard/stock/${nav}?market=${market.id}`); }}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.15s" }}>
                    Trade <ArrowUpRight size={11} />
                  </motion.button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
