"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, BarChart2, Shield,
  PieChart, Activity, ArrowUpRight, ArrowDownRight, GitCompare,
} from "lucide-react";
import { useMarket } from "@/hooks/useMarket";
import { fetchWithAuth } from "@/lib/auth";

type TimeRange = "1M" | "1Y" | "All";

interface AnalyticsData {
  totalValue:    number;
  totalInvested: number;
  changePercent: number;
  allocation:    { label: string; pct: number }[];
  bestPerformer:  { symbol: string; changePct: number } | null;
  worstPerformer: { symbol: string; changePct: number } | null;
  mostHeld:       { symbol: string; quantity: number } | null;
  monthlyReturns: { month: string; returnPct: number; ret: number }[];
  riskScore:      number;
}

interface HistoryPoint  { date: string; value: number; }
interface BenchmarkPoint {
  date:           string;
  portfolio:      number;
  portfolioRaw:   number;
  benchmark:      number | null;
  benchmarkLabel: string;
}

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
  hover:   "var(--color-surface-hover)",
};

const fadeUp  = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };
const cardV   = { hidden: { opacity: 0, y: 20, scale: 0.98 }, visible: { opacity: 1, y: 0, scale: 1 } };

const SECTOR_COLORS = ["#8FFFD6", "#6366f1", "#f59e0b", "#ef4444", "#a855f7", "#ec4899"];

const useCountUp = (target: number, duration = 1500) => {
  const [count, setCount] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current !== null) cancelAnimationFrame(ref.current); };
  }, [target, duration]);
  return count;
};

// ── Risk Gauge ────────────────────────────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const r = 72, cx = 100, cy = 96;
  const circ    = Math.PI * r;
  const progress = (score / 100) * circ;
  const color   = score < 40 ? "#8FFFD6" : score < 70 ? "#f59e0b" : "#ef4444";
  const label   = score < 30 ? "Low" : score < 55 ? "Moderate" : score < 75 ? "Elevated" : "High";
  const angle   = -180 + (score / 100) * 180;
  const rad     = (angle * Math.PI) / 180;
  const nx = cx + 54 * Math.cos(rad), ny = cy + 54 * Math.sin(rad);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={200} height={110} viewBox="0 0 200 110">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--color-line)" strokeWidth={14} strokeLinecap="round"/>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${progress} ${circ}`}/>
        {[0,25,50,75,100].map(tick => {
          const a = -180+(tick/100)*180, ar = (a*Math.PI)/180;
          return <line key={tick} x1={cx+(r-7)*Math.cos(ar)} y1={cy+(r-7)*Math.sin(ar)} x2={cx+(r+7)*Math.cos(ar)} y2={cy+(r+7)*Math.sin(ar)} stroke="var(--color-line)" strokeWidth={1.5}/>;
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={2.5} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={5} fill={color}/>
        <text x={cx-r-4} y={cy+18} fill="var(--color-muted)" fontSize={10} textAnchor="middle">0</text>
        <text x={cx+r+4} y={cy+18} fill="var(--color-muted)" fontSize={10} textAnchor="middle">100</text>
      </svg>
      <div style={{ textAlign: "center", marginTop: -8 }}>
        <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: `${color}15`, color, border: `1px solid ${color}30` }}>{label} Risk</div>
      </div>
    </div>
  );
}

// ── Allocation Donut ──────────────────────────────────────────────────────────
function AllocationDonut({ segments }: { segments: { label: string; pct: number; color: string }[] }) {
  const r = 44, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  const slices = segments.map((s, i) => {
    const prev = segments.slice(0, i).reduce((sum, seg) => sum + seg.pct, 0);
    return { ...s, dashArray: `${(s.pct/100)*circ} ${circ}`, dashOffset: -((prev/100)*circ) };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-line)" strokeWidth={16}/>
        {slices.map(s => (
          <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={16}
            strokeDasharray={s.dashArray} strokeDashoffset={s.dashOffset}
            style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }}/>
        ))}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="var(--color-primary)" fontSize={10} fontWeight={700}>Portfolio</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }}/>
            <span style={{ color: C.muted, fontSize: 12 }}>{s.label}</span>
            <span style={{ color: C.primary, fontSize: 12, fontWeight: 600, marginLeft: "auto" }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
const PerfTooltip = ({ active, payload, label, sym }: { active?: boolean; payload?: any; label?: unknown; sym: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: C.muted, marginBottom: 4, margin: "0 0 4px" }}>{String(label ?? "")}</p>
      <p style={{ color: "#8FFFD6", fontWeight: 600, margin: 0 }}>{sym}{Number(payload[0].value).toLocaleString("en-IN")}</p>
    </div>
  );
};

