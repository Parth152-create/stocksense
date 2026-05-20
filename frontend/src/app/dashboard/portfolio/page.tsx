"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMarket } from "@/hooks/useMarket";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Plus, RefreshCw, ArrowUpRight, Download } from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";
import { exportPortfolioCsv } from "@/lib/csv-export";
import { useCountUp } from "@/hooks/useCountUp";

// ─── Types ──────────────────────────────────────────────────────────────────

interface HoldingRow {
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
}

// ─── Logo helper ────────────────────────────────────────────────────────────

const LOGO_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com", AAPL: "apple.com", AMD: "amd.com", MSFT: "microsoft.com",
  NVDA: "nvidia.com", ADBE: "adobe.com", KO: "coca-cola.com", MCD: "mcdonalds.com",
  AMZN: "amazon.com", GOOGL: "google.com", RELIANCE: "ril.com", TCS: "tcs.com",
  INFY: "infosys.com", HDFCBANK: "hdfcbank.com", WIPRO: "wipro.com",
};

const SYMBOL_COLORS: Record<string, { color: string; bg: string }> = {
  NVDA: { color: "#76b900", bg: "#76b90018" },
  AAPL: { color: "#aaaaaa", bg: "#aaaaaa18" },
  MSFT: { color: "#00a4ef", bg: "#00a4ef18" },
  ADBE: { color: "#ff0000", bg: "#ff000018" },
  AMD:  { color: "#ed1c24", bg: "#ed1c2418" },
  TSLA: { color: "#ef4444", bg: "#ef444418" },
  RELIANCE: { color: "#0ea5e9", bg: "#0ea5e918" },
  TCS:      { color: "#8b5cf6", bg: "#8b5cf618" },
  INFY:     { color: "#f59e0b", bg: "#f59e0b18" },
  HDFCBANK: { color: "#10b981", bg: "#10b98118" },
  WIPRO:    { color: "#ef4444", bg: "#ef444418" },
};

const DEFAULT_COLOR = { color: "#8FFFD6", bg: "#8FFFD618" };

// Sector allocation colours for pie chart
const SECTOR_COLORS = ["#8FFFD6", "#6366f1", "#f59e0b", "#ef4444", "#a855f7"];

const PORTFOLIO_HISTORY = [
  { t: "Aug", v: 72000 }, { t: "Sep", v: 74500 }, { t: "Oct", v: 78000 },
  { t: "Nov", v: 81000 }, { t: "Dec", v: 86000 }, { t: "Jan", v: 84000 },
  { t: "Feb", v: 88000 }, { t: "Mar", v: 91000 }, { t: "Apr", v: 90200 },
  { t: "May", v: 93314 },
];

// ─── Themed CSS vars ─────────────────────────────────────────────────────────

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
  hover:   "var(--color-surface-hover)",
};

// ─── StockAvatar ─────────────────────────────────────────────────────────────

