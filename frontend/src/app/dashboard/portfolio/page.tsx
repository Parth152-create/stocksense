"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
} from "recharts";

type Holding = {
  id: string;
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice?: number;
};

const COLORS = ["#8FFFD6", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#22c55e"];

export default function PortfolioPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState({ investment: 0, currentValue: 0, profit: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        const [holdingsRes, summaryRes] = await Promise.all([
          fetch(`http://localhost:8081/api/holdings/${portfolioId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`http://localhost:8081/api/portfolio/summary/${portfolioId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (holdingsRes.ok) setHoldings(await holdingsRes.json());
        if (summaryRes.ok) setSummary(await summaryRes.json());

      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-text-secondary">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p>Loading portfolio...</p>
      </div>
    </div>
  );

  if (error) return (
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

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const pieData = holdings.map((h) => ({
    name: h.symbol,
    value: h.quantity * h.buyPrice,
  }));

  const profitPercent = summary.investment > 0
    ? ((summary.profit / summary.investment) * 100).toFixed(2)
    : "0.00";

  return (
    <div className="p-6 bg-surface min-h-screen text-text-primary space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <button className="bg-white hover:bg-gray-100 text-black text-sm font-semibold px-4 py-2 rounded-xl">
          + Add Holding
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Total Investment</p>
          <h2 className="text-2xl font-bold">₹{fmt(summary.investment)}</h2>
        </div>
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Current Value</p>
          <h2 className="text-2xl font-bold">₹{fmt(summary.currentValue)}</h2>
        </div>
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Profit / Loss</p>
          <h2 className={`text-2xl font-bold ${summary.profit >= 0 ? "text-bull" : "text-bear"}`}>
            {summary.profit >= 0 ? "+" : ""}₹{fmt(summary.profit)}
          </h2>
          <p className={`text-xs mt-1 ${summary.profit >= 0 ? "text-bull" : "text-bear"}`}>
            {summary.profit >= 0 ? "▲" : "▼"} {profitPercent}%
          </p>
        </div>
      </div>

      {/* Pie Chart + Holdings Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pie Chart */}
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="font-semibold mb-4">Allocation</p>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 8, color: "#fff", fontSize: 12 }}
                    formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Value"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{d.name}</span>
                    </div>
                    <span className="text-text-secondary">₹{Number(d.value).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-secondary text-sm">
              No holdings yet
            </div>
          )}
        </div>

        {/* Holdings Table */}
        <div className="lg:col-span-2 bg-surface-card rounded-2xl border border-border p-5">
          <p className="font-semibold mb-4">Holdings</p>
          {holdings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-secondary text-xs border-b border-border">
                    <th className="text-left pb-3">Symbol</th>
                    <th className="text-right pb-3">Qty</th>
                    <th className="text-right pb-3">Buy Price</th>
                    <th className="text-right pb-3">Invested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {holdings.map((h, i) => (
                    <tr key={h.id} className="hover:bg-surface transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                            {h.symbol[0]}
                          </div>
                          <span className="font-medium">{h.symbol}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">{h.quantity}</td>
                      <td className="py-3 text-right">₹{fmt(h.buyPrice)}</td>
                      <td className="py-3 text-right">₹{fmt(h.quantity * h.buyPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-secondary text-sm">
              No holdings yet. Add your first holding to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}