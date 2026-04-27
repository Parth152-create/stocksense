"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Zap,
  Plus,
  ArrowUpRight as Arrow,
  Maximize2,
  CreditCard,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Holding {
  id: number;
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice?: number;
}

interface Summary {
  investment: number;
  currentValue: number;
  profit: number;
}

// ── Mock chart data (matches FinLink Sep–Jun arc) ──────────────────────────────
const chartData = [
  { month: "Sep", value: 62000 },
  { month: "Oct", value: 58000 },
  { month: "Nov", value: 61000 },
  { month: "Dec", value: 57000 },
  { month: "Jan", value: 60000 },
  { month: "Feb", value: 63000 },
  { month: "Mar", value: 72000 },
  { month: "Apr", value: 80000 },
  { month: "May", value: 88000 },
  { month: "Jun", value: 93314 },
];

const events = [
  { month: "Oct", label: "NVIDIA Reports Strong Q3 Earnings", color: "#8FFFD6" },
  { month: "Mar", label: "Apple Reports Record Services Revenue", color: "#8FFFD6" },
  { month: "Mar", label: "Tesla Launches Full Self-Driving 2.0", color: "#ef4444" },
];

const mockTransactions = [
  { symbol: "TSLA", name: "Tesla", change: "+3", amount: -525, card: "••••4641", logo: "T", color: "#ef4444" },
  { symbol: "AAPL", name: "Apple", change: "-7", amount: +210, card: "••••8941", logo: "A", color: "#555" },
  { symbol: "AMD", name: "AMD", change: "+5", amount: -320, card: "••••4641", logo: "AMD", color: "#ef4444" },
  { symbol: "NVDA", name: "NVIDIA", change: "+12", amount: -890, card: "••••4641", logo: "N", color: "#76b900" },
];