const BenchmarkTooltip = ({ active, payload, label }: { active?: boolean; payload?: any; label?: unknown }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 150 }}>
      <p style={{ color: C.muted, margin: "0 0 6px" }}>{String(label ?? "")}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.stroke ?? "#8FFFD6", fontWeight: 600, margin: "3px 0 0", display: "flex", justifyContent: "space-between", gap: 14 }}>
          <span style={{ color: C.muted, fontWeight: 400 }}>{String(p.name ?? "")}</span>
          <span>{Number(p.value).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
        </p>
      ))}
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, change, positive, currencySymbol }: {
  label: string; value: string; change: string; positive: boolean; currencySymbol: string;
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
      <p style={{ color: C.muted, fontSize: 11, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</p>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.primary, letterSpacing: -0.5, marginBottom: 8 }}>
        {currencySymbol}{value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: positive ? "rgba(143,255,214,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${positive ? "rgba(143,255,214,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          {positive ? <ArrowUpRight size={12} color="#8FFFD6"/> : <ArrowDownRight size={12} color="#ef4444"/>}
          <span style={{ color: positive ? "#8FFFD6" : "#ef4444", fontSize: 12, fontWeight: 600 }}>{change}</span>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ w, h = 16 }: { w: string | number; h?: number }) {
  return <div style={{ width: w, height: h, borderRadius: 4, background: "var(--color-line)", opacity: 0.5 }}/>;
}

function BenchmarkDelta({ data, benchmarkLabel }: { data: BenchmarkPoint[]; benchmarkLabel: string }) {
  if (data.length < 2) return null;
  const last = data[data.length - 1];
  if (last.benchmark == null) return null;
  const portDelta  = ((last.portfolio - 10_000) / 10_000) * 100;
  const benchDelta = ((last.benchmark - 10_000) / 10_000) * 100;
  const alpha      = portDelta - benchDelta;
  const beating    = alpha >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, background: beating ? "rgba(143,255,214,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${beating ? "rgba(143,255,214,0.2)" : "rgba(239,68,68,0.2)"}` }}>
      {beating ? <ArrowUpRight size={12} color="#8FFFD6"/> : <ArrowDownRight size={12} color="#ef4444"/>}
      <span style={{ fontSize: 11, fontWeight: 700, color: beating ? "#8FFFD6" : "#ef4444" }}>
        {beating ? "+" : ""}{alpha.toFixed(1)}% vs {benchmarkLabel}
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { market } = useMarket();
  const sym = market?.currency ?? "$";

  const [range,            setRange]            = useState<TimeRange>("1Y");
  const [analytics,        setAnalytics]        = useState<AnalyticsData | null>(null);
  const [history,          setHistory]          = useState<HistoryPoint[]>([]);
  const [benchmark,        setBenchmark]        = useState<BenchmarkPoint[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setAnalytics(null); setHistory([]); setBenchmark([]);
    Promise.all([
      fetchWithAuth(`/api/market/${market.id}/analytics`),
      fetchWithAuth(`/api/portfolio/history?range=${range}`),
      fetchWithAuth(`/api/portfolio/benchmark?range=${range}&market=${market.id}`),
    ])
      .then(async ([analyticsRes, historyRes, benchRes]) => {
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
        if (historyRes.ok) { const d: HistoryPoint[] = await historyRes.json(); if (Array.isArray(d) && d.length >= 2) setHistory(d); }
        if (benchRes.ok)   { const d: BenchmarkPoint[] = await benchRes.json(); if (Array.isArray(d) && d.length >= 2) setBenchmark(d); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [market.id]);

  useEffect(() => {
    setBenchmarkLoading(true);
    Promise.all([
      fetchWithAuth(`/api/portfolio/history?range=${range}`),
      fetchWithAuth(`/api/portfolio/benchmark?range=${range}&market=${market.id}`),
    ])
      .then(async ([histRes, benchRes]) => {
        if (histRes.ok)  { const d: HistoryPoint[] = await histRes.json(); if (Array.isArray(d) && d.length >= 2) setHistory(d); }
        if (benchRes.ok) { const d: BenchmarkPoint[] = await benchRes.json(); if (Array.isArray(d) && d.length >= 2) setBenchmark(d); }
      })
      .catch(() => {})
      .finally(() => setBenchmarkLoading(false));
  }, [range]);

  const totalValue    = analytics?.totalValue    ?? 0;
  const totalInvested = analytics?.totalInvested ?? 0;
  const changePct     = analytics?.changePercent ?? 0;
  const isUp          = changePct >= 0;
  const unrealisedPnl = totalValue - totalInvested;
  const unrealisedPct = totalInvested > 0 ? (unrealisedPnl / totalInvested) * 100 : 0;
  const riskScore     = analytics?.riskScore ?? 0;

  const countedTotalValue    = useCountUp(Math.floor(totalValue));
  const countedTotalInvested = useCountUp(Math.floor(totalInvested));
  const countedUnrealisedPnl = useCountUp(Math.abs(Math.floor(unrealisedPnl)));

  const allocSegs = (analytics?.allocation ?? []).length > 0
    ? analytics!.allocation.map((a, i) => ({ label: a.label, pct: a.pct, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }))
    : [{ label: "Stocks", pct: 100, color: "#8FFFD6" }];

  const monthlyData = (analytics?.monthlyReturns ?? []).map(r => ({ month: r.month, ret: r.ret ?? r.returnPct ?? 0 }));

  const riskBars = [
    { label: "Market Volatility",  val: Math.min(Math.round(riskScore * 1.1), 99), color: riskScore > 60 ? "#ef4444" : "#f59e0b" },
    { label: "Concentration Risk", val: Math.min(Math.round(riskScore * 0.68), 99), color: riskScore < 50 ? "#8FFFD6" : "#f59e0b" },
    { label: "Liquidity Risk",     val: Math.min(Math.round(riskScore * 0.45), 99), color: "#8FFFD6" },
    { label: "Currency Exposure",  val: Math.min(Math.round(riskScore * 0.88), 99), color: riskScore > 55 ? "#f59e0b" : "#8FFFD6" },
  ];

  const best  = analytics?.bestPerformer;
  const worst = analytics?.worstPerformer;
  const most  = analytics?.mostHeld;

  const benchmarkLabel = benchmark.length > 0
    ? benchmark[0].benchmarkLabel
    : market.id === "IN" ? "Nifty 50" : market.id === "CRYPTO" ? "Bitcoin" : "S&P 500";

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Stat grid: 3 → 1 */
        .an-stat-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
        @media (max-width: 640px) { .an-stat-grid { grid-template-columns: 1fr; } }

        /* Risk + Allocation: 2 → 1 */
        .an-risk-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        @media (max-width: 768px) { .an-risk-grid { grid-template-columns: 1fr; } }

        /* Heatmap: 12 → 6 → 4 cols */
        .an-heatmap { grid-template-columns: repeat(12, minmax(0,1fr)); }
        @media (max-width: 768px) { .an-heatmap { grid-template-columns: repeat(6, minmax(0,1fr)); } }
        @media (max-width: 400px) { .an-heatmap { grid-template-columns: repeat(4, minmax(0,1fr)); } }

        /* Benchmark bottom row: wrap on mobile */
        .an-bench-bottom { flex-wrap: nowrap; }
        @media (max-width: 480px) { .an-bench-bottom { flex-direction: column; gap: 12px; } .an-bench-bottom > div { border-right: none !important; border-bottom: 1px solid var(--color-line); padding: 8px 0 !important; } }

        /* Header: wrap */
        .an-header { flex-wrap: wrap; gap: 8px; }

        /* Chart header: wrap on mobile */
        .an-chart-header { flex-wrap: wrap; gap: 8px; }
      `}</style>

      <motion.div initial="hidden" animate="visible" variants={stagger}
        style={{ padding: "16px", maxWidth: 1200, margin: "0 auto", background: C.page, minHeight: "100vh", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)", boxSizing: "border-box" }}>

        {/* Header */}
        <motion.div variants={fadeUp} className="an-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <BarChart2 size={18} color="#8FFFD6"/>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.primary, margin: 0 }}>Analytics</h1>
            </div>
            <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>Performance, risk, and allocation</p>
          </div>
        </motion.div>

        {/* Stat cards */}
        <motion.div variants={stagger} className="an-stat-grid" style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
                <Skeleton w="60%" h={11}/><div style={{ marginTop: 10 }}><Skeleton w="80%" h={24}/></div>
                <div style={{ marginTop: 8 }}><Skeleton w="40%" h={11}/></div>
              </div>
            ))
          ) : [
            { label: "Portfolio Value", value: countedTotalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 }), change: `${isUp?"+":""}${changePct.toFixed(2)}%`, positive: isUp, currencySymbol: sym },
            { label: "Total Invested",  value: countedTotalInvested.toLocaleString("en-IN", { minimumFractionDigits: 2 }), change: "Invested capital", positive: true, currencySymbol: sym },
            { label: "Unrealised P&L",  value: countedUnrealisedPnl.toLocaleString("en-IN", { minimumFractionDigits: 2 }), change: `${unrealisedPct >= 0 ? "+" : ""}${unrealisedPct.toFixed(2)}%`, positive: unrealisedPnl >= 0, currencySymbol: unrealisedPnl < 0 ? `-${sym}` : sym },
          ].map(props => (
            <motion.div key={props.label} variants={cardV} transition={{ duration: 0.4 }}
              whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
              <StatCard {...props}/>
            </motion.div>
          ))}
        </motion.div>

        {/* Portfolio Value Over Time */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 14, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <div className="an-chart-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={14} color="#8FFFD6"/>
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 13 }}>Portfolio Value</span>
              {history.length > 0 && (
                <span style={{ fontSize: 10, color: "#8FFFD6", background: "rgba(143,255,214,0.08)", border: "1px solid rgba(143,255,214,0.2)", borderRadius: 5, padding: "2px 7px" }}>Live</span>
              )}
            </div>
            <div style={{ display: "flex", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: 3, gap: 2 }}>
              {(["1M", "1Y", "All"] as TimeRange[]).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: range === r ? C.card : "transparent", color: range === r ? "#8FFFD6" : C.muted }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {history.length === 0 ? (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: C.muted, fontSize: 13 }}>{loading ? "Loading chart…" : "Not enough history yet."}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(history.length / 6)}/>
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${(v/1000).toFixed(0)}k`} width={50} domain={["auto","auto"]}/>
                <Tooltip content={(p) => <PerfTooltip {...p} sym={sym}/>}/>
                <Line type="monotone" dataKey="value" stroke="#8FFFD6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#8FFFD6", strokeWidth: 0 }}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Benchmark Comparison */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 14, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <div className="an-chart-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <GitCompare size={14} color="#8FFFD6"/>
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 13 }}>vs {benchmarkLabel}</span>
              <span style={{ fontSize: 10, color: C.muted, background: C.page, border: `1px solid ${C.line}`, padding: "2px 7px", borderRadius: 5 }}>Base 10k</span>
            </div>
            <BenchmarkDelta data={benchmark} benchmarkLabel={benchmarkLabel} />
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            {[{ color: "#8FFFD6", label: "My Portfolio" }, { color: "#6366f1", label: benchmarkLabel, dashed: true }].map(({ color, label, dashed }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 2, background: color, borderRadius: 1, borderTop: dashed ? `2px dashed ${color}` : undefined }}/>
                <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
              </div>
            ))}
          </div>

          {benchmarkLoading ? (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 22, height: 22, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
            </div>
          ) : benchmark.length < 2 ? (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: C.muted, fontSize: 13 }}>{loading ? "Loading…" : "Not enough history to compare."}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={benchmark} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(benchmark.length / 6)}/>
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.toLocaleString("en-US", { maximumFractionDigits: 0 })} width={50} domain={["auto","auto"]}/>
                <Tooltip content={(p) => <BenchmarkTooltip {...p}/>}/>
                <Line type="monotone" dataKey="portfolio" name="My Portfolio" stroke="#8FFFD6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#8FFFD6", strokeWidth: 0 }}/>
                <Line type="monotone" dataKey="benchmark" name={benchmarkLabel} stroke="#6366f1" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }} connectNulls/>
              </LineChart>
            </ResponsiveContainer>
          )}

          {benchmark.length >= 2 && (() => {
            const last       = benchmark[benchmark.length - 1];
            const portReturn = ((last.portfolio - 10_000) / 10_000) * 100;
            const benchRet   = last.benchmark != null ? ((last.benchmark - 10_000) / 10_000) * 100 : null;
            const alpha      = benchRet != null ? portReturn - benchRet : null;
            const fmt        = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
            const col        = (n: number) => n >= 0 ? "#22c55e" : "#ef4444";
            return (
              <div className="an-bench-bottom" style={{ display: "flex", marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                {[
                  { label: "Your Return",           value: fmt(portReturn), color: col(portReturn) },
                  { label: `${benchmarkLabel}`,     value: benchRet != null ? fmt(benchRet) : "—", color: benchRet != null ? col(benchRet) : C.muted },
                  { label: "Alpha",                 value: alpha != null ? fmt(alpha) : "—", color: alpha != null ? col(alpha) : C.muted },
                ].map(({ label, value, color }, i) => (
                  <div key={label} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? `1px solid ${C.line}` : "none", padding: "0 12px" }}>
                    <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px" }}>{label}</p>
                    <p style={{ color, fontSize: 16, fontWeight: 700, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </motion.div>

        {/* Risk + Allocation */}
        <div className="an-risk-grid" style={{ display: "grid", gap: 14, marginBottom: 14 }}>

          {/* Risk */}
          <motion.div variants={fadeUp} transition={{ duration: 0.4 }}
            style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Shield size={14} color="#8FFFD6"/>
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 13 }}>Risk Assessment</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: C.muted, background: C.page, border: `1px solid ${C.line}`, padding: "2px 7px", borderRadius: 5 }}>AI</span>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 0" }}>
                <Skeleton w={200} h={110}/><Skeleton w={80} h={36}/>
              </div>
            ) : <RiskGauge score={riskScore}/>}
            <div style={{ marginTop: 20 }}>
              {riskBars.map(({ label, val, color }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
                    <span style={{ fontSize: 12, color, fontWeight: 600 }}>{val}</span>
                  </div>
                  <div style={{ height: 4, background: C.line, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${val}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }}/>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Allocation */}
          <motion.div variants={fadeUp} transition={{ duration: 0.4 }}
            style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <PieChart size={14} color="#8FFFD6"/>
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 13 }}>Asset Allocation</span>
            </div>
            {loading ? (
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <Skeleton w={120} h={120}/><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1,2,3].map(i => <Skeleton key={i} w={120} h={14}/>)}</div>
              </div>
            ) : <AllocationDonut segments={allocSegs}/>}
            <div style={{ marginTop: 24 }}>
              {[
                { label: "Best Performer",  value: best?.symbol  ?? "—", change: best  ? `+${best.changePct.toFixed(1)}%`  : "—", positive: true  },
                { label: "Worst Performer", value: worst?.symbol ?? "—", change: worst ? `${worst.changePct.toFixed(1)}%`  : "—", positive: false },
                { label: "Most Held",       value: most?.symbol  ?? "—", change: most  ? `${most.quantity} shares`         : "—", positive: true  },
                { label: "Positions",       value: String(analytics ? (analytics.allocation?.length ?? 0) : 0), change: "asset classes", positive: true },
              ].map(({ label, value, change, positive }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>{value}</span>
                    <span style={{ fontSize: 11, color: positive ? "#8FFFD6" : "#ef4444" }}>{change}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Monthly Returns */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 14, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={14} color="#8FFFD6"/>
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 13 }}>Monthly Returns</span>
            </div>
            {monthlyData.length > 0 && (
              <span style={{ fontSize: 10, color: "#8FFFD6", background: "rgba(143,255,214,0.08)", border: "1px solid rgba(143,255,214,0.2)", borderRadius: 5, padding: "2px 7px" }}>
                {monthlyData.length} months
              </span>
            )}
          </div>
          {monthlyData.length === 0 ? (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: C.muted, fontSize: 13 }}>{loading ? "Loading…" : "No order history yet."}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={16}>
                <XAxis dataKey="month" tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`}/>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 11 }}
                  formatter={(v) => { const val = Number(v); return [`${val > 0 ? "+" : ""}${val.toFixed(2)}%`, "Return"]; }}
                  labelStyle={{ color: C.muted }}/>
                <Bar dataKey="ret" radius={[4,4,0,0]}>
                  {monthlyData.map((m, i) => <Cell key={i} fill={m.ret >= 0 ? "#8FFFD6" : "#ef4444"} fillOpacity={0.85}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Return Heatmap */}
        {monthlyData.length > 0 && (
          <motion.div variants={fadeUp} transition={{ duration: 0.4 }}
            style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 14, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <TrendingDown size={14} color="#8FFFD6"/>
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 13 }}>Return Heatmap</span>
            </div>
            <div className="an-heatmap" style={{ display: "grid", gap: 6 }}>
              {monthlyData.map(({ month, ret }, i) => {
                const pos       = ret >= 0;
                const intensity = Math.min(Math.abs(ret) / 10, 1);
                return (
                  <motion.div key={month}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    whileHover={{ scale: 1.05, zIndex: 1 }}
                    style={{ background: pos ? `rgba(143,255,214,${0.06 + intensity * 0.25})` : `rgba(239,68,68,${0.06 + intensity * 0.25})`, border: `1px solid ${pos ? "rgba(143,255,214,0.15)" : "rgba(239,68,68,0.15)"}`, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>{month}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: pos ? "#8FFFD6" : "#ef4444" }}>{pos ? "+" : ""}{ret.toFixed(1)}%</div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

      </motion.div>
    </>
  );
}