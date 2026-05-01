"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMarket } from "@/hooks/useMarket";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import {
  Star, StarOff, Plus, Search, Trash2, Bell, BellOff,
  TrendingUp, TrendingDown, ArrowUpRight, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WatchItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: string;
  high: number;
  low: number;
  color: string;
  bg: string;
  letter: string;
  alerted: boolean;
  alertPrice: number | null;
  sparkline: { v: number }[];
  sector: string;
}

// ─── Logo map ─────────────────────────────────────────────────────────────────

const LOGO_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com", AAPL: "apple.com", AMD: "amd.com", MSFT: "microsoft.com",
  NVDA: "nvidia.com", AMZN: "amazon.com", GOOGL: "google.com", META: "meta.com",
  NFLX: "netflix.com", RELIANCE: "ril.com", TCS: "tcs.com", INFY: "infosys.com",
  HDFCBANK: "hdfcbank.com",
};

// ─── Market-aware default watchlist ───────────────────────────────────────────

function makeSparkline(base: number, up: boolean) {
  const pts: { v: number }[] = [];
  let v = base * (up ? 0.92 : 1.08);
  for (let i = 0; i < 12; i++) {
    v += (Math.random() - (up ? 0.35 : 0.65)) * base * 0.015;
    pts.push({ v: +v.toFixed(2) });
  }
  pts.push({ v: base });
  return pts;
}