function StockAvatar({ symbol, color, bg, size = 36 }: {
  symbol: string; color: string; bg: string; size?: number;
}) {
  const [err, setErr] = useState(false);
  const clean = symbol.replace(".BSE", "").replace(".NSE", "").replace("/", "").slice(0, 8);
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTradingViewSymbol(symbol: string): string {
  // Strip exchange suffix — plain ticker works best with TradingView free widget
  return symbol.replace(/\.(BSE|NSE)$/i, "");
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();
  const { market } = useMarket();
  const currency = market.currency || "$";

  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"value" | "pnl" | "pnlpct">("value");

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      // Both requests in parallel
      const [holdingsRes, summaryRes] = await Promise.all([
        fetchWithAuth("/api/portfolio"),
        fetchWithAuth("/api/portfolio/summary"),
      ]);

      if (holdingsRes.ok) {
        const data: HoldingRow[] = await holdingsRes.json();
        setHoldings(Array.isArray(data) ? data : []);
      }
      if (summaryRes.ok) {
        const data: PortfolioSummary = await summaryRes.json();
        setSummary(data);
      }
    } catch {
      // Auth will redirect if token missing — don't swallow that
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  // Derived values — prefer backend summary, compute locally as fallback
  const totalValue  = summary?.totalValue  ?? holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost   = summary?.totalCost   ?? holdings.reduce((s, h) => s + h.avgPrice * h.qty, 0);
  const totalPnl    = summary?.totalPnl    ?? (totalValue - totalCost);
  const totalPnlPct = summary?.totalPnlPct ?? (totalCost > 0 ? (totalPnl / totalCost) * 100 : 0);
  const isUp = totalPnl >= 0;

  // CountUp animations
  const countedValue = useCountUp(Math.floor(totalValue));
  const countedCost = useCountUp(Math.floor(totalCost));
  const countedPnl = useCountUp(Math.floor(totalPnl));

  // Sector allocation (derive from symbol since backend doesn't return sector)
  const SECTOR_MAP: Record<string, string> = {
    NVDA: "Technology", AAPL: "Technology", MSFT: "Technology", ADBE: "Technology",
    AMD: "Technology", TSLA: "Consumer", KO: "Consumer",
    RELIANCE: "Energy", TCS: "IT", INFY: "IT", WIPRO: "IT", HDFCBANK: "Banking",
  };
  const sectorTotals: Record<string, number> = {};
  holdings.forEach(h => {
    const sym = h.symbol.replace(/\.(BSE|NSE)$/i, "");
    const sector = SECTOR_MAP[sym] ?? "Other";
    sectorTotals[sector] = (sectorTotals[sector] ?? 0) + h.marketValue;
  });
  const sectorData = Object.entries(sectorTotals).map(([name, value], i) => ({
    name, value, color: SECTOR_COLORS[i % SECTOR_COLORS.length],
  }));

  const sorted = [...holdings].sort((a, b) =>
    sortBy === "value" ? b.marketValue - a.marketValue
    : sortBy === "pnl" ? b.pnl - a.pnl
    : b.pnlPct - a.pnlPct
  );

  const fmt = (n: number) =>
    `${currency}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleExportCsv = () => exportPortfolioCsv(holdings);

  return (
    <div style={{
      padding: "24px 32px", maxWidth: 1200, margin: "0 auto",
      fontFamily: "'Geist','Inter',sans-serif", background: C.page, minHeight: "100vh",
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>
            My Portfolio
          </h1>
          <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>
            {market.flag} {market.label} · {holdings.length} positions
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleExportCsv}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={loadPortfolio}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer", color: "#0a0a0a", fontWeight: 700, fontSize: 13 }}>
            <Plus size={14} /> Add Position
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 14, marginBottom: 24 }} className="stats-grid">
        <style>{`
          @media (max-width: 1024px) {
            .stats-grid { grid-template-columns: 1fr 1fr !important; }
          }
          @media (max-width: 640px) {
            .stats-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 120, background: `radial-gradient(ellipse at right, ${isUp ? "#8FFFD6" : "#ef4444"}08 0%, transparent 70%)`, pointerEvents: "none" }} />
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>Total Value</p>
          <p style={{ color: C.primary, fontWeight: 800, fontSize: 28, margin: 0, letterSpacing: -0.5 }}>
            {currency}{countedValue.toLocaleString("en-US")}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            {isUp ? <TrendingUp size={13} color="#22c55e" /> : <TrendingDown size={13} color="#ef4444" />}
            <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
              {isUp ? "+" : ""}{fmt(totalPnl)} ({isUp ? "+" : ""}{totalPnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>
        {[
          { label: "Total Cost",     value: countedCost, isFormatted: true, color: C.muted },
          { label: "Unrealized P&L", value: countedPnl, isFormatted: true, color: isUp ? "#22c55e" : "#ef4444" },
          { label: "Positions",      value: holdings.length, isFormatted: false, color: "#8FFFD6" },
        ].map(({ label, value, isFormatted, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" }}>
            <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>{label}</p>
            <p style={{ color, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: -0.3 }}>
              {label === "Positions" ? value : `${isUp && label === "Unrealized P&L" ? "+" : ""}${currency}${value.toLocaleString("en-US")}`}
            </p>
          </div>
        ))}
      </div>

      {/* Chart + Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, marginBottom: 24 }} className="chart-donut-grid">
        <style>{`
          @media (max-width: 768px) {
            .chart-donut-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" }}>
          <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: "0 0 16px" }}>Portfolio Performance</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={PORTFOLIO_HISTORY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8FFFD6" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#8FFFD6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 11 }}
                itemStyle={{ color: "#8FFFD6" }} labelStyle={{ color: C.muted }} />
              <Area type="monotone" dataKey="v" stroke="#8FFFD6" strokeWidth={2} fill="url(#pg)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" }}>
          <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: "0 0 12px" }}>Allocation</p>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={sectorData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} dataKey="value" stroke="none">
                {sectorData.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => [`${currency}${Number(v).toLocaleString()}`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {sectorData.map(s => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  <span style={{ color: C.muted, fontSize: 11 }}>{s.name}</span>
                </div>
                <span style={{ color: C.primary, fontSize: 11, fontWeight: 600 }}>
                  {totalValue > 0 ? ((s.value / totalValue) * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
          <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>Holdings</p>
          <div style={{ display: "flex", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: 3, gap: 2 }}>
            {(["value", "pnl", "pnlpct"] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 10, fontWeight: 600,
                background: sortBy === s ? C.card : "transparent",
                color: sortBy === s ? "#8FFFD6" : C.muted,
              }}>
                {s === "value" ? "Value" : s === "pnl" ? "P&L $" : "P&L %"}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 80px", padding: "10px 20px", borderBottom: `1px solid ${C.line}` }} className="table-header">
          <style>{`
            @media (max-width: 1024px) {
              .table-header { grid-template-columns: 2fr 1fr 1fr 80px !important; }
              .table-header span:nth-child(3),
              .table-header span:nth-child(4),
              .table-header span:nth-child(5) { display: none; }
            }
            @media (max-width: 640px) {
              .table-header { grid-template-columns: 1fr 1fr 80px !important; }
              .table-header span:nth-child(2),
              .table-header span:nth-child(3),
              .table-header span:nth-child(4),
              .table-header span:nth-child(5) { display: none; }
            }
          `}</style>
          {["Asset", "Qty", "Avg Price", "Current", "Market Value", "P&L", ""].map(h => (
            <span key={h} style={{ color: C.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: C.muted, fontSize: 13 }}>Loading holdings…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ color: "#8FFFD6", fontSize: 32, margin: "0 0 12px" }}>📈</p>
            <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No holdings yet</p>
            <p style={{ color: C.muted, fontSize: 13, margin: "0 0 20px" }}>Start building your portfolio by placing your first order.</p>
            <button onClick={() => router.push("/dashboard")} style={{ padding: "10px 20px", background: "#8FFFD6", borderRadius: 10, border: "none", color: "#0a0a0a", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Browse Stocks
            </button>
          </div>
        ) : (
          sorted.map((h, i) => {
            const up = h.pnl >= 0;
            const sym = h.symbol.replace(/\.(BSE|NSE)$/i, "");
            const { color, bg } = SYMBOL_COLORS[sym] ?? DEFAULT_COLOR;
            const navSymbol = toTradingViewSymbol(h.symbol);
            return (
              <div key={h.symbol}
                onClick={() => router.push(`/dashboard/stock/${navSymbol}?market=${market.id}`)}
                style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 80px", padding: "14px 20px", borderBottom: i < sorted.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer", transition: "background 0.15s", alignItems: "center" }}
                className="table-row"
                onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <style>{`
                  @media (max-width: 1024px) {
                    .table-row { grid-template-columns: 2fr 1fr 1fr 80px !important; }
                    .table-row span:nth-child(3),
                    .table-row span:nth-child(4),
                    .table-row span:nth-child(5),
                    .table-row div:nth-child(6) { display: none; }
                  }
                  @media (max-width: 640px) {
                    .table-row { grid-template-columns: 1fr 1fr 80px !important; }
                    .table-row span:nth-child(2),
                    .table-row span:nth-child(3),
                    .table-row span:nth-child(4),
                    .table-row span:nth-child(5),
                    .table-row div:nth-child(6) { display: none; }
                  }
                `}</style>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StockAvatar symbol={h.symbol} color={color} bg={bg} size={34} />
                  <div>
                    <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>{sym}</p>
                    <p style={{ color: C.muted, fontSize: 11, margin: "2px 0 0", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</p>
                  </div>
                </div>
                <span style={{ color: C.muted, fontSize: 13 }}>{h.qty.toLocaleString()}</span>
                <span style={{ color: C.muted, fontSize: 13 }}>{currency}{h.avgPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span style={{ color: C.primary, fontSize: 13, fontWeight: 500 }}>{currency}{h.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span style={{ color: C.primary, fontSize: 13, fontWeight: 600 }}>{currency}{h.marketValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <div>
                  <p style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {up ? "+" : ""}{currency}{Math.abs(h.pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 10, margin: "2px 0 0", opacity: 0.7 }}>
                    {up ? "+" : ""}{h.pnlPct.toFixed(2)}%
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); router.push(`/dashboard/stock/${navSymbol}?market=${market.id}`); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  Trade <ArrowUpRight size={11} />
                </button>
              </div>
            );
          })
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
