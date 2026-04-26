"use client";

import { useState } from "react";

type WatchlistItem = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
};

const mockWatchlist: WatchlistItem[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", price: 2845.50, change: 32.10, changePercent: 1.14 },
  { symbol: "TCS", name: "Tata Consultancy Services", price: 3920.75, change: -18.25, changePercent: -0.46 },
  { symbol: "INFY", name: "Infosys", price: 1678.30, change: 12.80, changePercent: 0.77 },
  { symbol: "HDFCBANK", name: "HDFC Bank", price: 1542.60, change: -8.40, changePercent: -0.54 },
  { symbol: "WIPRO", name: "Wipro", price: 456.90, change: 5.20, changePercent: 1.15 },
  { symbol: "ADANIENT", name: "Adani Enterprises", price: 2234.15, change: -42.30, changePercent: -1.86 },
];

const COLORS = ["#8FFFD6", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#22c55e"];

export default function WatchlistPage() {
  const [search, setSearch] = useState("");
  const [watchlist] = useState<WatchlistItem[]>(mockWatchlist);

  const filtered = watchlist.filter(
    (w) =>
      w.symbol.toLowerCase().includes(search.toLowerCase()) ||
      w.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 bg-surface min-h-screen text-text-primary space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <button className="bg-white hover:bg-gray-100 text-black text-sm font-semibold px-4 py-2 rounded-xl">
          + Add Stock
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search stocks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-card border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-white transition-colors"
        />
      </div>

      {/* Watchlist Table */}
      <div className="bg-surface-card rounded-2xl border border-border p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary text-xs border-b border-border">
                <th className="text-left pb-3">Stock</th>
                <th className="text-right pb-3">Price</th>
                <th className="text-right pb-3">Change</th>
                <th className="text-right pb-3">% Change</th>
                <th className="text-right pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((w, i) => (
                <tr key={w.symbol} className="hover:bg-surface transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-black"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                        {w.symbol[0]}
                      </div>
                      <div>
                        <p className="font-semibold">{w.symbol}</p>
                        <p className="text-text-secondary text-xs">{w.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-right font-medium">
                    ₹{w.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`py-4 text-right font-medium ${w.change >= 0 ? "text-bull" : "text-bear"}`}>
                    {w.change >= 0 ? "+" : ""}₹{Math.abs(w.change).toFixed(2)}
                  </td>
                  <td className={`py-4 text-right font-medium ${w.changePercent >= 0 ? "text-bull" : "text-bear"}`}>
                    <span className={`px-2 py-1 rounded-lg text-xs ${w.changePercent >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      {w.changePercent >= 0 ? "▲" : "▼"} {Math.abs(w.changePercent).toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button className="text-text-secondary hover:text-text-primary text-xs border border-border px-3 py-1 rounded-lg transition-colors">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-text-secondary text-sm">
              No stocks found matching "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}