const DEFAULT_WATCHLIST: Record<string, WatchItem[]> = {
  US: [
    { symbol: "NVDA",  name: "NVIDIA",    price: 1089,  change: 24.5,  changePct: 2.30, volume: "48.2M", high: 1102,  low: 1058,  color: "#76b900", bg: "#76b90018", letter: "N", alerted: true,  alertPrice: 1100, sector: "Tech",     sparkline: makeSparkline(1089, true)  },
    { symbol: "AAPL",  name: "Apple",     price: 198,   change: -1.2,  changePct: -0.60, volume: "62.1M", high: 201,   low: 196,   color: "#aaaaaa", bg: "#aaaaaa18", letter: "",  alerted: false, alertPrice: null, sector: "Tech",     sparkline: makeSparkline(198, false)  },
    { symbol: "TSLA",  name: "Tesla",     price: 182,   change: -4.8,  changePct: -2.57, volume: "91.4M", high: 188,   low: 179,   color: "#ef4444", bg: "#ef444418", letter: "T", alerted: false, alertPrice: null, sector: "EV",       sparkline: makeSparkline(182, false)  },
    { symbol: "MSFT",  name: "Microsoft", price: 378,   change: 3.2,   changePct: 0.85, volume: "22.8M", high: 382,   low: 373,   color: "#00a4ef", bg: "#00a4ef18", letter: "M", alerted: false, alertPrice: null, sector: "Tech",     sparkline: makeSparkline(378, true)   },
    { symbol: "AMZN",  name: "Amazon",    price: 185,   change: 1.8,   changePct: 0.98, volume: "35.6M", high: 187,   low: 182,   color: "#f90",    bg: "#f9900018", letter: "A", alerted: true,  alertPrice: 190,  sector: "Consumer", sparkline: makeSparkline(185, true)   },
    { symbol: "META",  name: "Meta",      price: 488,   change: -2.4,  changePct: -0.49, volume: "18.2M", high: 494,   low: 483,   color: "#1877f2", bg: "#1877f218", letter: "M", alerted: false, alertPrice: null, sector: "Social",   sparkline: makeSparkline(488, false)  },
  ],
  IN: [
    { symbol: "RELIANCE", name: "Reliance", price: 2940, change: 48,   changePct: 1.66, volume: "8.2M",  high: 2958, low: 2900, color: "#0ea5e9", bg: "#0ea5e918", letter: "R", alerted: true,  alertPrice: 3000, sector: "Energy",  sparkline: makeSparkline(2940, true)  },
    { symbol: "TCS",      name: "TCS",      price: 3920, change: -20,  changePct: -0.51, volume: "1.4M",  high: 3960, low: 3905, color: "#8b5cf6", bg: "#8b5cf618", letter: "T", alerted: false, alertPrice: null, sector: "IT",     sparkline: makeSparkline(3920, false) },
    { symbol: "INFY",     name: "Infosys",  price: 1820, change: 32,   changePct: 1.79, volume: "5.8M",  high: 1835, low: 1800, color: "#f59e0b", bg: "#f59e0b18", letter: "I", alerted: false, alertPrice: null, sector: "IT",     sparkline: makeSparkline(1820, true)  },
    { symbol: "HDFCBANK", name: "HDFC Bank",price: 1710, change: -14,  changePct: -0.81, volume: "6.1M",  high: 1724, low: 1698, color: "#10b981", bg: "#10b98118", letter: "H", alerted: false, alertPrice: null, sector: "Banking",sparkline: makeSparkline(1710, false) },
  ],
  CRYPTO: [
    { symbol: "BTC",  name: "Bitcoin",   price: 96400, change: 1240, changePct: 1.30, volume: "$42B", high: 97800, low: 94200, color: "#f7931a", bg: "#f7931a18", letter: "₿", alerted: true,  alertPrice: 100000, sector: "L1",   sparkline: makeSparkline(96400, true)  },
    { symbol: "ETH",  name: "Ethereum",  price: 3580,  change: -48,  changePct: -1.32, volume: "$18B", high: 3640,  low: 3520,  color: "#627eea", bg: "#627eea18", letter: "Ξ", alerted: false, alertPrice: null,   sector: "L1",   sparkline: makeSparkline(3580, false)  },
    { symbol: "SOL",  name: "Solana",    price: 188,   change: 6.4,  changePct: 3.52, volume: "$4B",  high: 192,   low: 181,   color: "#9945ff", bg: "#9945ff18", letter: "◎", alerted: false, alertPrice: null,   sector: "L1",   sparkline: makeSparkline(188, true)    },
    { symbol: "AVAX", name: "Avalanche", price: 38,    change: 1.2,  changePct: 3.26, volume: "$820M",high: 39.5,  low: 36.8,  color: "#e84142", bg: "#e8414218", letter: "A", alerted: false, alertPrice: null,   sector: "L1",   sparkline: makeSparkline(38, true)     },
  ],
  FX: [
    { symbol: "EUR/USD", name: "Euro/Dollar",   price: 1.0890, change: 0.0042, changePct: 0.39, volume: "$320B", high: 1.0924, low: 1.0848, color: "#3b82f6", bg: "#3b82f618", letter: "€", alerted: false, alertPrice: null,   sector: "Major", sparkline: makeSparkline(1.089, true)   },
    { symbol: "GBP/USD", name: "Pound/Dollar",  price: 1.2720, change: -0.0031, changePct: -0.24, volume: "$180B", high: 1.2758, low: 1.2698, color: "#8b5cf6", bg: "#8b5cf618", letter: "£", alerted: false, alertPrice: null,   sector: "Major", sparkline: makeSparkline(1.272, false)  },
    { symbol: "USD/JPY", name: "Dollar/Yen",    price: 157.80, change: 0.82, changePct: 0.52, volume: "$220B", high: 158.40, low: 157.20, color: "#f59e0b", bg: "#f59e0b18", letter: "¥", alerted: true,  alertPrice: 160,    sector: "Major", sparkline: makeSparkline(157.8, true)   },
  ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StockAvatar({ symbol, color, bg, letter, size = 36 }: {
  symbol: string; color: string; bg: string; letter: string; size?: number;
}) {
  const [err, setErr] = useState(false);
  const clean = symbol.replace(".BSE", "").replace("/", "");
  const domain = LOGO_DOMAINS[clean];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      border: `1px solid ${color}33`, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.3, fontWeight: 700, color, flexShrink: 0, overflow: "hidden",
    }}>
      {domain && !err ? (
        <img src={`https://icons.duckduckgo.com/ip3/${domain}.ico`} alt={symbol}
          width={size * 0.6} height={size * 0.6} onError={() => setErr(true)}
          style={{ objectFit: "contain", borderRadius: "50%" }} />
      ) : (letter || symbol.charAt(0))}
    </div>
  );
}