// ── Ticker colors ──────────────────────────────────────────────────────────────
const LOGO_COLORS: Record<string, string> = {
  MSFT: "#00a4ef",
  ADBE: "#ff0000",
  NVDA: "#76b900",
  AAPL: "#555",
  KO: "#f40009",
};

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs">
        <p className="text-[#888] mb-1">{label}</p>
        <p className="text-white font-semibold">
          ${payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

// ── TIME RANGE buttons ─────────────────────────────────────────────────────────
const TIME_RANGES = ["1D", "7D", "1M", "1Y", "All"];

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState("1M");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch user info to get portfolioId
        const userRes = await fetch("http://127.0.0.1:8081/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = await userRes.json();
        const pid = user?.portfolioId;

        if (pid) {
          const [summaryRes, holdingsRes] = await Promise.all([
            fetch(`http://127.0.0.1:8081/api/portfolio/summary/${pid}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`http://127.0.0.1:8081/api/holdings/${pid}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
          const summaryData = await summaryRes.json();
          const holdingsData = await holdingsRes.json();
          setSummary(summaryData);
          setHoldings(holdingsData);
        }
      } catch {
        /* use mock data silently */
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const portfolioValue = summary?.currentValue ?? 93314.56;
  const portfolioProfit = summary?.profit ?? 8461.16;
  const profitPct = summary
    ? ((summary.profit / summary.investment) * 100).toFixed(2)
    : "8.32";
  const isProfit = portfolioProfit >= 0;

  const displayHoldings =
    holdings.length > 0
      ? holdings.slice(0, 6)
      : [
          { id: 1, symbol: "MSFT", quantity: 14, buyPrice: 380 },
          { id: 2, symbol: "ADBE", quantity: 36, buyPrice: 520 },
          { id: 3, symbol: "NVDA", quantity: 22, buyPrice: 610 },
          { id: 4, symbol: "AAPL", quantity: 48, buyPrice: 175 },
          { id: 5, symbol: "KO", quantity: 165, buyPrice: 62 },
        ];

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* ── Row 1: Chart + Trading Score ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        {/* Buy & Sell Activity */}
        <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white">Buy & Sell Activity</h2>
            <div className="flex items-center gap-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRange(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeRange === r
                      ? "bg-white text-black"
                      : "text-[#888888] hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
              <button className="ml-2 text-[#555] hover:text-white transition-colors">
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8FFFD6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#8FFFD6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f1f1f" strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#555", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#555", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#8FFFD6"
                strokeWidth={2}
                fill="url(#chartGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#8FFFD6", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Event pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            {events.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-3 py-1"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: e.color }}
                />
                <span className="text-[#888] text-[10px]">{e.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trading Score */}
        <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-5 flex flex-col justify-between overflow-hidden relative">
          {/* Background orb */}
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-[#8FFFD6]/5 blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-white">Trading Score</h2>
              <div className="w-8 h-8 rounded-lg bg-[#8FFFD6]/10 flex items-center justify-center">
                <TrendingUp size={14} className="text-[#8FFFD6]" />
              </div>
            </div>

            {/* 3D coin visual placeholder */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-4 border-[#2a2a2a] flex items-center justify-center shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8FFFD6] to-[#3dd9a4] flex items-center justify-center">
                    <TrendingUp size={28} className="text-black" strokeWidth={2.5} />
                  </div>
                </div>
                {/* Shadow coin behind */}
                <div className="absolute -right-3 -bottom-2 w-20 h-20 rounded-full bg-gradient-to-br from-[#8FFFD6]/40 to-[#3dd9a4]/40 -z-10 blur-sm" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-3xl font-bold text-white mb-1">
                ${(1184600).toLocaleString()}
              </p>
              <p className="text-[#555] text-xs mb-4">Total buy volume</p>

              <div className="flex items-center justify-center gap-2">
                <p className="text-2xl font-bold text-white">6,280</p>
                <div className="bg-[#8FFFD6]/10 rounded-lg px-2 py-1 flex items-center gap-1">
                  <Zap size={12} className="text-[#8FFFD6]" />
                  <span className="text-[#8FFFD6] text-xs font-medium">+124</span>
                </div>
              </div>
              <p className="text-[#555] text-xs mt-1">Trading points</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Holdings + Portfolio + Transactions ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-5">
        {/* Total Holdings */}
        <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Total holdings</h2>
            <button
              onClick={() => router.push("/dashboard/portfolio")}
              className="text-[#555] hover:text-white transition-colors"
            >
              <Arrow size={14} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-[#1a1a1a] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {displayHoldings.slice(0, 6).map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 bg-[#0a0a0a] rounded-xl p-2.5 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
                  onClick={() => router.push(`/dashboard/stock/${h.symbol}`)}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ background: LOGO_COLORS[h.symbol] ?? "#333" }}
                  >
                    {h.symbol.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-medium">{h.quantity} Shares</p>
                    <p className="text-[#555] text-[10px] truncate">{h.symbol}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trading Activity mini bar chart */}
          <div className="mt-4 pt-4 border-t border-[#1f1f1f]">
            <p className="text-xs text-[#555] mb-2">Trading Activity</p>
            <div className="flex items-end gap-1 h-10">
              {[4, 7, 5, 9, 6, 3, 8].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-all"
                  style={{
                    height: `${(h / 10) * 100}%`,
                    background: i === 3 ? "#8FFFD6" : "#1f1f1f",
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className="text-[10px] text-[#444] flex-1 text-center">
                  {d}
                </span>
              ))}
            </div>
            <p className="text-white font-semibold text-sm mt-2">
              48 <span className="text-[#555] font-normal text-xs">/trades</span>
            </p>
          </div>
        </div>

        {/* My Portfolio */}
        <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">My Portfolio</h2>
            <button className="flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
              <Plus size={12} />
              Deposit
            </button>
          </div>

          <div className="mb-1">
            <p className="text-3xl font-bold text-white">
              ${portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`flex items-center gap-1 text-sm font-medium ${
                  isProfit ? "text-[#22c55e]" : "text-[#ef4444]"
                }`}
              >
                {isProfit ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {isProfit ? "+" : "-"}$
                {Math.abs(portfolioProfit).toLocaleString("en-US", { minimumFractionDigits: 2 })} this month
              </span>
            </div>
          </div>

          {/* Allocation bars */}
          <div className="mt-6 space-y-3">
            {[
              { label: "Stocks", pct: 40, color: "#8FFFD6" },
              { label: "Crypto", pct: 30, color: "#a78bfa" },
              { label: "Funds", pct: 22, color: "#60a5fa" },
              { label: "Other", pct: 8, color: "#f59e0b" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[#888]">{item.label}</span>
                  <span className="text-xs text-white font-medium">{item.pct}%</span>
                </div>
                <div className="h-1.5 bg-[#1f1f1f] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${item.pct}%`, background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Mini bar chart */}
          <div className="mt-5 flex items-end gap-0.5 h-16">
            {Array.from({ length: 28 }, (_, i) => {
              const h = 20 + Math.sin(i * 0.8) * 15 + Math.random() * 20;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${Math.max(10, h)}%`,
                    background:
                      i > 20
                        ? `rgba(143,255,214,${0.4 + (i - 20) * 0.06})`
                        : "#1f1f1f",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Transactions</h2>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white transition-colors text-xs">
                ⌕
              </button>
              <button className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white transition-colors text-xs">
                ⇅
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#555]">Today</span>
            <span className="text-xs text-[#555]">5 Transactions</span>
          </div>

          <div className="space-y-2">
            {mockTransactions.map((tx, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#1a1a1a] transition-colors cursor-pointer"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: tx.color }}
                >
                  {tx.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium">{tx.symbol}</p>
                  <div className="flex items-center gap-1">
                    <CreditCard size={9} className="text-[#444]" />
                    <span className="text-[#555] text-[10px]">{tx.card}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[#555] text-[10px] block">
                    {parseInt(tx.change) > 0 ? "+" : ""}{tx.change}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                      tx.amount < 0
                        ? "bg-red-500/10 text-red-400"
                        : "bg-[#8FFFD6]/10 text-[#8FFFD6]"
                    }`}
                  >
                    {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push("/dashboard/portfolio")}
            className="w-full mt-4 py-2 rounded-xl border border-[#1f1f1f] text-[#555] text-xs hover:border-[#333] hover:text-white transition-colors"
          >
            View all transactions
          </button>
        </div>
      </div>
    </div>
  );
}