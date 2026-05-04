"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMarket } from "@/hooks/useMarket";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Plus, RefreshCw, ArrowUpRight, Filter } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Holding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  color: string;
  bg: string;
  letter: string;
  sector: string;
}

// ─── Logo domains ─────────────────────────────────────────────────────────────

const LOGO_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com", AAPL: "apple.com", AMD: "amd.com", MSFT: "microsoft.com",
  NVDA: "nvidia.com", ADBE: "adobe.com", KO: "coca-cola.com", MCD: "mcdonalds.com",
  AMZN: "amazon.com", GOOGL: "google.com", RELIANCE: "ril.com", TCS: "tcs.com",
  INFY: "infosys.com", HDFCBANK: "hdfcbank.com", WIPRO: "wipro.com",
};

// ─── Market-aware mock holdings ───────────────────────────────────────────────

const MOCK_HOLDINGS: Record<string, Holding[]> = {
  US: [
    { id: "1", symbol: "NVDA",  name: "NVIDIA Corp",    quantity: 22,  avgBuyPrice: 820,  currentPrice: 1089, color: "#76b900", bg: "#76b90018", letter: "N", sector: "Technology" },
    { id: "2", symbol: "AAPL",  name: "Apple Inc",      quantity: 48,  avgBuyPrice: 178,  currentPrice: 198,  color: "#aaaaaa", bg: "#aaaaaa18", letter: "",  sector: "Technology" },
    { id: "3", symbol: "MSFT",  name: "Microsoft Corp", quantity: 14,  avgBuyPrice: 310,  currentPrice: 378,  color: "#00a4ef", bg: "#00a4ef18", letter: "M", sector: "Technology" },
    { id: "4", symbol: "ADBE",  name: "Adobe Inc",      quantity: 36,  avgBuyPrice: 440,  currentPrice: 498,  color: "#ff0000", bg: "#ff000018", letter: "A", sector: "Technology" },
    { id: "5", symbol: "KO",    name: "Coca-Cola Co",   quantity: 165, avgBuyPrice: 58,   currentPrice: 61,   color: "#f40000", bg: "#f4000018", letter: "K", sector: "Consumer"   },
    { id: "6", symbol: "AMD",   name: "AMD",            quantity: 30,  avgBuyPrice: 148,  currentPrice: 220,  color: "#ed1c24", bg: "#ed1c2418", letter: "A", sector: "Technology" },
  ],
  IN: [
    { id: "1", symbol: "RELIANCE", name: "Reliance Industries", quantity: 25,  avgBuyPrice: 2480, currentPrice: 2940, color: "#0ea5e9", bg: "#0ea5e918", letter: "R", sector: "Energy"  },
    { id: "2", symbol: "TCS",      name: "TCS",                 quantity: 10,  avgBuyPrice: 3600, currentPrice: 3920, color: "#8b5cf6", bg: "#8b5cf618", letter: "T", sector: "IT"      },
    { id: "3", symbol: "INFY",     name: "Infosys",             quantity: 40,  avgBuyPrice: 1520, currentPrice: 1820, color: "#f59e0b", bg: "#f59e0b18", letter: "I", sector: "IT"      },
    { id: "4", symbol: "HDFCBANK", name: "HDFC Bank",           quantity: 15,  avgBuyPrice: 1580, currentPrice: 1710, color: "#10b981", bg: "#10b98118", letter: "H", sector: "Banking" },
    { id: "5", symbol: "WIPRO",    name: "Wipro Ltd",           quantity: 60,  avgBuyPrice: 520,  currentPrice: 468,  color: "#ef4444", bg: "#ef444418", letter: "W", sector: "IT"      },
  ],
  CRYPTO: [
    { id: "1", symbol: "BTC",  name: "Bitcoin",   quantity: 0.5,  avgBuyPrice: 72000, currentPrice: 96400, color: "#f7931a", bg: "#f7931a18", letter: "₿", sector: "L1"   },
    { id: "2", symbol: "ETH",  name: "Ethereum",  quantity: 4,    avgBuyPrice: 2800,  currentPrice: 3580,  color: "#627eea", bg: "#627eea18", letter: "Ξ", sector: "L1"   },
    { id: "3", symbol: "SOL",  name: "Solana",    quantity: 25,   avgBuyPrice: 140,   currentPrice: 188,   color: "#9945ff", bg: "#9945ff18", letter: "◎", sector: "L1"   },
    { id: "4", symbol: "DOGE", name: "Dogecoin",  quantity: 5000, avgBuyPrice: 0.22,  currentPrice: 0.18,  color: "#c2a633", bg: "#c2a63318", letter: "Ð", sector: "Meme" },
  ],
  FX: [
    { id: "1", symbol: "EUR/USD", name: "Euro / USD",   quantity: 10000, avgBuyPrice: 1.072, currentPrice: 1.089, color: "#3b82f6", bg: "#3b82f618", letter: "€", sector: "Major" },
    { id: "2", symbol: "GBP/USD", name: "Pound / USD",  quantity: 5000,  avgBuyPrice: 1.264, currentPrice: 1.272, color: "#8b5cf6", bg: "#8b5cf618", letter: "£", sector: "Major" },
    { id: "3", symbol: "USD/JPY", name: "Dollar / Yen", quantity: 8000,  avgBuyPrice: 148,   currentPrice: 157.8, color: "#f59e0b", bg: "#f59e0b18", letter: "¥", sector: "Major" },
  ],
};