function MiniSparkline({ data, up }: { data: { v: number }[]; up: boolean }) {
  return (
    <ResponsiveContainer width={80} height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`wsg${up ? "u" : "d"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={up ? "#22c55e" : "#ef4444"} stopOpacity={0.2} />
            <stop offset="95%" stopColor={up ? "#22c55e" : "#ef4444"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={up ? "#22c55e" : "#ef4444"} strokeWidth={1.5}
          fill={`url(#wsg${up ? "u" : "d"})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Alert Modal ──────────────────────────────────────────────────────────────

function AlertModal({ item, onClose, onSave }: {
  item: WatchItem; onClose: () => void; onSave: (price: number) => void;
}) {
  const [price, setPrice] = useState(item.alertPrice?.toString() ?? "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "28px 32px", width: 360 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f59e0b18", border: "1px solid #f59e0b33",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={16} color="#f59e0b" />
          </div>
          <div>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>Set Price Alert</h3>
            <p style={{ color: "#555", fontSize: 12, margin: "2px 0 0" }}>{item.symbol} · Current: {item.price}</p>
          </div>
        </div>
        <label style={{ color: "#888", fontSize: 12, display: "block", marginBottom: 6 }}>Alert when price reaches</label>
        <input
          type="number" value={price} onChange={(e) => setPrice(e.target.value)}
          placeholder={item.price.toString()}
          style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 8,
            color: "#fff", fontSize: 14, padding: "10px 14px", outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #1f1f1f",
            background: "transparent", color: "#888", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={() => { onSave(parseFloat(price)); onClose(); }} style={{ flex: 1, padding: "11px 0",
            borderRadius: 10, border: "none", background: "#f59e0b", color: "#0a0a0a",
            cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Set Alert</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const router = useRouter();
  const { market } = useMarket();
  const key = market.id as keyof typeof DEFAULT_WATCHLIST;
  const currency = market.currency || "$";

  const [items, setItems]           = useState<WatchItem[]>([]);
  const [search, setSearch]         = useState("");
  const [alertItem, setAlertItem]   = useState<WatchItem | null>(null);
  const [loading, setLoading]       = useState(true);
  const [addSymbol, setAddSymbol]   = useState("");
  const [showAdd, setShowAdd]       = useState(false);

  useEffect(() => {
    setLoading(true);
    // Try API first, fall back to mock
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    fetch("/api/watchlist", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.length > 0) setItems(data);
        else setItems(DEFAULT_WATCHLIST[key] ?? DEFAULT_WATCHLIST["US"]);
      })
      .catch(() => setItems(DEFAULT_WATCHLIST[key] ?? DEFAULT_WATCHLIST["US"]))
      .finally(() => setLoading(false));
  }, [key]);

  const removeItem  = (symbol: string) => setItems((prev) => prev.filter((i) => i.symbol !== symbol));
  const toggleAlert = (symbol: string) => setItems((prev) =>
    prev.map((i) => i.symbol === symbol ? { ...i, alerted: !i.alerted } : i));
  const setAlert    = (symbol: string, price: number) => setItems((prev) =>
    prev.map((i) => i.symbol === symbol ? { ...i, alerted: true, alertPrice: price } : i));

  const handleAdd = () => {
    if (!addSymbol.trim()) return;
    router.push(`/dashboard/stock/${addSymbol.trim().toUpperCase()}`);
    setShowAdd(false);
    setAddSymbol("");
  };

  const filtered = items.filter((i) =>
    i.symbol.toLowerCase().includes(search.toLowerCase()) ||
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const alertedCount = items.filter((i) => i.alerted).length;
  const gainers      = items.filter((i) => i.changePct > 0).length;
  const losers       = items.filter((i) => i.changePct < 0).length;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto", fontFamily: "'Geist','Inter',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Watchlist</h1>
          <p style={{ color: "#555", fontSize: 12, margin: "4px 0 0" }}>
            {market.flag} {market.label} · {items.length} symbols · {alertedCount} alerts active
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setItems(DEFAULT_WATCHLIST[key] ?? [])} style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid #1f1f1f",
            background: "transparent", color: "#555", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowAdd(true)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
            background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer",
            color: "#0a0a0a", fontWeight: 700, fontSize: 13,
          }}>
            <Plus size={14} /> Add Symbol
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Watching",    value: items.length,    color: "#8FFFD6" },
          { label: "Gaining",     value: gainers,         color: "#22c55e" },
          { label: "Losing",      value: losers,          color: "#ef4444" },
          { label: "Alerts Set",  value: alertedCount,    color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 12, padding: "14px 18px" }}>
            <p style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px" }}>{label}</p>
            <p style={{ color, fontWeight: 700, fontSize: 24, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={14} color="#555" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search watchlist…"
          style={{ width: "100%", background: "#111", border: "1px solid #1f1f1f", borderRadius: 10,
            color: "#fff", fontSize: 13, padding: "11px 14px 11px 38px", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* ── Watchlist Table ── */}
      <div style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 14, overflow: "hidden" }}>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 36px 36px 36px",
          padding: "11px 20px", borderBottom: "1px solid #1a1a1a", gap: 0 }}>
          {["Asset", "Price", "Change", "Volume", "7D Trend", "", "", ""].map((h, i) => (
            <span key={i} style={{ color: "#444", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 28, height: 28, border: "2px solid #1f1f1f", borderTop: "2px solid #8FFFD6",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "#555", fontSize: 13 }}>Loading watchlist…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Star size={32} color="#2a2a2a" style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ color: "#555", fontSize: 13 }}>
              {search ? `No results for "${search}"` : "Your watchlist is empty. Add a symbol to get started."}
            </p>
          </div>
        ) : (
          filtered.map((item, i) => {
            const isUp = item.changePct >= 0;
            return (
              <div key={item.symbol}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 36px 36px 36px",
                  padding: "13px 20px", borderBottom: i < filtered.length - 1 ? "1px solid #141414" : "none",
                  cursor: "pointer", transition: "background 0.15s", alignItems: "center", gap: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#141414")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => router.push(`/dashboard/stock/${item.symbol}`)}
              >
                {/* Asset */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StockAvatar symbol={item.symbol} color={item.color} bg={item.bg} letter={item.letter} size={34} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ color: "#fff", fontWeight: 600, fontSize: 13, margin: 0 }}>{item.symbol}</p>
                      {item.alerted && (
                        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4,
                          background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b33", fontWeight: 600 }}>
                          ALERT {item.alertPrice ? `@ ${item.alertPrice}` : ""}
                        </span>
                      )}
                    </div>
                    <p style={{ color: "#555", fontSize: 11, margin: "2px 0 0" }}>{item.name}</p>
                  </div>
                </div>

                {/* Price */}
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                  {currency}{item.price.toLocaleString("en-US", { minimumFractionDigits: item.price < 10 ? 4 : 2 })}
                </span>

                {/* Change */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {isUp ? <TrendingUp size={12} color="#22c55e" /> : <TrendingDown size={12} color="#ef4444" />}
                  <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
                    {isUp ? "+" : ""}{item.changePct.toFixed(2)}%
                  </span>
                </div>

                {/* Volume */}
                <span style={{ color: "#555", fontSize: 12 }}>{item.volume}</span>

                {/* Sparkline */}
                <div onClick={(e) => e.stopPropagation()}>
                  <MiniSparkline data={item.sparkline} up={isUp} />
                </div>

                {/* Trade button */}
                <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/stock/${item.symbol}`); }}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #1f1f1f",
                    background: "transparent", color: "#555", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                  title="Trade">
                  <ArrowUpRight size={13} />
                </button>

                {/* Alert button */}
                <button onClick={(e) => { e.stopPropagation(); setAlertItem(item); }}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #1f1f1f",
                    background: item.alerted ? "#f59e0b18" : "transparent",
                    color: item.alerted ? "#f59e0b" : "#555", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                  title={item.alerted ? "Edit alert" : "Set alert"}>
                  {item.alerted ? <Bell size={13} /> : <BellOff size={13} />}
                </button>

                {/* Remove button */}
                <button onClick={(e) => { e.stopPropagation(); removeItem(item.symbol); }}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #1f1f1f",
                    background: "transparent", color: "#555", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                  title="Remove">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Add Symbol Modal ── */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowAdd(false)}>
          <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "28px 32px", width: 360 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#8FFFD618", border: "1px solid #8FFFD633",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Star size={16} color="#8FFFD6" />
              </div>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>Add to Watchlist</h3>
            </div>
            <label style={{ color: "#888", fontSize: 12, display: "block", marginBottom: 6 }}>Symbol</label>
            <input
              value={addSymbol} onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={`e.g. ${key === "IN" ? "RELIANCE" : key === "CRYPTO" ? "BTC" : "AAPL"}`}
              style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 8,
                color: "#fff", fontSize: 14, padding: "10px 14px", outline: "none", boxSizing: "border-box" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 10,
                border: "1px solid #1f1f1f", background: "transparent", color: "#888", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleAdd} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                background: "#8FFFD6", color: "#0a0a0a", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                View &amp; Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert Modal ── */}
      {alertItem && (
        <AlertModal
          item={alertItem}
          onClose={() => setAlertItem(null)}
          onSave={(price) => setAlert(alertItem.symbol, price)}
        />
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}