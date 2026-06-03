"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMarket } from "@/hooks/useMarket";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Plus, RefreshCw, ArrowUpRight, Download, Lock, Unlock, FileText } from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";
import { exportPortfolioCsv } from "@/lib/csv-export";
import { useCountUp } from "@/hooks/useCountUp";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HoldingRow {
  symbol: string; name: string; qty: number;
  avgPrice: number; currentPrice: number;
  marketValue: number; pnl: number; pnlPct: number;
}
interface PortfolioHoldingApiRow extends HoldingRow { quantity?: number; }
interface PortfolioSummary {
  totalValue: number; totalCost: number;
  totalPnl: number; totalPnlPct: number;
  unrealizedPnl: number; unrealizedPnlPct: number;
  realizedPnl: number; totalCombinedPnl: number;
  allocation?: { label: string; pct: number }[];
}
interface PortfolioSummaryApiResponse {
  totalValue?: number; totalInvested?: number; totalCost?: number;
  totalPnl?: number; totalPnlPct?: number;
  unrealizedPnl?: number; unrealizedPnlPct?: number;
  realizedPnl?: number; totalCombinedPnl?: number;
  allocation?: { label: string; pct: number }[];
}
interface PortfolioHistoryApiPoint { date: string; value: number; }

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
  page: "var(--color-page)", card: "var(--color-card)",
  line: "var(--color-line)", primary: "var(--color-primary)",
  muted: "var(--color-muted)", hover: "var(--color-surface-hover)",
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const cardV = {
  hidden:  { opacity: 0, y: 18, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.42, ease: APPLE } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: APPLE } },
};
const rowAnim = {
  hidden:  { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: APPLE } },
};

function StockAvatar({ symbol, color, bg, size = 36 }: { symbol: string; color: string; bg: string; size?: number }) {
  const [err, setErr] = useState(false);
  const clean  = symbol.replace(/\.(BSE|NSE)$/i, "").replace("/", "").slice(0, 8);
  const domain = LOGO_DOMAINS[clean];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, color, flexShrink: 0, overflow: "hidden" }}>
      {domain && !err
        ? <img src={`https://icons.duckduckgo.com/ip3/${domain}.ico`} alt={symbol} width={size * 0.6} height={size * 0.6} onError={() => setErr(true)} style={{ objectFit: "contain", borderRadius: "50%" }} />
        : clean.charAt(0)}
    </div>
  );
}

function WeightBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ width: "100%", height: 4, borderRadius: 99, background: "var(--color-line)", overflow: "hidden", marginTop: 4 }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.7, ease: APPLE, delay: 0.1 }} style={{ height: "100%", borderRadius: 99, background: color }} />
    </div>
  );
}

function toNavSymbol(symbol: string) { return symbol.replace(/\.(BSE|NSE)$/i, ""); }

