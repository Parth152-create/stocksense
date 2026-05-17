"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, BarChart2, Shield,
  PieChart, Activity, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useMarket } from "@/hooks/useMarket";
import { fetchWithAuth } from "@/lib/auth";

type TimeRange = "1M" | "1Y" | "All";

interface PortfolioPoint { date: string; value: number; }
interface AnalyticsData {
  totalValue: number;
  changePercent: number;
  allocation: { label: string; pct: number }[];
}

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
  hover:   "var(--color-surface-hover)",
};

const SECTOR_COLORS = ["#8FFFD6", "#6366f1", "#f59e0b", "#ef4444", "#a855f7", "#ec4899"];

// ─── Mock chart data generators ───────────────────────────────────────────────

function generateHistory(range: TimeRange, seed = 0): PortfolioPoint[] {
  const points = range === "1M" ? 30 : range === "1Y" ? 52 : 120;
  const data: PortfolioPoint[] = [];
  let v = 72000 + seed * 8000;
  for (let i = points; i >= 0; i--) {
    const d = new Date();
    if (range === "1M")      d.setDate(d.getDate() - i);
    else if (range === "1Y") d.setDate(d.getDate() - i * 7);
    else                     d.setDate(d.getDate() - i * 3);
    v += (Math.random() - 0.46 + seed * 0.02) * 2200;
    const label =
      range === "1M"
        ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : range === "1Y"
        ? d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
        : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    data.push({ date: label, value: Math.max(40000, Math.round(v)) });
  }
  return data;
}

// Generate multi-portfolio data by merging multiple seeds
function generateMultiPortfolio(range: TimeRange) {
  const base   = generateHistory(range, 0);
  const growth = generateHistory(range, 1);
  const crypto = generateHistory(range, 2);
  return base.map((p, i) => ({
    date:    p.date,
    overall: p.value,
    growth:  growth[i]?.value ?? p.value,
    crypto:  crypto[i]?.value ?? p.value,
  }));
}

// ─── Risk Gauge ───────────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  const r = 72, cx = 100, cy = 96;
  const circ = Math.PI * r;
  const progress = (score / 100) * circ;
  const color = score < 40 ? "#8FFFD6" : score < 70 ? "#f59e0b" : "#ef4444";
  const label = score < 30 ? "Low" : score < 55 ? "Moderate" : score < 75 ? "Elevated" : "High";
  const angle = -180 + (score / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + 54 * Math.cos(rad), ny = cy + 54 * Math.sin(rad);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={200} height={110} viewBox="0 0 200 110">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--color-line)" strokeWidth={14} strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${progress} ${circ}`} />
        {[0, 25, 50, 75, 100].map(tick => {
          const a = -180 + (tick / 100) * 180, ar = (a * Math.PI) / 180;
          return <line key={tick} x1={cx + (r - 7) * Math.cos(ar)} y1={cy + (r - 7) * Math.sin(ar)} x2={cx + (r + 7) * Math.cos(ar)} y2={cy + (r + 7) * Math.sin(ar)} stroke="var(--color-line)" strokeWidth={1.5} />;
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill={color} />
        <text x={cx - r - 4} y={cy + 18} fill="var(--color-muted)" fontSize={10} textAnchor="middle">0</text>
        <text x={cx + r + 4} y={cy + 18} fill="var(--color-muted)" fontSize={10} textAnchor="middle">100</text>
      </svg>
      <div style={{ textAlign: "center", marginTop: -8 }}>
        <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: `${color}15`, color, border: `1px solid ${color}30` }}>{label} Risk</div>
      </div>
    </div>
  );
}

// ─── Allocation Donut ─────────────────────────────────────────────────────────

function AllocationDonut({ segments }: { segments: { label: string; pct: number; color: string }[] }) {
  const r = 44, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  let cum = 0;
  const slices = segments.map(s => {
    const da = `${(s.pct / 100) * circ} ${circ}`;
    const doff = -((cum / 100) * circ);
    cum += s.pct;
    return { ...s, dashArray: da, dashOffset: doff };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-line)" strokeWidth={16} />
        {slices.map(s => (
          <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={16}
            strokeDasharray={s.dashArray} strokeDashoffset={s.dashOffset}
            style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }} />
        ))}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="var(--color-primary)" fontSize={10} fontWeight={700}>Portfolio</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: C.muted, fontSize: 12 }}>{s.label}</span>
            <span style={{ color: C.primary, fontSize: 12, fontWeight: 600, marginLeft: "auto" }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

const PerfTooltip = ({ active, payload, label, sym }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 16px", fontSize: 12 }}>
      <p style={{ color: C.muted, marginBottom: 6 }}>{label}</p>
      <p style={{ color: "#8FFFD6", fontWeight: 600, margin: 0 }}>
        {sym}{Number(payload[0].value).toLocaleString("en-IN")}
      </p>
    </div>
  );
};