const PORTFOLIO_HISTORY = [
  { t: "Aug", v: 72000 }, { t: "Sep", v: 74500 }, { t: "Oct", v: 78000 },
  { t: "Nov", v: 81000 }, { t: "Dec", v: 86000 }, { t: "Jan", v: 84000 },
  { t: "Feb", v: 88000 }, { t: "Mar", v: 91000 }, { t: "Apr", v: 90200 }, { t: "May", v: 93314 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pnl(h: Holding)    { return (h.currentPrice - h.avgBuyPrice) * h.quantity; }
function pnlPct(h: Holding) { return ((h.currentPrice - h.avgBuyPrice) / h.avgBuyPrice) * 100; }
function marketValue(h: Holding) { return h.currentPrice * h.quantity; }

/**
 * Appends .BSE to Indian stock symbols so the backend resolves them correctly.
 * Idempotent — won't double-append if .BSE is already present.
 */
function resolveSymbol(symbol: string, marketId: string): string {
  if (marketId === "IN" && !symbol.includes(".")) return `${symbol}.BSE`;
  return symbol;
}

function StockAvatar({ symbol, color, bg, letter, size = 36 }: {
  symbol: string; color: string; bg: string; letter: string; size?: number;
}) {
  const [err, setErr] = useState(false);
  const clean = symbol.replace(".BSE", "").replace("/", "").split("").slice(0, 6).join("");
  const domain = LOGO_DOMAINS[clean];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      border: `1px solid ${color}33`, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, color, flexShrink: 0, overflow: "hidden",
    }}>
      {domain && !err ? (
        <img src={`https://icons.duckduckgo.com/ip3/${domain}.ico`} alt={symbol}
          width={size * 0.6} height={size * 0.6} onError={() => setErr(true)}
          style={{ objectFit: "contain", borderRadius: "50%" }} />
      ) : (letter || symbol.charAt(0))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();
  const { market } = useMarket();
  const key = market.id as keyof typeof MOCK_HOLDINGS;
  const currency = market.currency || "$";

  const [holdings, setHoldings]     = useState<Holding[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sortBy, setSortBy]         = useState<"value" | "pnl" | "pnlpct">("value");
  const [filterSector, setFilterSector] = useState("All");

  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ── Fetch holdings from API, enrich each with a live price, fall back to mock ──
  const loadHoldings = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const meRes = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) throw new Error("auth");
      const me = await meRes.json();

      const res = await fetch(`/api/holdings?portfolioId=${me.portfolioId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("holdings");
      const data: Holding[] = await res.json();

      if (data?.length > 0) {
        // ── Enrich each holding with a live currentPrice from the quote API ──
        // Pass ?market=IN so the backend appends .BSE for Indian symbols.
        const enriched = await Promise.all(
          data.map(async (h) => {
            try {
              const qRes = await fetch(
                `/api/stocks/${h.symbol}?market=${market.id}`
              );
              if (!qRes.ok) return h;
              const q = await qRes.json();
              const livePrice = typeof q.price === "number" ? q.price : h.currentPrice;
              return { ...h, currentPrice: livePrice };
            } catch {
              return h; // keep original price on fetch failure
            }
          })
        );
        setHoldings(enriched);
      } else {
        setHoldings(MOCK_HOLDINGS[key] ?? MOCK_HOLDINGS["US"]);
      }
    } catch {
      setHoldings(MOCK_HOLDINGS[key] ?? MOCK_HOLDINGS["US"]);
    } finally {
      setLoading(false);
    }
  }, [key, market.id]);

  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalValue  = holdings.reduce((s, h) => s + marketValue(h), 0);
  const totalCost   = holdings.reduce((s, h) => s + h.avgBuyPrice * h.quantity, 0);
  const totalPnL    = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const isUp        = totalPnL >= 0;

  // Sector breakdown for donut
  const sectors    = Array.from(new Set(holdings.map((h) => h.sector)));
  const sectorData = sectors.map((s, i) => ({
    name:  s,
    value: holdings.filter((h) => h.sector === s).reduce((a, h) => a + marketValue(h), 0),
    color: ["#8FFFD6", "#6366f1", "#f59e0b", "#ef4444", "#a855f7"][i % 5],
  }));

  // Sort + filter
  const allSectors = ["All", ...sectors];
  const displayed  = holdings
    .filter((h) => filterSector === "All" || h.sector === filterSector)
    .sort((a, b) =>
      sortBy === "value"  ? marketValue(b) - marketValue(a) :
      sortBy === "pnl"    ? pnl(b) - pnl(a) :
                            pnlPct(b) - pnlPct(a)
    );

  const fmt = (n: number) =>
    Math.abs(n) >= 1000
      ? `${currency}${(n / 1000).toFixed(1)}k`
      : `${currency}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto", fontFamily: "'Geist','Inter',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>My Portfolio</h1>
          <p style={{ color: "#555", fontSize: 12, margin: "4px 0 0" }}>{market.flag} {market.label} · {holdings.length} positions</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadHoldings} style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid #1f1f1f",
            background: "transparent", color: "#555", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => router.push("/dashboard")} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
            background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer",
            color: "#0a0a0a", fontWeight: 700, fontSize: 13,
          }}>
            <Plus size={14} /> Add Position
          </button>
        </div>
      </div>

      {/* ── Top stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
        <div style={{
          background: "#111111", border: "1px solid #1f1f1f", borderRadius: 14,
          padding: "20px 22px", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 120,
            background: `radial-gradient(ellipse at right, ${isUp ? "#8FFFD6" : "#ef4444"}08 0%, transparent 70%)`,
            pointerEvents: "none" }} />
          <p style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>Total Value</p>
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 28, margin: 0, letterSpacing: -0.5 }}>
            {currency}{totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            {isUp ? <TrendingUp size={13} color="#22c55e" /> : <TrendingDown size={13} color="#ef4444" />}
            <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
              {isUp ? "+" : ""}{currency}{Math.abs(totalPnL).toLocaleString("en-US", { minimumFractionDigits: 2 })} ({isUp ? "+" : ""}{totalPnLPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {[
          { label: "Total Cost",     value: `${currency}${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,                                                            color: "#888"                       },
          { label: "Unrealized P&L", value: `${totalPnL >= 0 ? "+" : ""}${currency}${Math.abs(totalPnL).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: isUp ? "#22c55e" : "#ef4444" },
          { label: "Positions",      value: holdings.length.toString(),                                                                                                                   color: "#8FFFD6"                    },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 14, padding: "20px 22px" }}>
            <p style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px" }}>{label}</p>
            <p style={{ color, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: -0.3 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Chart + Donut ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 14, padding: "20px 22px" }}>
          <p style={{ color: "#fff", fontWeight: 600, fontSize: 13, margin: "0 0 16px" }}>Portfolio Performance</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={PORTFOLIO_HISTORY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8FFFD6" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#8FFFD6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 8, fontSize: 11 }}
                itemStyle={{ color: "#8FFFD6" }} labelStyle={{ color: "#555" }} />
              <Area type="monotone" dataKey="v" stroke="#8FFFD6" strokeWidth={2}
                fill="url(#pg)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 14, padding: "20px 22px" }}>
          <p style={{ color: "#fff", fontWeight: 600, fontSize: 13, margin: "0 0 12px" }}>Allocation</p>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={sectorData} cx="50%" cy="50%" innerRadius={32} outerRadius={50}
                dataKey="value" stroke="none">
                {sectorData.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => [`${currency}${Number(v).toLocaleString()}`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {sectorData.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  <span style={{ color: "#888", fontSize: 11 }}>{s.name}</span>
                </div>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>
                  {totalValue > 0 ? ((s.value / totalValue) * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Holdings Table ── */}
      <div style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 14, overflow: "hidden" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #1a1a1a" }}>
          <p style={{ color: "#fff", fontWeight: 600, fontSize: 13, margin: 0 }}>Holdings</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {allSectors.map((s) => (
                <button key={s} onClick={() => setFilterSector(s)} style={{
                  padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11,
                  background: filterSector === s ? "#8FFFD618" : "transparent",
                  color: filterSector === s ? "#8FFFD6" : "#444",
                  fontWeight: filterSector === s ? 600 : 400,
                }}>{s}</button>
              ))}
            </div>
            <div style={{ display: "flex", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: 3, gap: 2 }}>
              {(["value", "pnl", "pnlpct"] as const).map((s) => (
                <button key={s} onClick={() => setSortBy(s)} style={{
                  padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600,
                  background: sortBy === s ? "#1f1f1f" : "transparent",
                  color: sortBy === s ? "#8FFFD6" : "#444",
                }}>
                  {s === "value" ? "Value" : s === "pnl" ? "P&L $" : "P&L %"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 80px",
          padding: "10px 20px", borderBottom: "1px solid #1a1a1a" }}>
          {["Asset", "Qty", "Avg Price", "Current", "Market Value", "P&L", ""].map((h) => (
            <span key={h} style={{ color: "#444", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 28, height: 28, border: "2px solid #1f1f1f", borderTop: "2px solid #8FFFD6",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "#555", fontSize: 13 }}>Loading holdings…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ color: "#8FFFD6", fontSize: 32, margin: "0 0 12px" }}>📈</p>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No holdings yet</p>
            <p style={{ color: "#555", fontSize: 13, margin: "0 0 20px" }}>Start building your portfolio by buying your first stock.</p>
            <button onClick={() => router.push("/dashboard")} style={{
              padding: "10px 20px", background: "#8FFFD6", borderRadius: 10, border: "none",
              color: "#0a0a0a", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>Browse Stocks</button>
          </div>
        ) : (
          displayed.map((h, i) => {
            const mv  = marketValue(h);
            const pl  = pnl(h);
            const plp = pnlPct(h);
            const up  = pl >= 0;
            // ── Navigate with market param so stock detail page uses correct suffix ──
            const navSymbol = resolveSymbol(h.symbol, market.id);
            return (
              <div key={h.id}
                onClick={() => router.push(`/dashboard/stock/${navSymbol}?market=${market.id}`)}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 80px",
                  padding: "14px 20px", borderBottom: i < displayed.length - 1 ? "1px solid #141414" : "none",
                  cursor: "pointer", transition: "background 0.15s", alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#141414")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StockAvatar symbol={h.symbol} color={h.color} bg={h.bg} letter={h.letter} size={34} />
                  <div>
                    <p style={{ color: "#fff", fontWeight: 600, fontSize: 13, margin: 0 }}>{h.symbol}</p>
                    <p style={{ color: "#555", fontSize: 11, margin: "2px 0 0", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</p>
                  </div>
                </div>
                <span style={{ color: "#888", fontSize: 13 }}>{h.quantity.toLocaleString()}</span>
                <span style={{ color: "#888", fontSize: 13 }}>{currency}{h.avgBuyPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{currency}{h.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{currency}{mv.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <div>
                  <p style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {up ? "+" : ""}{currency}{Math.abs(pl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 10, margin: "2px 0 0", opacity: 0.7 }}>
                    {up ? "+" : ""}{plp.toFixed(2)}%
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/stock/${navSymbol}?market=${market.id}`); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "6px 10px",
                    borderRadius: 7, border: "1px solid #1f1f1f", background: "transparent",
                    color: "#888", cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.15s",
                  }}>
                  Trade <ArrowUpRight size={11} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}