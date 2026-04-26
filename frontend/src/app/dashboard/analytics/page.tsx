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
  PieChart,
  Pie,
} from "recharts";

const mockPerformance = [
  { month: "Oct", value: 42000 },
  { month: "Nov", value: 45000 },
  { month: "Dec", value: 43000 },
  { month: "Jan", value: 47000 },
  { month: "Feb", value: 51000 },
  { month: "Mar", value: 49000 },
  { month: "Apr", value: 55000 },
];

const mockSectorData = [
  { name: "Technology", value: 40, color: "#8FFFD6" },
  { name: "Banking", value: 25, color: "#3b82f6" },
  { name: "Energy", value: 20, color: "#f97316" },
  { name: "Other", value: 15, color: "#a855f7" },
];

const mockMonthlyReturns = [
  { month: "Oct", return: 3.2 },
  { month: "Nov", return: -1.5 },
  { month: "Dec", return: 4.8 },
  { month: "Jan", return: 2.1 },
  { month: "Feb", return: 6.3 },
  { month: "Mar", return: -0.8 },
  { month: "Apr", return: 5.1 },
];

export default function AnalyticsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState({ investment: 0, currentValue: 0, profit: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) { router.push("/login"); return; }

        const userRes = await fetch("http://localhost:8081/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!userRes.ok) return;

        const user = await userRes.json();
        const res = await fetch(`http://localhost:8081/api/portfolio/summary/${user.portfolioId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setSummary(await res.json());
      } catch {}
    };
    fetchData();
  }, []);

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const profitPercent = summary.investment > 0
    ? ((summary.profit / summary.investment) * 100).toFixed(2)
    : "0.00";

  return (
    <div className="p-6 bg-surface min-h-screen text-text-primary space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <span className="text-text-secondary text-sm">Last 6 months</span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Invested", value: `₹${fmt(summary.investment)}` },
          { label: "Current Value", value: `₹${fmt(summary.currentValue)}` },
          { label: "Total Return", value: `${summary.profit >= 0 ? "+" : ""}₹${fmt(summary.profit)}`, colored: true, positive: summary.profit >= 0 },
          { label: "Return %", value: `${summary.profit >= 0 ? "+" : ""}${profitPercent}%`, colored: true, positive: summary.profit >= 0 },
        ].map((s, i) => (
          <div key={i} className="bg-surface-card rounded-2xl border border-border p-5">
            <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">{s.label}</p>
            <h2 className={`text-xl font-bold ${s.colored ? (s.positive ? "text-bull" : "text-bear") : ""}`}>
              {s.value}
            </h2>
          </div>
        ))}
      </div>

      {/* Portfolio Performance Chart */}
      <div className="bg-surface-card rounded-2xl border border-border p-5">
        <p className="font-semibold mb-4">Portfolio Performance</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={mockPerformance}>
            <defs>
              <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8FFFD6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8FFFD6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 8, color: "#fff", fontSize: 12 }}
              formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Value"]}
            />
            <Area type="monotone" dataKey="value" stroke="#8FFFD6" strokeWidth={2} fill="url(#perfGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Returns + Sector Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Monthly Returns */}
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="font-semibold mb-4">Monthly Returns</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockMonthlyReturns} barSize={20}>
              <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 8, color: "#fff", fontSize: 12 }}
                formatter={(v) => [`${Number(v).toFixed(2)}%`, "Return"]}
              />
              <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                {mockMonthlyReturns.map((d, i) => (
                  <Cell key={i} fill={d.return >= 0 ? "#22c55e" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sector Allocation */}
        <div className="bg-surface-card rounded-2xl border border-border p-5">
          <p className="font-semibold mb-4">Sector Allocation</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={mockSectorData} cx="50%" cy="50%" innerRadius={45}
                  outerRadius={70} paddingAngle={3} dataKey="value">
                  {mockSectorData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 8, color: "#fff", fontSize: 12 }}
                  formatter={(v) => [`${v}%`, "Allocation"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 flex-1">
              {mockSectorData.map((d, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span>{d.name}</span>
                    </div>
                    <span className="text-text-secondary">{d.value}%</span>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${d.value}%`, backgroundColor: d.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}