const MultiTooltip = ({ active, payload, label, sym }: any) => {
  if (!active || !payload?.length) return null;
  const colors: Record<string, string> = { overall: "#8FFFD6", growth: "#6366f1", crypto: "#f59e0b" };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 16px", fontSize: 12 }}>
      <p style={{ color: C.muted, marginBottom: 8 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[p.dataKey] ?? p.stroke }} />
          <span style={{ color: C.muted, textTransform: "capitalize" }}>{p.dataKey}:</span>
          <span style={{ color: colors[p.dataKey] ?? p.stroke, fontWeight: 600 }}>
            {sym}{Number(p.value).toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, change, positive, currencySymbol }: {
  label: string; value: string; change: string; positive: boolean; currencySymbol: string;
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" }}>
      <p style={{ color: C.muted, fontSize: 11, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</p>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.primary, letterSpacing: -0.5, marginBottom: 8 }}>
        {currencySymbol}{value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: positive ? "rgba(143,255,214,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${positive ? "rgba(143,255,214,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          {positive ? <ArrowUpRight size={12} color="#8FFFD6" /> : <ArrowDownRight size={12} color="#ef4444" />}
          <span style={{ color: positive ? "#8FFFD6" : "#ef4444", fontSize: 12, fontWeight: 600 }}>{change}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Portfolio summary cards matching Figma ───────────────────────────────────

const PORTFOLIO_CARDS = [
  { label: "Overall Portfolio", value: "$5,300", change: "+$117.68", changePct: "+4.75%", positive: true,  color: "#8FFFD6" },
  { label: "Growth Portfolio",  value: "$5,300", change: "+$117.68", changePct: "+4.75%", positive: true,  color: "#6366f1" },
  { label: "Causal Portfolio",  value: "$5,300", change: "-$132.45", changePct: "-1.32%", positive: false, color: "#f59e0b" },
];

const MONTHLY = [
  { month: "Jan", ret: 4.2 }, { month: "Feb", ret: -1.8 }, { month: "Mar", ret: 6.7 },
  { month: "Apr", ret: 2.1 }, { month: "May", ret: -3.4 }, { month: "Jun", ret: 5.8 },
  { month: "Jul", ret: 8.2 }, { month: "Aug", ret: -0.9 }, { month: "Sep", ret: 3.1 },
  { month: "Oct", ret: -2.2 }, { month: "Nov", ret: 7.4 }, { month: "Dec", ret: 1.9 },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { market } = useMarket();
  const sym = market?.currency ?? "₹";

  const [range,     setRange]     = useState<TimeRange>("1Y");
  const [multiRange, setMultiRange] = useState<TimeRange>("1Y");
  const [history,   setHistory]   = useState<PortfolioPoint[]>([]);
  const [multiData, setMultiData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { setHistory(generateHistory(range)); }, [range]);
  useEffect(() => { setMultiData(generateMultiPortfolio(multiRange)); }, [multiRange]);

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/market/${market.id}/analytics`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAnalytics(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [market.id]);

  const allocSegs = analytics?.allocation?.length
    ? analytics.allocation.map((a, i) => ({ label: a.label, pct: a.pct, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }))
    : [
        { label: "Stocks",  pct: 48, color: "#8FFFD6" },
        { label: "Crypto",  pct: 30, color: "#6366f1" },
        { label: "Bonds",   pct: 22, color: "#f59e0b" },
      ];

  const totalValue = analytics?.totalValue ?? 93314;
  const changePct  = analytics?.changePercent ?? 6.42;
  const isUp       = changePct >= 0;

  return (
    <>
      <style>{`.range-pill:hover { opacity: 0.8; }`}</style>
      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto", background: C.page, minHeight: "100vh", animation: "fadeInUp 0.35s ease both" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <BarChart2 size={20} color="#8FFFD6" />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.primary, margin: 0 }}>Performance Analytics</h1>
          </div>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Track your portfolio performance, risk exposure, and asset allocation</p>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
          <StatCard label="Portfolio Value"  value={totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })} change={`${isUp?"+":""}${changePct.toFixed(2)}%`} positive={isUp}  currencySymbol={sym} />
          <StatCard label="Total Invested"   value="82,416.00" change="+4.75%"  positive={true}  currencySymbol={sym} />
          <StatCard label="Unrealised P&L"   value="10,898.00" change="-2.13%"  positive={false} currencySymbol={sym} />
        </div>

        {/* ── Multi-portfolio comparison — matches Figma Page 3 ── */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "22px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={15} color="#8FFFD6" />
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>Portfolio Comparison</span>
            </div>
            <div style={{ display: "flex", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: 3, gap: 2 }}>
              {(["1M", "1Y", "All"] as TimeRange[]).map(r => (
                <button key={r} className="range-pill" onClick={() => setMultiRange(r)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: multiRange === r ? C.card : "transparent", color: multiRange === r ? "#8FFFD6" : C.muted }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
            {PORTFOLIO_CARDS.map(p => (
              <div key={p.label} style={{ background: C.page, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                  <span style={{ color: C.muted, fontSize: 11 }}>{p.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.primary, letterSpacing: -0.3 }}>{p.value}</div>
                <div style={{ fontSize: 11, color: p.positive ? "#8FFFD6" : "#ef4444", marginTop: 4, fontWeight: 600 }}>
                  {p.change} ({p.changePct})
                </div>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={multiData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(multiData.length / 8)} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${(v/1000).toFixed(0)}k`} width={56} domain={["auto","auto"]} />
              <Tooltip content={(p: any) => <MultiTooltip {...p} sym={sym} />} />
              <Line type="monotone" dataKey="overall" stroke="#8FFFD6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#8FFFD6", strokeWidth: 0 }} name="Overall" />
              <Line type="monotone" dataKey="growth"  stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }} name="Growth"  />
              <Line type="monotone" dataKey="crypto"  stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }} name="Crypto"  />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Single portfolio performance */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "22px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={15} color="#8FFFD6" />
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>Portfolio Value Over Time</span>
            </div>
            <div style={{ display: "flex", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: 3, gap: 2 }}>
              {(["1M", "1Y", "All"] as TimeRange[]).map(r => (
                <button key={r} className="range-pill" onClick={() => setRange(r)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: range === r ? C.card : "transparent", color: range === r ? "#8FFFD6" : C.muted }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(history.length / 8)} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${(v / 1000).toFixed(0)}k`} width={56} domain={["auto", "auto"]} />
              <Tooltip content={(p: any) => <PerfTooltip {...p} sym={sym} />} />
              <Line type="monotone" dataKey="value" stroke="#8FFFD6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#8FFFD6", strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk + Allocation */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14, marginBottom: 20 }}>

          {/* Risk */}
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <Shield size={15} color="#8FFFD6" />
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>Risk Assessment</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted, background: C.page, border: `1px solid ${C.line}`, padding: "2px 8px", borderRadius: 5 }}>AI-powered</span>
            </div>
            <RiskGauge score={62} />
            <div style={{ marginTop: 24 }}>
              {[
                { label: "Market Volatility",  val: 68, color: "#f59e0b" },
                { label: "Concentration Risk", val: 42, color: "#8FFFD6" },
                { label: "Liquidity Risk",     val: 28, color: "#8FFFD6" },
                { label: "Currency Exposure",  val: 55, color: "#f59e0b" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
                    <span style={{ fontSize: 12, color, fontWeight: 600 }}>{val}</span>
                  </div>
                  <div style={{ height: 4, background: C.line, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${val}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Allocation */}
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <PieChart size={15} color="#8FFFD6" />
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>Asset Allocation</span>
            </div>
            <AllocationDonut segments={allocSegs} />
            <div style={{ marginTop: 28 }}>
              {[
                { label: "Best Performer",  value: "NVDA",     change: "+142%",      positive: true  },
                { label: "Worst Performer", value: "WIPRO",    change: "-18%",       positive: false },
                { label: "Most Held",       value: "AAPL",     change: "48 shares",  positive: true  },
                { label: "Highest Value",   value: "RELIANCE", change: `${sym}2.1L`, positive: true  },
              ].map(({ label, value, change, positive }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>{value}</span>
                    <span style={{ fontSize: 11, color: positive ? "#8FFFD6" : "#ef4444" }}>{change}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Returns Bar Chart */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "22px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <TrendingUp size={15} color="#8FFFD6" />
            <span style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>Monthly Returns</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MONTHLY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={18}>
              <XAxis dataKey="month" tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => [`${v > 0 ? "+" : ""}${v}%`, "Return"]}
                labelStyle={{ color: C.muted }} />
              <Bar dataKey="ret" radius={[4, 4, 0, 0]}>
                {MONTHLY.map((m, i) => (
                  <Cell key={i} fill={m.ret >= 0 ? "#8FFFD6" : "#ef4444"} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Return Heatmap */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <TrendingDown size={15} color="#8FFFD6" />
            <span style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>Return Heatmap</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 6 }}>
            {MONTHLY.map(({ month, ret }) => {
              const pos = ret >= 0;
              const intensity = Math.min(Math.abs(ret) / 10, 1);
              return (
                <div key={month} style={{
                  background: pos ? `rgba(143,255,214,${0.06 + intensity * 0.25})` : `rgba(239,68,68,${0.06 + intensity * 0.25})`,
                  border: `1px solid ${pos ? "rgba(143,255,214,0.15)" : "rgba(239,68,68,0.15)"}`,
                  borderRadius: 8, padding: "10px 4px", textAlign: "center",
                  transition: "transform 0.15s",
                }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{month}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: pos ? "#8FFFD6" : "#ef4444" }}>
                    {pos ? "+" : ""}{ret}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}