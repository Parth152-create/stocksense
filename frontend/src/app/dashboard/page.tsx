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
  BarChart,
  Bar,
  Cell,
} from "recharts";

type Summary = {
  investment: number;
  currentValue: number;
  profit: number;
};

const mockActivityData = [
  { date: "Sep", value: 4000 },
  { date: "Oct", value: 3800 },
  { date: "Nov", value: 5200 },
  { date: "Dec", value: 4900 },
  { date: "Jan", value: 6100 },
  { date: "Feb", value: 5800 },
  { date: "Mar", value: 7200 },
  { date: "Apr", value: 6900 },
  { date: "May", value: 8100 },
  { date: "Jun", value: 7800 },
];

const mockHoldings = [
  { symbol: "RELIANCE", name: "Reliance", shares: 14, color: "#3b82f6" },
  { symbol: "TCS", name: "TCS", shares: 8, color: "#f97316" },
  { symbol: "INFY", name: "Infosys", shares: 22, color: "#22c55e" },
  { symbol: "HDFC", name: "HDFC Bank", shares: 36, color: "#a855f7" },
];

const mockTransactions = [
  { symbol: "RELIANCE", name: "Reliance", type: "BUY", amount: "+₹12,450", color: "#ef4444" },
  { symbol: "TCS", name: "Tata Consultancy", type: "SELL", amount: "-₹8,200", color: "#3b82f6" },
  { symbol: "INFY", name: "Infosys", type: "BUY", amount: "+₹5,300", color: "#22c55e" },
  { symbol: "HDFC", name: "HDFC Bank", type: "BUY", amount: "+₹9,100", color: "#a855f7" },
];

const mockPortfolioData = [
  { name: "M", value: 30 },
  { name: "T", value: 55 },
  { name: "W", value: 40 },
  { name: "T", value: 70 },
  { name: "F", value: 45 },
  { name: "S", value: 60 },
  { name: "S", value: 80 },
];

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRange, setActiveRange] = useState("1M");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) { router.push("/login"); return; }

        const userRes = await fetch("http://localhost:8081/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userRes.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
        if (!userRes.ok) { setError("Failed to load user profile."); return; }

        const user = await userRes.json();
        const portfolioId = user.portfolioId;
        if (!portfolioId) { setError("No portfolio found for this account."); return; }

        const res = await fetch(`http://localhost:8081/api/portfolio/summary/${portfolioId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
        if (!res.ok) { setError("Failed to load portfolio summary."); return; }

        const result = await res.json();
        setData(result);
      } catch (err) {
        setError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-text-secondary">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="bg-surface-card p-8 rounded-2xl border border-border text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()}
            className="bg-white hover:bg-gray-100 text-black font-semibold px-6 py-2 rounded-lg">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const profitPercent = data.investment > 0
    ? ((data.profit / data.investment) * 100).toFixed(2)
    : "0.00";

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div className="p-6 bg-surface min-h-screen text-text-primary space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-text-secondary text-sm">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Total Investment</p>
          <h2 className="text-2xl font-bold">₹{fmt(data.investment)}</h2>
        </div>
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Current Value</p>
          <h2 className="text-2xl font-bold">₹{fmt(data.currentValue)}</h2>
        </div>
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Profit / Loss</p>
          <h2 className={`text-2xl font-bold ${data.profit >= 0 ? "text-bull" : "text-bear"}`}>
            {data.profit >= 0 ? "+" : ""}₹{fmt(data.profit)}
          </h2>
          <p className={`text-xs mt-1 ${data.profit >= 0 ? "text-bull" : "text-bear"}`}>
            {data.profit >= 0 ? "▲" : "▼"} {profitPercent}%
          </p>
        </div>
      </div>

      {/* Middle Row — Chart + Portfolio Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Buy & Sell Activity Chart */}
        <div className="lg:col-span-2 bg-surface-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Buy & Sell Activity</p>
            <div className="flex gap-1">
              {["1D", "7D", "1M", "1Y", "All"].map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRange(r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeRange === r
                      ? "bg-white text-black"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mockActivityData}>
              <defs>
                <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8FFFD6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8FFFD6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
            <Tooltip
  contentStyle={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 8, color: "#fff", fontSize: 12 }}
  formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Value"]}
/>
              <Area type="monotone" dataKey="value" stroke="#8FFFD6" strokeWidth={2} fill="url(#activityGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Portfolio Summary Card */}
        <div className="bg-surface-card rounded-2xl border border-border p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold">My Portfolio</p>
            </div>
            <h2 className="text-3xl font-bold mt-1">₹{fmt(data.currentValue)}</h2>
            <p className={`text-sm mt-1 ${data.profit >= 0 ? "text-bull" : "text-bear"}`}>
              {data.profit >= 0 ? "+" : ""}₹{fmt(data.profit)} this month
            </p>
          </div>
          <div className="mt-4">
            <p className="text-text-secondary text-xs mb-2">Weekly Activity</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={mockPortfolioData} barSize={8}>
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {mockPortfolioData.map((_, i) => (
                    <Cell key={i} fill={i === mockPortfolioData.length - 1 ? "#8FFFD6" : "#1f1f1f"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row — Holdings + Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Total Holdings */}
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Total Holdings</p>
            <button className="text-text-secondary hover:text-text-primary text-xs">View all ↗</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mockHoldings.map((h) => (
              <div key={h.symbol} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-border">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black"
                  style={{ backgroundColor: h.color }}>
                  {h.symbol[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold">{h.symbol}</p>
                  <p className="text-text-secondary text-xs">{h.shares} Shares</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Transactions</p>
            <p className="text-text-secondary text-xs">Today</p>
          </div>
          <div className="space-y-3">
            {mockTransactions.map((t, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black"
                    style={{ backgroundColor: t.color }}>
                    {t.symbol[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.symbol}</p>
                    <p className="text-text-secondary text-xs">{t.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${t.type === "BUY" ? "text-bull" : "text-bear"}`}>
                    {t.amount}
                  </p>
                  <p className="text-text-secondary text-xs">{t.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}