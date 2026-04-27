"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Holding = {
  id: string;
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice?: number;
};

type Summary = {
  investment: number;
  currentValue: number;
  profit: number;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const COLORS = ["#8FFFD6", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#22c55e", "#06b6d4", "#f59e0b"];

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Add Holding Modal ──────────────────────────────────────────────────────────
function AddHoldingModal({
  portfolioId,
  token,
  onClose,
  onAdded,
}: {
  portfolioId: string;
  token: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!symbol || !quantity || !buyPrice) {
      setError("All fields are required.");
      return;
    }
    if (isNaN(Number(quantity)) || Number(quantity) <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }
    if (isNaN(Number(buyPrice)) || Number(buyPrice) <= 0) {
      setError("Buy price must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8081/api/holdings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol: symbol.toUpperCase().trim(),
          quantity: Number(quantity),
          buyPrice: Number(buyPrice),
          portfolioId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || "Failed to add holding.");
        return;
      }

      onAdded();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Add Holding</h2>
            <p className="text-[#555] text-xs mt-0.5">Add a stock to your portfolio</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#888] mb-2">Stock Symbol</label>
            <input
              type="text"
              placeholder="e.g. RELIANCE, TCS, INFY"
              className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] text-white placeholder-[#444] focus:outline-none focus:border-[#8FFFD6] transition-colors text-sm uppercase"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#888] mb-2">Quantity</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] text-white placeholder-[#444] focus:outline-none focus:border-[#8FFFD6] transition-colors text-sm"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-2">Buy Price (₹)</label>
              <input
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] text-white placeholder-[#444] focus:outline-none focus:border-[#8FFFD6] transition-colors text-sm"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Preview */}
          {symbol && quantity && buyPrice && (
            <div className="bg-[#0a0a0a] rounded-xl p-3 border border-[#1f1f1f]">
              <p className="text-[#555] text-xs mb-1">Total Investment</p>
              <p className="text-white font-semibold">
                ₹{fmt(Number(quantity) * Number(buyPrice))}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[#1f1f1f] text-[#888] text-sm hover:border-[#333] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-[#8FFFD6] hover:bg-[#6ee8bc] text-black font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus size={14} />
                Add Holding
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<Summary>({ investment: 0, currentValue: 0, profit: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [portfolioId, setPortfolioId] = useState("");
  const [token, setToken] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async (tkn?: string) => {
    try {
      const t = tkn || localStorage.getItem("token") || "";
      if (!t) { router.push("/login"); return; }

      const userRes = await fetch("http://localhost:8081/api/users/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (userRes.status === 401) { localStorage.removeItem("token"); router.push("/login"); return; }
      if (!userRes.ok) { setError("Failed to load user profile."); return; }

      const user = await userRes.json();
      const pid = user.portfolioId;
      setPortfolioId(pid);

      const [holdingsRes, summaryRes] = await Promise.all([
        fetch(`http://localhost:8081/api/holdings/${pid}`, {
          headers: { Authorization: `Bearer ${t}` },
        }),
        fetch(`http://localhost:8081/api/portfolio/summary/${pid}`, {
          headers: { Authorization: `Bearer ${t}` },
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

  useEffect(() => {
    const t = localStorage.getItem("token") || "";
    setToken(t);
    fetchData(t);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this holding?")) return;
    setDeletingId(id);
    try {
      await fetch(`http://localhost:8081/api/holdings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch {
      alert("Failed to delete holding.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8FFFD6] mx-auto mb-3" />
        <p className="text-[#555] text-sm">Loading portfolio...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="bg-[#111] p-8 rounded-2xl border border-[#1f1f1f] text-center max-w-sm">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-red-400 mb-4 text-sm">{error}</p>
        <button
          onClick={() => { setError(""); setLoading(true); fetchData(); }}
          className="bg-[#8FFFD6] hover:bg-[#6ee8bc] text-black font-semibold px-6 py-2 rounded-xl text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );

  const profitPercent = summary.investment > 0
    ? ((summary.profit / summary.investment) * 100).toFixed(2)
    : "0.00";
  const isProfit = summary.profit >= 0;

  const pieData = holdings.map((h) => ({
    name: h.symbol,
    value: Math.round(h.quantity * h.buyPrice),
  }));

  return (
    <>
      {showModal && portfolioId && token && (
        <AddHoldingModal
          portfolioId={portfolioId}
          token={token}
          onClose={() => setShowModal(false)}
          onAdded={() => { setLoading(true); fetchData(); }}
        />
      )}

      <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Portfolio</h1>
            <p className="text-[#555] text-xs mt-0.5">{holdings.length} positions</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#8FFFD6] hover:bg-[#6ee8bc] text-black font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={14} />
            Add Holding
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Investment", value: `₹${fmt(summary.investment)}`, sub: null },
            { label: "Current Value", value: `₹${fmt(summary.currentValue)}`, sub: null },
            {
              label: "Profit / Loss",
              value: `${isProfit ? "+" : ""}₹${fmt(summary.profit)}`,
              sub: `${isProfit ? "▲" : "▼"} ${profitPercent}%`,
              color: isProfit ? "#22c55e" : "#ef4444",
            },
          ].map((card) => (
            <div key={card.label} className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-5">
              <p className="text-[#555] text-xs uppercase tracking-widest mb-2">{card.label}</p>
              <h2
                className="text-2xl font-bold"
                style={{ color: card.color ?? "#ffffff" }}
              >
                {card.value}
              </h2>
              {card.sub && (
                <p className="text-xs mt-1" style={{ color: card.color }}>
                  {card.sub}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Chart + Table */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
          {/* Pie Chart */}
          <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-5">
            <p className="text-sm font-semibold text-white mb-4">Allocation</p>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: "1px solid #1f1f1f",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 12,
                      }}
                      formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Value"]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-2 mt-3">
                  {pieData.map((d, i) => {
                    const pct = summary.investment > 0
                      ? ((d.value / summary.investment) * 100).toFixed(1)
                      : "0";
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-white">{d.name}</span>
                        </div>
                        <span className="text-[#555]">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <p className="text-[#555] text-sm mb-3">No holdings yet</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="text-[#8FFFD6] text-xs hover:underline"
                >
                  + Add your first holding
                </button>
              </div>
            )}
          </div>

          {/* Holdings Table */}
          <div className="bg-[#111111] rounded-2xl border border-[#1f1f1f] p-5">
            <p className="text-sm font-semibold text-white mb-4">Holdings</p>

            {holdings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#555] text-xs border-b border-[#1f1f1f]">
                      <th className="text-left pb-3 font-medium">Symbol</th>
                      <th className="text-right pb-3 font-medium">Qty</th>
                      <th className="text-right pb-3 font-medium">Buy Price</th>
                      <th className="text-right pb-3 font-medium">Invested</th>
                      <th className="text-right pb-3 font-medium">P&L</th>
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h, i) => {
                      const invested = h.quantity * h.buyPrice;
                      const currentVal = h.currentPrice
                        ? h.quantity * h.currentPrice
                        : invested;
                      const pnl = currentVal - invested;
                      const pnlPct = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : "0.00";
                      const isUp = pnl >= 0;

                      return (
                        <tr
                          key={h.id}
                          className="border-b border-[#1f1f1f] last:border-0 hover:bg-[#1a1a1a] transition-colors group cursor-pointer"
                          onClick={() => router.push(`/dashboard/stock/${h.symbol}`)}
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              >
                                {h.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <p className="text-white font-medium">{h.symbol}</p>
                                <p className="text-[#555] text-[10px]">{h.quantity} shares</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-right text-white">{h.quantity}</td>
                          <td className="py-3 text-right text-white">₹{fmt(h.buyPrice)}</td>
                          <td className="py-3 text-right text-white">₹{fmt(invested)}</td>
                          <td className="py-3 text-right">
                            <div>
                              <p className={`font-medium text-xs ${isUp ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                                {isUp ? "+" : ""}₹{fmt(pnl)}
                              </p>
                              <p className={`text-[10px] ${isUp ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                                {isUp ? "▲" : "▼"} {Math.abs(Number(pnlPct))}%
                              </p>
                            </div>
                          </td>
                          <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleDelete(h.id)}
                              disabled={deletingId === h.id}
                              className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all ml-auto"
                            >
                              {deletingId === h.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Trash2 size={12} />
                              }
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <TrendingUp size={32} className="text-[#1f1f1f] mb-3" />
                <p className="text-[#555] text-sm mb-1">No holdings yet</p>
                <p className="text-[#333] text-xs mb-4">Add your first stock to get started</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 bg-[#8FFFD6] hover:bg-[#6ee8bc] text-black font-semibold text-xs px-4 py-2 rounded-xl transition-colors"
                >
                  <Plus size={12} />
                  Add Holding
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}