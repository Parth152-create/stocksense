"use client";

import { useEffect, useState } from "react";
import PortfolioChart from "@/components/charts/PortfolioChart";

type Summary = {
  investment: number;
  currentValue: number;
  profit: number;
};

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const portfolioId = "0006a05c-c12f-4d3b-95ed-f4406930f016";

        const res = await fetch(
          `http://localhost:8081/api/portfolio/summary/${portfolioId}`
        );

        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-text-secondary">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text-primary">

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-text-secondary mt-2">
            Overview of your portfolio performance
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-card hover:bg-surface-hover transition">
            <p className="text-text-secondary text-xs uppercase tracking-wide">
              Investment
            </p>
            <h2 className="text-3xl font-semibold mt-4">
              ₹{data.investment.toLocaleString()}
            </h2>
          </div>

          <div className="bg-surface-card p-6 rounded-2xl border border-accent shadow-glow">
            <p className="text-text-secondary text-xs uppercase tracking-wide">
              Current Value
            </p>
            <h2 className="text-4xl font-bold mt-4 text-accent">
              ₹{data.currentValue.toLocaleString()}
            </h2>
          </div>

          <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-card hover:bg-surface-hover transition">
            <p className="text-text-secondary text-xs uppercase tracking-wide">
              Profit
            </p>
            <h2
              className={`text-3xl font-semibold mt-4 ${
                data.profit >= 0 ? "text-bull" : "text-bear"
              }`}
            >
              ₹{data.profit.toLocaleString()}
            </h2>
          </div>

        </div>

        {/* Chart */}
        <PortfolioChart currentValue={data.currentValue} />

      </div>
    </div>
  );
}