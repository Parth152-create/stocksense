"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMarket } from "@/hooks/useMarket";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import {
  Star, Plus, Search, Trash2, Bell, BellOff,
  TrendingUp, TrendingDown, ArrowUpRight, RefreshCw,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  alertPrice: number | null;
  lastCheckedPrice: number | null;
}

interface DisplayItem extends WatchlistItem {
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: string;
  sparkline: { v: number }[];
  color: string;
  bg: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LOGO_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com", AAPL: "apple.com", AMD: "amd.com", MSFT: "microsoft.com",
  NVDA: "nvidia.com", AMZN: "amazon.com", GOOGL: "google.com", META: "meta.com",
  NFLX: "netflix.com", RELIANCE: "ril.com", TCS: "tcs.com",
  INFY: "infosys.com", HDFCBANK: "hdfcbank.com",
};

const SYMBOL_META: Record<string, { name: string; color: string; bg: string }> = {
  NVDA:      { name: "NVIDIA Corp",    color: "#76b900", bg: "#76b90018" },
  AAPL:      { name: "Apple Inc",      color: "#aaaaaa", bg: "#aaaaaa18" },
  MSFT:      { name: "Microsoft Corp", color: "#00a4ef", bg: "#00a4ef18" },
  TSLA:      { name: "Tesla Inc",      color: "#ef4444", bg: "#ef444418" },
  AMZN:      { name: "Amazon",         color: "#f90",    bg: "#f9900018" },
  META:      { name: "Meta",           color: "#1877f2", bg: "#1877f218" },
  GOOGL:     { name: "Alphabet",       color: "#4285f4", bg: "#4285f418" },
  AMD:       { name: "AMD",            color: "#ed1c24", bg: "#ed1c2418" },
  RELIANCE:  { name: "Reliance Ind.",  color: "#0ea5e9", bg: "#0ea5e918" },
  TCS:       { name: "TCS",            color: "#8b5cf6", bg: "#8b5cf618" },
  INFY:      { name: "Infosys",        color: "#f59e0b", bg: "#f59e0b18" },
  HDFCBANK:  { name: "HDFC Bank",      color: "#10b981", bg: "#10b98118" },
  WIPRO:     { name: "Wipro Ltd",      color: "#ef4444", bg: "#ef444418" },
  BTC:       { name: "Bitcoin",        color: "#f7931a", bg: "#f7931a18" },
  ETH:       { name: "Ethereum",       color: "#627eea", bg: "#627eea18" },
  SOL:       { name: "Solana",         color: "#9945ff", bg: "#9945ff18" },
};
const DEFAULT_META = { name: "", color: "#8FFFD6", bg: "#8FFFD618" };

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
  hover:   "var(--color-surface-hover)",
};

// ─── Sparkline seed (deterministic per symbol) ───────────────────────────────

function makeSparkline(base: number, up: boolean): { v: number }[] {
  const pts: { v: number }[] = [];
  let v = base * (up ? 0.92 : 1.08);
  for (let i = 0; i < 12; i++) {
    v += (Math.random() - (up ? 0.35 : 0.65)) * base * 0.015;
    pts.push({ v: +v.toFixed(2) });
  }
  pts.push({ v: base });
  return pts;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StockAvatar({ symbol, color, bg, size = 36 }: {
  symbol: string; color: string; bg: string; size?: number;
}) {
  const [err, setErr] = useState(false);
  const clean = symbol.replace(".BSE", "").replace(".NSE", "").replace("/", "");
  const domain = LOGO_DOMAINS[clean];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      border: `1px solid ${color}33`, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.3, fontWeight: 700,
      color, flexShrink: 0, overflow: "hidden",
    }}>
      {domain && !err
        ? <img src={`https://icons.duckduckgo.com/ip3/${domain}.ico`} alt={symbol}
            width={size * 0.6} height={size * 0.6} onError={() => setErr(true)}
            style={{ objectFit: "contain", borderRadius: "50%" }} />
        : (clean.charAt(0))}
    </div>
  );
}