function PnlBreakdownCard({ unrealizedPnl, unrealizedPnlPct, realizedPnl, totalCombinedPnl, currency }: {
  unrealizedPnl: number; unrealizedPnlPct: number; realizedPnl: number; totalCombinedPnl: number; currency: string;
}) {
  const fmtAbs  = (n: number) => `${n >= 0 ? "+" : "-"}${currency}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const colorFor = (n: number) => n >= 0 ? "#22c55e" : "#ef4444";
  const combinedUp = totalCombinedPnl >= 0;
  return (
    <motion.div variants={cardV} whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: { duration: 0.18 } }}
      className="pnl-span"
      style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", position: "relative", overflow: "hidden", gridColumn: "span 2" }}>
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 180, background: `radial-gradient(ellipse at right, ${combinedUp ? "#8FFFD6" : "#ef4444"}08 0%, transparent 70%)`, pointerEvents: "none" }} />
      <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 14px" }}>P&amp;L Breakdown</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { label: "Unrealized", sub: "Open positions", icon: <Unlock size={13} color={colorFor(unrealizedPnl)} />, pnl: unrealizedPnl, pct: unrealizedPnlPct, showPct: true },
          { label: "Realized",   sub: "Closed trades · FIFO", icon: <Lock size={13} color={colorFor(realizedPnl)} />, pnl: realizedPnl, pct: null, showPct: false },
        ].map(({ label, sub, icon, pnl, pct, showPct }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: pnl >= 0 ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${pnl >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: pnl >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
              <div>
                <p style={{ color: C.primary, fontSize: 12, fontWeight: 600, margin: 0 }}>{label}</p>
                <p style={{ color: C.muted, fontSize: 10, margin: "1px 0 0" }}>{sub}</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ color: colorFor(pnl), fontSize: 14, fontWeight: 700, margin: 0 }}>{fmtAbs(pnl)}</p>
              {showPct && pct != null && <p style={{ color: colorFor(pnl), fontSize: 10, margin: "2px 0 0", opacity: 0.8 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</p>}
              {!showPct && <p style={{ color: C.muted, fontSize: 10, margin: "2px 0 0" }}>{pnl === 0 ? "No closed positions" : "Locked in"}</p>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Combined Total</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {combinedUp ? <TrendingUp size={13} color="#22c55e" /> : <TrendingDown size={13} color="#ef4444" />}
          <span style={{ color: colorFor(totalCombinedPnl), fontSize: 14, fontWeight: 700 }}>{fmtAbs(totalCombinedPnl)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function PortfolioPage() {
  const router     = useRouter();
  const { market } = useMarket();
  const currency   = market.currency || "$";

  const [holdings,        setHoldings]        = useState<HoldingRow[]>([]);
  const [summary,         setSummary]         = useState<PortfolioSummary | null>(null);
  const [portfolioHistory,setPortfolioHistory] = useState<{ t: string; v: number }[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [sortBy,          setSortBy]          = useState<"value" | "pnl" | "pnlpct">("value");
  const [exportingPdf,    setExportingPdf]    = useState(false);

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
        setHoldings(rows.map((h) => ({ ...h, qty: h.qty ?? h.quantity ?? 0 })));
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json() as PortfolioSummaryApiResponse;
        setSummary({
          totalValue:       data.totalValue        ?? 0,
          totalCost:        data.totalInvested     ?? data.totalCost ?? 0,
          totalPnl:         data.totalPnl          ?? 0,
          totalPnlPct:      data.totalPnlPct       ?? 0,
          unrealizedPnl:    data.unrealizedPnl     ?? data.totalPnl ?? 0,
          unrealizedPnlPct: data.unrealizedPnlPct  ?? data.totalPnlPct ?? 0,
          realizedPnl:      data.realizedPnl       ?? 0,
          totalCombinedPnl: data.totalCombinedPnl  ?? (data.totalPnl ?? 0),
          allocation:       data.allocation,
        });
      }
      if (historyRes.ok) {
        const data = await historyRes.json() as PortfolioHistoryApiPoint[];
        if (Array.isArray(data) && data.length >= 2)
          setPortfolioHistory(data.map((p) => ({ t: p.date, v: p.value })));
      }
    } catch { }
    finally { setLoading(false); }
  }, [market.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadPortfolio(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadPortfolio]);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await fetchWithAuth(`/api/portfolio/export/pdf?market=${market.id}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.download = `stocksense-portfolio-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch { }
    finally { setExportingPdf(false); }
  };

  const totalValue       = summary?.totalValue       ?? holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost        = summary?.totalCost        ?? holdings.reduce((s, h) => s + h.avgPrice * h.qty, 0);
  const totalPnl         = summary?.totalPnl         ?? (totalValue - totalCost);
  const totalPnlPct      = summary?.totalPnlPct      ?? (totalCost > 0 ? (totalPnl / totalCost) * 100 : 0);
  const unrealizedPnl    = summary?.unrealizedPnl    ?? totalPnl;
  const unrealizedPnlPct = summary?.unrealizedPnlPct ?? totalPnlPct;
  const realizedPnl      = summary?.realizedPnl      ?? 0;
  const totalCombinedPnl = summary?.totalCombinedPnl ?? totalPnl;
  const isUp             = totalCombinedPnl >= 0;

  const countedValue = useCountUp(Math.floor(totalValue));
  const countedCost  = useCountUp(Math.floor(totalCost));

  const sectorData = (() => {
    const realAlloc = summary?.allocation;
    if (Array.isArray(realAlloc) && realAlloc.length > 0)
      return realAlloc.map((a, i) => ({ name: a.label, value: totalValue > 0 ? (a.pct / 100) * totalValue : 0, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }));
    const totals: Record<string, number> = {};
    holdings.forEach(h => { const sym = h.symbol.replace(/\.(BSE|NSE)$/i, ""); const sector = SECTOR_MAP[sym] ?? "Other"; totals[sector] = (totals[sector] ?? 0) + h.marketValue; });
    return Object.entries(totals).map(([name, value], i) => ({ name, value, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }));
  })();

  const allTimePctLabel = portfolioHistory.length >= 2
    ? (() => { const first = portfolioHistory[0].v; const last = portfolioHistory[portfolioHistory.length - 1].v; const pct = first > 0 ? ((last - first) / first) * 100 : 0; return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% all time`; })()
    : "+29.6% all time";

  const sorted = [...holdings].sort((a, b) =>
    sortBy === "value" ? b.marketValue - a.marketValue : sortBy === "pnl" ? b.pnl - a.pnl : b.pnlPct - a.pnlPct
  );

  const fmt = (n: number) => `${currency}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ padding: "16px", maxWidth: 1200, margin: "0 auto", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)", background: C.page, minHeight: "100vh", boxSizing: "border-box" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Stats grid: 4 cols → 2 → 1 */
        .port-stats-grid { grid-template-columns: 1.4fr 1fr 1fr 1fr; }
        @media (max-width: 900px)  { .port-stats-grid { grid-template-columns: 1fr 1fr; } .pnl-span { grid-column: span 2 !important; } }
        @media (max-width: 480px)  { .port-stats-grid { grid-template-columns: 1fr; }    .pnl-span { grid-column: span 1 !important; } }

        /* Chart + donut: side-by-side → stacked */
        .port-chart-grid { grid-template-columns: minmax(0,1fr) 290px; }
        @media (max-width: 768px)  { .port-chart-grid { grid-template-columns: 1fr; } }

        /* Header action buttons: wrap on mobile */
        .port-header { flex-wrap: wrap; gap: 10px; }
        .port-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        /* Holdings table columns */
        .h-cols { grid-template-columns: 2.2fr 0.8fr 1fr 1fr 1.1fr 1.1fr 90px; }
        @media (max-width: 900px)  { .h-cols { grid-template-columns: 2.2fr 1fr 1.1fr 80px; } .hide-md { display: none !important; } }
        @media (max-width: 540px)  { .h-cols { grid-template-columns: 1fr 1.1fr 70px; }        .hide-sm { display: none !important; } }

        /* Export buttons: hide labels on very small */
        @media (max-width: 400px) { .port-btn-label { display: none; } }
      `}</style>

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: APPLE }}
        className="port-header"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>My Portfolio</h1>
          <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>{market.flag} {market.label} · {holdings.length} positions</p>
        </div>
        <div className="port-actions">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => exportPortfolioCsv(holdings)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <Download size={13} /><span className="port-btn-label">CSV</span>
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleExportPdf} disabled={exportingPdf}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: exportingPdf ? C.hover : "transparent", color: C.muted, cursor: exportingPdf ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, opacity: exportingPdf ? 0.6 : 1 }}>
            {exportingPdf ? <div style={{ width: 13, height: 13, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <FileText size={13} />}
            <span className="port-btn-label">{exportingPdf ? "…" : "PDF"}</span>
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} onClick={loadPortfolio}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => router.push("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer", color: "#0a0a0a", fontWeight: 700, fontSize: 13 }}>
            <Plus size={14} /><span className="port-btn-label">Add</span>
          </motion.button>
        </div>
      </motion.div>

      {/* ── Stats row ── */}
      <motion.div initial="hidden" animate="visible" variants={stagger}
        className="port-stats-grid"
        style={{ display: "grid", gap: 12, marginBottom: 20 }}>

        {/* Total Value */}
        <motion.div variants={cardV} whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: { duration: 0.18 } }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 120, background: `radial-gradient(ellipse at right, ${isUp ? "#8FFFD6" : "#ef4444"}10 0%, transparent 70%)`, pointerEvents: "none" }} />
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>Total Value</p>
          <p style={{ color: C.primary, fontWeight: 800, fontSize: 26, margin: 0, letterSpacing: -0.5 }}>{currency}{countedValue.toLocaleString("en-US")}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            {isUp ? <TrendingUp size={13} color="#22c55e" /> : <TrendingDown size={13} color="#ef4444" />}
            <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
              {isUp ? "+" : ""}{fmt(totalCombinedPnl)} ({isUp ? "+" : ""}{unrealizedPnlPct.toFixed(2)}%)
            </span>
          </div>
        </motion.div>

        {/* Total Cost */}
        <motion.div variants={cardV} whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: { duration: 0.18 } }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>Total Cost</p>
          <p style={{ color: C.muted, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: -0.3 }}>{currency}{countedCost.toLocaleString("en-US")}</p>
          <p style={{ color: C.muted, fontSize: 11, margin: "6px 0 0" }}>Invested capital</p>
        </motion.div>

        {/* Positions */}
        <motion.div variants={cardV} whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: { duration: 0.18 } }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>Positions</p>
          <p style={{ color: "#8FFFD6", fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: -0.3 }}>{holdings.length}</p>
          <p style={{ color: C.muted, fontSize: 11, margin: "6px 0 0" }}>Active holdings</p>
        </motion.div>

        {/* P&L Breakdown — spans 2 cols on wide, full width on mobile */}
        <PnlBreakdownCard unrealizedPnl={unrealizedPnl} unrealizedPnlPct={unrealizedPnlPct} realizedPnl={realizedPnl} totalCombinedPnl={totalCombinedPnl} currency={currency} />
      </motion.div>

      {/* ── Chart + Donut ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible"
        className="port-chart-grid"
        style={{ display: "grid", gap: 14, marginBottom: 20 }}>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>Portfolio Performance</p>
            <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>{allTimePctLabel}</span>
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
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${currency}${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 11 }} itemStyle={{ color: "#8FFFD6" }} labelStyle={{ color: "var(--color-muted)" }} formatter={(v: unknown) => { if (typeof v === "number") return [`${currency}${v.toLocaleString()}`, "Value"]; return ["", "Value"]; }} />
              <Area type="monotone" dataKey="v" stroke="#8FFFD6" strokeWidth={2} fill="url(#pg)" dot={false} isAnimationActive animationDuration={900} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: "0 0 4px" }}>Sector Allocation</p>
          <p style={{ color: C.muted, fontSize: 11, margin: "0 0 10px" }}>{sectorData.length} sectors</p>
          {sectorData.length === 0 ? (
            <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: C.muted, fontSize: 12 }}>No data yet</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={sectorData} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="value" stroke="none" animationBegin={200} animationDuration={800}>
                  {sectorData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [`${currency}${typeof v === "number" ? v.toLocaleString() : String(v)}`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {sectorData.map(s => {
              const pct = totalValue > 0 ? (s.value / totalValue) * 100 : 0;
              return (
                <div key={s.name}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      <span style={{ color: C.muted, fontSize: 11 }}>{s.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: C.muted, fontSize: 10 }}>{currency}{s.value.toLocaleString()}</span>
                      <span style={{ color: C.primary, fontSize: 11, fontWeight: 700, minWidth: 28, textAlign: "right" }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 3, borderRadius: 99, background: "var(--color-line)", overflow: "hidden" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: APPLE, delay: 0.3 }} style={{ height: "100%", background: s.color, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Holdings Table ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4, ease: APPLE }}
        style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>Holdings</p>
            {!loading && sorted.length > 0 && (
              <span style={{ background: "var(--color-surface-hover)", color: C.muted, borderRadius: 99, fontSize: 10, fontWeight: 600, padding: "2px 8px" }}>{sorted.length}</span>
            )}
          </div>
          <div style={{ display: "flex", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: 3, gap: 2 }}>
            {(["value", "pnl", "pnlpct"] as const).map(s => (
              <motion.button key={s} onClick={() => setSortBy(s)} whileTap={{ scale: 0.95 }}
                style={{ padding: "4px 8px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, transition: "all 0.15s", background: sortBy === s ? C.card : "transparent", color: sortBy === s ? "#8FFFD6" : C.muted }}>
                {s === "value" ? "Val" : s === "pnl" ? "P&L$" : "P&L%"}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div className="h-cols" style={{ display: "grid", padding: "9px 16px", borderBottom: `1px solid ${C.line}`, background: "var(--color-surface-hover)" }}>
          {["Asset", "Weight", "Avg", "Current", "Value", "P&L", ""].map((h, i) => (
            <span key={i}
              className={[i === 1 ? "hide-sm" : "", i >= 2 && i <= 4 ? "hide-md" : ""].join(" ").trim()}
              style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: C.muted, fontSize: 13 }}>Loading holdings…</p>
          </div>
        ) : sorted.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 52, textAlign: "center" }}>
            <p style={{ fontSize: 36, margin: "0 0 12px" }}>📈</p>
            <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No holdings yet</p>
            <p style={{ color: C.muted, fontSize: 13, margin: "0 0 20px" }}>Start building your portfolio by placing your first order.</p>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => router.push("/dashboard")}
              style={{ padding: "10px 20px", background: "#8FFFD6", borderRadius: 10, border: "none", color: "#0a0a0a", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Browse Stocks
            </motion.button>
          </motion.div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            {sorted.map((h, i) => {
              const up  = h.pnl >= 0;
              const sym = h.symbol.replace(/\.(BSE|NSE)$/i, "");
              const { color, bg } = SYMBOL_COLORS[sym] ?? DEFAULT_COLOR;
              const nav    = toNavSymbol(h.symbol);
              const weight = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;
              return (
                <motion.div key={h.symbol} variants={rowAnim}
                  whileHover={{ backgroundColor: "var(--color-surface-hover)", transition: { duration: 0.12 } }}
                  onClick={() => router.push(`/dashboard/stock/${nav}?market=${market.id}`)}
                  className="h-cols"
                  style={{ display: "grid", padding: "12px 16px", borderBottom: i < sorted.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer", alignItems: "center" }}>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StockAvatar symbol={h.symbol} color={color} bg={bg} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>{sym}</p>
                      <p style={{ color: C.muted, fontSize: 10, margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>{h.name}</p>
                    </div>
                  </div>

                  <div className="hide-sm">
                    <p style={{ color: C.primary, fontSize: 12, fontWeight: 600, margin: 0 }}>{weight.toFixed(1)}%</p>
                    <WeightBar pct={weight} color={color} />
                  </div>

                  <span className="hide-md" style={{ color: C.muted, fontSize: 12 }}>{currency}{h.avgPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  <span className="hide-md" style={{ color: C.primary, fontSize: 12 }}>{currency}{h.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  <span className="hide-md" style={{ color: C.primary, fontSize: 12, fontWeight: 600 }}>{currency}{h.marketValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>

                  <div>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", padding: "4px 8px", borderRadius: 8, background: up ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${up ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                      <span style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{up ? "+" : "-"}{currency}{Math.abs(h.pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 9, fontWeight: 500, opacity: 0.8 }}>{up ? "+" : ""}{h.pnlPct.toFixed(2)}%</span>
                    </div>
                  </div>

                  <motion.button whileHover={{ scale: 1.04, borderColor: "#8FFFD6", color: "#8FFFD6" }} whileTap={{ scale: 0.96 }}
                    onClick={e => { e.stopPropagation(); router.push(`/dashboard/stock/${nav}?market=${market.id}`); }}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.15s" }}>
                    <ArrowUpRight size={11} />
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