function MiniSparkline({ data, up }: { data: { v: number }[]; up: boolean }) {
  const id = `wsg${up ? "u" : "d"}`;
  return (
    <ResponsiveContainer width={80} height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={up ? "#22c55e" : "#ef4444"} stopOpacity={0.2} />
            <stop offset="95%" stopColor={up ? "#22c55e" : "#ef4444"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={up ? "#22c55e" : "#ef4444"}
          strokeWidth={1.5} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function AlertModal({ item, onClose, onSave }: {
  item: DisplayItem; onClose: () => void; onSave: (p: number) => void;
}) {
  const [price, setPrice] = useState(item.alertPrice?.toString() ?? "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 32px", width: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f59e0b18", border: "1px solid #f59e0b33", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={16} color="#f59e0b" />
          </div>
          <div>
            <h3 style={{ color: C.primary, fontWeight: 700, fontSize: 15, margin: 0 }}>Set Price Alert</h3>
            <p style={{ color: C.muted, fontSize: 12, margin: "2px 0 0" }}>
              {item.symbol} · Current: {item.price}
            </p>
          </div>
        </div>
        <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Alert when price reaches</label>
        <input
          type="number" value={price} onChange={e => setPrice(e.target.value)}
          placeholder={item.price.toString()} autoFocus
          style={{ width: "100%", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, color: C.primary, fontSize: 14, padding: "10px 14px", outline: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={() => { onSave(parseFloat(price)); onClose(); }}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#f59e0b", color: "#0a0a0a", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            Set Alert
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const router  = useRouter();
  const { market } = useMarket();
  const currency = market.currency || "$";

  const [items,       setItems]       = useState<DisplayItem[]>([]);
  const [search,      setSearch]      = useState("");
  const [alertItem,   setAlertItem]   = useState<DisplayItem | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [addSymbol,   setAddSymbol]   = useState("");
  const [showAdd,     setShowAdd]     = useState(false);
  const [livePrices,  setLivePrices]  = useState<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);

  // ── Fetch watchlist from backend ──────────────────────────────────────────
  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/watchlist");
      if (!res.ok) throw new Error("fetch failed");
      const data: WatchlistItem[] = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        // Enrich with display metadata
        const enriched: DisplayItem[] = data.map(item => {
          const clean = item.symbol.replace(/\.(BSE|NSE)$/i, "");
          const meta  = SYMBOL_META[clean] ?? DEFAULT_META;
          const price = item.lastCheckedPrice ?? 0;
          return {
            ...item,
            name:      meta.name || clean,
            price,
            change:    0,
            changePct: 0,
            volume:    "—",
            sparkline: makeSparkline(price || 100, true),
            color:     meta.color,
            bg:        meta.bg,
          };
        });
        setItems(enriched);
        subscribeWs(enriched.map(i => i.symbol));
      }
    } catch {
      // non-fatal: leave empty list
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlist();
    return () => wsRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WebSocket live prices ─────────────────────────────────────────────────
  const subscribeWs = (symbols: string[]) => {
    if (symbols.length === 0) return;
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket("ws://localhost:8081/ws/prices");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ subscribe: symbols }));
    };

    ws.onmessage = (e) => {
      try {
        const prices: Record<string, number> = JSON.parse(e.data);
        setLivePrices(prev => ({ ...prev, ...prices }));
      } catch { /* ignore malformed */ }
    };

    ws.onerror = () => ws.close();
  };

  // Merge live prices into display items
  const displayItems: DisplayItem[] = items.map(item => {
    const clean    = item.symbol.replace(/\.(BSE|NSE)$/i, "");
    const livePrice = livePrices[clean] ?? livePrices[item.symbol];
    if (!livePrice) return item;
    const change    = livePrice - item.price;
    const changePct = item.price > 0 ? (change / item.price) * 100 : 0;
    return { ...item, price: livePrice, change, changePct };
  });

  // ── Add to watchlist ──────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addSymbol.trim()) return;
    const sym = addSymbol.trim().toUpperCase();
    try {
      const res = await fetchWithAuth(`/api/watchlist/${sym}`, { method: "POST" });
      if (res.ok) {
        setShowAdd(false);
        setAddSymbol("");
        loadWatchlist();
        return;
      }
    } catch { /* fallback to navigation */ }
    // Fallback: navigate to stock page where user can add to watchlist
    router.push(`/dashboard/stock/${sym}`);
    setShowAdd(false);
    setAddSymbol("");
  };

  // ── Remove from watchlist ─────────────────────────────────────────────────
  const handleRemove = async (symbol: string) => {
    setItems(prev => prev.filter(i => i.symbol !== symbol));
    try {
      await fetchWithAuth(`/api/watchlist/${symbol}`, { method: "DELETE" });
    } catch { /* optimistic update already applied */ }
  };

  // ── Set alert ─────────────────────────────────────────────────────────────
  const handleSetAlert = async (symbol: string, price: number) => {
    setItems(prev => prev.map(i =>
      i.symbol === symbol ? { ...i, alertPrice: price } : i
    ));
    // Optionally persist to backend if you add PUT /api/watchlist/:symbol/alert
  };

  const filtered = displayItems.filter(i =>
    i.symbol.toLowerCase().includes(search.toLowerCase()) ||
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const alertedCount = items.filter(i => i.alertPrice != null).length;
  const gainers = displayItems.filter(i => i.changePct > 0).length;
  const losers  = displayItems.filter(i => i.changePct < 0).length;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto", fontFamily: "'Geist','Inter',sans-serif", background: C.page, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Watchlist</h1>
          <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>
            {market.flag} {market.label} · {items.length} symbols · {alertedCount} alerts active
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadWatchlist} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowAdd(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer", color: "#0a0a0a", fontWeight: 700, fontSize: 13 }}>
            <Plus size={14} /> Add Symbol
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Watching",  value: items.length,  color: "#8FFFD6" },
          { label: "Gaining",   value: gainers,        color: "#22c55e" },
          { label: "Losing",    value: losers,         color: "#ef4444" },
          { label: "Alerts Set",value: alertedCount,   color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px" }}>
            <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px" }}>{label}</p>
            <p style={{ color, fontWeight: 700, fontSize: 24, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={14} color="var(--color-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search watchlist…"
          style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, color: C.primary, fontSize: 13, padding: "11px 14px 11px 38px", outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 36px 36px 36px", padding: "11px 20px", borderBottom: `1px solid ${C.line}` }}>
          {["Asset", "Price", "Change", "Alert", "7D Trend", "", "", ""].map((h, i) => (
            <span key={i} style={{ color: C.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: C.muted, fontSize: 13 }}>Loading watchlist…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Star size={32} color="var(--color-line)" style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ color: C.muted, fontSize: 13 }}>
              {search ? `No results for "${search}"` : "Your watchlist is empty. Add a symbol to get started."}
            </p>
          </div>
        ) : (
          filtered.map((item, i) => {
            const isUp = item.changePct >= 0;
            return (
              <div key={item.symbol}
                style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 36px 36px 36px", padding: "13px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer", transition: "background 0.15s", alignItems: "center" }}
                onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                onClick={() => router.push(`/dashboard/stock/${item.symbol.replace(/\.(BSE|NSE)$/i, "")}`)}>

                {/* Asset */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StockAvatar symbol={item.symbol} color={item.color} bg={item.bg} size={34} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>
                        {item.symbol.replace(/\.(BSE|NSE)$/i, "")}
                      </p>
                      {item.alertPrice != null && (
                        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b33", fontWeight: 600 }}>
                          ALERT @ {item.alertPrice}
                        </span>
                      )}
                    </div>
                    <p style={{ color: C.muted, fontSize: 11, margin: "2px 0 0" }}>{item.name}</p>
                  </div>
                </div>

                {/* Price */}
                <span style={{ color: C.primary, fontSize: 13, fontWeight: 600 }}>
                  {currency}{item.price.toLocaleString("en-US", { minimumFractionDigits: item.price < 10 ? 4 : 2 })}
                </span>

                {/* Change */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {isUp ? <TrendingUp size={12} color="#22c55e" /> : <TrendingDown size={12} color="#ef4444" />}
                  <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
                    {isUp ? "+" : ""}{item.changePct.toFixed(2)}%
                  </span>
                </div>

                {/* Alert price */}
                <span style={{ color: C.muted, fontSize: 12 }}>
                  {item.alertPrice != null ? `${currency}${item.alertPrice}` : "—"}
                </span>

                {/* Sparkline */}
                <div onClick={e => e.stopPropagation()}>
                  <MiniSparkline data={item.sparkline} up={isUp} />
                </div>

                {/* Trade */}
                <button
                  onClick={e => { e.stopPropagation(); router.push(`/dashboard/stock/${item.symbol.replace(/\.(BSE|NSE)$/i, "")}`); }}
                  style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ArrowUpRight size={13} />
                </button>

                {/* Alert toggle */}
                <button
                  onClick={e => { e.stopPropagation(); setAlertItem(item); }}
                  style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: item.alertPrice != null ? "#f59e0b18" : "transparent", color: item.alertPrice != null ? "#f59e0b" : C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.alertPrice != null ? <Bell size={13} /> : <BellOff size={13} />}
                </button>

                {/* Remove */}
                <button
                  onClick={e => { e.stopPropagation(); handleRemove(item.symbol); }}
                  style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowAdd(false)}>
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 32px", width: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#8FFFD618", border: "1px solid #8FFFD633", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Star size={16} color="#8FFFD6" />
              </div>
              <h3 style={{ color: C.primary, fontWeight: 700, fontSize: 15, margin: 0 }}>Add to Watchlist</h3>
            </div>
            <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Symbol</label>
            <input
              value={addSymbol}
              onChange={e => setAddSymbol(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              placeholder="e.g. AAPL, RELIANCE, BTC"
              autoFocus
              style={{ width: "100%", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, color: C.primary, fontSize: 14, padding: "10px 14px", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
              <button onClick={handleAdd} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#8FFFD6", color: "#0a0a0a", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {alertItem && (
        <AlertModal
          item={alertItem}
          onClose={() => setAlertItem(null)}
          onSave={p => handleSetAlert(alertItem.symbol, p)} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}