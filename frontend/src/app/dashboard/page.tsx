"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMarket } from "@/lib/MarketContext";
import StockSearch from "@/components/StockSearch";
import { useLivePrices } from "@/lib/websocket";

const MARKET_DATA: Record<string, {
  holdings: { symbol: string; shares: number; color: string; bg: string; letter: string }[];
  transactions: { symbol: string; name: string; change: number | null; amount: number; color: string; bg: string; letter: string }[];
  portfolioValue: string;
  portfolioGain: string;
  tradingScore: string;
  tradingPoints: number;
}> = {
  IN: {
    holdings: [
      { symbol: "RELIANCE", shares: 25,  color: "#0ea5e9", bg: "#0ea5e922", letter: "R" },
      { symbol: "TCS",      shares: 10,  color: "#8b5cf6", bg: "#8b5cf622", letter: "T" },
      { symbol: "INFY",     shares: 40,  color: "#f59e0b", bg: "#f59e0b22", letter: "I" },
      { symbol: "HDFCBANK", shares: 15,  color: "#10b981", bg: "#10b98122", letter: "H" },
      { symbol: "WIPRO",    shares: 60,  color: "#ef4444", bg: "#ef444422", letter: "W" },
    ],
    transactions: [
      { symbol: "RELIANCE", name: "Reliance",  change: +2,   amount: -4200, color: "#0ea5e9", bg: "#0ea5e922", letter: "R" },
      { symbol: "TCS",      name: "TCS",       change: -3,   amount: +1800, color: "#8b5cf6", bg: "#8b5cf622", letter: "T" },
      { symbol: "INFY",     name: "Infosys",   change: null, amount: +950,  color: "#f59e0b", bg: "#f59e0b22", letter: "I" },
      { symbol: "HDFCBANK", name: "HDFC Bank", change: null, amount: -2100, color: "#10b981", bg: "#10b98122", letter: "H" },
      { symbol: "WIPRO",    name: "Wipro",     change: null, amount: -800,  color: "#ef4444", bg: "#ef444422", letter: "W" },
    ],
    portfolioValue: "₹7,84,320",
    portfolioGain: "+₹62,410 this month",
    tradingScore: "₹9,42,500",
    tradingPoints: 4820,
  },
  US: {
    holdings: [
      { symbol: "MSFT", shares: 14,  color: "#00a4ef", bg: "#00a4ef22", letter: "M" },
      { symbol: "ADBE", shares: 36,  color: "#ff0000", bg: "#ff000022", letter: "A" },
      { symbol: "NVDA", shares: 22,  color: "#76b900", bg: "#76b90022", letter: "N" },
      { symbol: "KO",   shares: 165, color: "#f40000", bg: "#f4000022", letter: "K" },
      { symbol: "AAPL", shares: 48,  color: "#aaaaaa", bg: "#aaaaaa22", letter: "" },
    ],
    transactions: [
      { symbol: "TSLA",  name: "Tesla",      change: +3,   amount: -525,  color: "#ef4444", bg: "#ef444422", letter: "T" },
      { symbol: "AAPL",  name: "Apple",      change: -7,   amount: +120,  color: "#aaaaaa", bg: "#aaaaaa22", letter: "" },
      { symbol: "AMD",   name: "AMD",        change: null, amount: +280,  color: "#ed1c24", bg: "#ed1c2422", letter: "A" },
      { symbol: "SNCLD", name: "Soundcloud", change: null, amount: -90,   color: "#ff5500", bg: "#ff550022", letter: "S" },
      { symbol: "MCD",   name: "McDonald's", change: null, amount: -340,  color: "#ffbc0d", bg: "#ffbc0d22", letter: "M" },
    ],
    portfolioValue: "$93,314",
    portfolioGain: "+$8,461 this month",
    tradingScore: "$1,184,600",
    tradingPoints: 6280,
  },
  CRYPTO: {
    holdings: [
      { symbol: "BTC",  shares: 0.5,  color: "#f7931a", bg: "#f7931a22", letter: "₿" },
      { symbol: "ETH",  shares: 4.2,  color: "#627eea", bg: "#627eea22", letter: "Ξ" },
      { symbol: "SOL",  shares: 32,   color: "#9945ff", bg: "#9945ff22", letter: "S" },
      { symbol: "BNB",  shares: 8,    color: "#f3ba2f", bg: "#f3ba2f22", letter: "B" },
      { symbol: "AVAX", shares: 15,   color: "#e84142", bg: "#e8414222", letter: "A" },
    ],
    transactions: [
      { symbol: "BTC",  name: "Bitcoin",   change: +2.4, amount: -1240, color: "#f7931a", bg: "#f7931a22", letter: "₿" },
      { symbol: "ETH",  name: "Ethereum",  change: -1.8, amount: +620,  color: "#627eea", bg: "#627eea22", letter: "Ξ" },
      { symbol: "SOL",  name: "Solana",    change: +5.1, amount: -380,  color: "#9945ff", bg: "#9945ff22", letter: "S" },
      { symbol: "BNB",  name: "BNB",       change: null, amount: +210,  color: "#f3ba2f", bg: "#f3ba2f22", letter: "B" },
      { symbol: "AVAX", name: "Avalanche", change: null, amount: -90,   color: "#e84142", bg: "#e8414222", letter: "A" },
    ],
    portfolioValue: "$28,540",
    portfolioGain: "+$3,120 this month",
    tradingScore: "$842,000",
    tradingPoints: 3140,
  },
  FX: {
    holdings: [
      { symbol: "EUR/USD", shares: 10000, color: "#3b82f6", bg: "#3b82f622", letter: "€" },
      { symbol: "GBP/USD", shares: 5000,  color: "#8b5cf6", bg: "#8b5cf622", letter: "£" },
      { symbol: "USD/JPY", shares: 8000,  color: "#f59e0b", bg: "#f59e0b22", letter: "¥" },
      { symbol: "AUD/USD", shares: 12000, color: "#10b981", bg: "#10b98122", letter: "A" },
      { symbol: "USD/CAD", shares: 6000,  color: "#ef4444", bg: "#ef444422", letter: "C" },
    ],
    transactions: [
      { symbol: "EUR/USD", name: "EUR/USD", change: +1,   amount: -1200, color: "#3b82f6", bg: "#3b82f622", letter: "€" },
      { symbol: "GBP/USD", name: "GBP/USD", change: -2,  amount: +800,  color: "#8b5cf6", bg: "#8b5cf622", letter: "£" },
      { symbol: "USD/JPY", name: "USD/JPY", change: null, amount: +450,  color: "#f59e0b", bg: "#f59e0b22", letter: "¥" },
      { symbol: "AUD/USD", name: "AUD/USD", change: null, amount: -320,  color: "#10b981", bg: "#10b98122", letter: "A" },
      { symbol: "USD/CAD", name: "USD/CAD", change: null, amount: -180,  color: "#ef4444", bg: "#ef444422", letter: "C" },
    ],
    portfolioValue: "$48,720",
    portfolioGain: "+$3,210 this month",
    tradingScore: "$2,340,000",
    tradingPoints: 8940,
  },
};

const ALL_BUY_SELL_DATA = [
  { date: "Sep", value: 4200, daysAgo: 240 },
  { date: "Oct", value: 3800, daysAgo: 210 },
  { date: "Nov", value: 4100, daysAgo: 180 },
  { date: "Dec", value: 3600, daysAgo: 150 },
  { date: "Jan", value: 5200, daysAgo: 120 },
  { date: "Feb", value: 6800, daysAgo: 90  },
  { date: "Mar", value: 7400, daysAgo: 60  },
  { date: "Apr", value: 6900, daysAgo: 30  },
  { date: "May", value: 8200, daysAgo: 14  },
  { date: "Jun", value: 9100, daysAgo: 0   },
];

function filterDashboardData(range: string) {
  const cutoffs: Record<string, number> = { "1D": 1, "7D": 7, "1M": 30, "1Y": 365, "All": 9999 };
  const maxDays = cutoffs[range] ?? 9999;
  const filtered = ALL_BUY_SELL_DATA.filter(d => d.daysAgo <= maxDays);
  return filtered.length >= 2 ? filtered : ALL_BUY_SELL_DATA.slice(-2);
}

const PORTFOLIO_CATEGORIES = [
  { label: "Stocks", pct: 40, color: "#a78bfa" },
  { label: "Crypto", pct: 30, color: "#818cf8" },
  { label: "Funds",  pct: 22, color: "#6366f1" },
  { label: "Other",  pct: 8,  color: "#4f46e5" },
];

const WEEKLY_ACTIVITY = [
  { day: "M", trades: 6 }, { day: "T", trades: 9 },  { day: "W", trades: 12 },
  { day: "T", trades: 8 }, { day: "F", trades: 11 }, { day: "S", trades: 5 }, { day: "S", trades: 4 },
];

const BAR_HEIGHTS: Record<string, number[]> = {
  Stocks: [45,62,38,71,55,48,66,42,58,74,51,63,47,69,54,61,43,70,56,65],
  Crypto: [38,55,71,44,62,49,67,41,58,73,50,64,46,68,53,60,42,69,55,63],
  Funds:  [52,41,65,48,59,72,44,61,47,66,53,70,45,62,49,57,64,43,68,51],
  Other:  [33,58,44,67,39,54,71,46,63,48,57,42,69,50,61,36,72,45,59,64],
};

const EVENT_PINS: Record<string, { label: string; letter: string; color: string; left: string; top: string }[]> = {
  IN: [
    { label: "Reliance Q3 Strong",  letter: "R", color: "#8FFFD6", left: "8%",  top: "60%" },
    { label: "TCS Record Revenue",  letter: "T", color: "#fff",    left: "52%", top: "10%" },
    { label: "HDFC Merger Done",    letter: "H", color: "#ef4444", left: "68%", top: "28%" },
  ],
  US: [
    { label: "NVIDIA Q3 Earnings",  letter: "N", color: "#8FFFD6", left: "8%",  top: "60%" },
    { label: "Apple Record Revenue",letter: "A", color: "#fff",    left: "52%", top: "10%" },
    { label: "Tesla FSD 2.0",       letter: "T", color: "#ef4444", left: "68%", top: "28%" },
  ],
  CRYPTO: [
    { label: "BTC ETF Approval",    letter: "₿", color: "#8FFFD6", left: "8%",  top: "60%" },
    { label: "ETH Dencun Upgrade",  letter: "Ξ", color: "#fff",    left: "52%", top: "10%" },
    { label: "SOL Congestion",      letter: "S", color: "#ef4444", left: "68%", top: "28%" },
  ],
  FX: [
    { label: "Fed Rate Decision",   letter: "F", color: "#8FFFD6", left: "8%",  top: "60%" },
    { label: "ECB Rate Cut",        letter: "E", color: "#fff",    left: "52%", top: "10%" },
    { label: "USD/JPY 5-Year High", letter: "¥", color: "#ef4444", left: "68%", top: "28%" },
  ],
};

const TIME_RANGES = ["1D", "7D", "1M", "1Y", "All"];

const LOGO_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com", AAPL: "apple.com", AMD: "amd.com",
  MSFT: "microsoft.com", NVDA: "nvidia.com", ADBE: "adobe.com",
  KO: "coca-cola.com", MCD: "mcdonalds.com", SNCLD: "soundcloud.com",
  RELIANCE: "ril.com", TCS: "tcs.com", INFY: "infosys.com",
  HDFCBANK: "hdfcbank.com", WIPRO: "wipro.com",
};

function getLogoUrl(sym: string, domain?: string) {
  return domain
    ? `https://icons.duckduckgo.com/ip3/${domain}.ico`
    : `https://unavatar.io/clearbit/${sym.toLowerCase()}`;
}

function resolveSymbol(symbol: string, marketId: string) {
  if (marketId === "IN" && !symbol.includes(".") && !symbol.includes("/"))
    return `${symbol}.BSE`;
  return symbol;
}

function StockAvatar({ symbol, color, bg, letter, px = 32 }: {
  symbol: string; color: string; bg: string; letter: string; px?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const clean = symbol.replace(/\.BSE$/, "").toUpperCase();
  const isFx  = symbol.includes("/");
  const url   = getLogoUrl(clean, LOGO_DOMAINS[clean]);
  return (
    <div style={{
      width: px, height: px, borderRadius: "50%", flexShrink: 0,
      background: bg, color, border: `1px solid ${color}33`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: px * 0.33, fontWeight: 700, overflow: "hidden",
    }}>
      {!imgError && !isFx ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={symbol} width={px * 0.6} height={px * 0.6}
          style={{ objectFit: "contain", borderRadius: "50%" }}
          onError={() => setImgError(true)} />
      ) : (letter || clean.charAt(0))}
    </div>
  );
}

function CoinSVG() {
  return (
    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "45%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
      <svg width="160" height="160" viewBox="0 0 180 180" style={{ opacity: 0.9 }}>
        <defs>
          <radialGradient id="cg1" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2d2d2d"/><stop offset="100%" stopColor="#111"/>
          </radialGradient>
          <radialGradient id="cg2" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#353535"/><stop offset="100%" stopColor="#181818"/>
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="115" rx="55" ry="55" fill="url(#cg1)"/>
        <ellipse cx="100" cy="112" rx="48" ry="48" fill="url(#cg2)"/>
        <ellipse cx="80" cy="90" rx="58" ry="58" fill="url(#cg1)"/>
        <ellipse cx="80" cy="87" rx="50" ry="50" fill="url(#cg2)"/>
        <polygon points="85,62 72,88 82,88 75,115 93,82 82,82" fill="#8FFFD6" opacity="0.95"/>
        <polygon points="105,68 90,92 100,92 92,118 112,85 100,85" fill="#8FFFD6" opacity="0.6"/>
      </svg>
    </div>
  );
}

function LiveDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, marginLeft: 4 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#8FFFD6", opacity: 0.75, animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ position: "relative", borderRadius: "50%", width: 8, height: 8, background: "#8FFFD6", display: "inline-flex" }} />
    </span>
  );
}

// Card wrapper
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--color-card)",
      border: "1px solid var(--color-line)",
      borderRadius: 16,
      padding: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeRange, setActiveRange] = useState("1M");

  const { market } = useMarket();
  const rawKey = market.id as string;
  const key    = (["IN","US","FX","CRYPTO"].includes(rawKey)) ? rawKey : "US";
  const md       = MARKET_DATA[key];
  const currency = market.currency || "$";
  const pins     = EVENT_PINS[key] ?? EVENT_PINS["US"];

  const txSymbols  = md.transactions.map(t => resolveSymbol(t.symbol, key));
  const livePrices = useLivePrices(txSymbols);

  return (
    <div style={{
      minHeight: "100vh",
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      background: "var(--color-page)",
      fontFamily: "'Geist', 'Inter', sans-serif",
      boxSizing: "border-box",
      width: "100%",
      overflowX: "hidden",
    }}>

      {/* Search */}
      <div style={{ maxWidth: 440 }}>
        <StockSearch />
      </div>

      {/* ── ROW 1: Chart + Trading Score ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 240px", gap: 12 }}>

        {/* Buy & Sell Activity */}
        <Card style={{ position: "relative", overflow: "hidden", minHeight: 240, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>Buy &amp; Sell Activity</span>
            <div style={{ display: "flex", gap: 4 }}>
              {TIME_RANGES.map(r => (
                <button key={r} onClick={() => setActiveRange(r)} style={{
                  padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                  background: activeRange === r ? "var(--color-primary)" : "transparent",
                  color: activeRange === r ? "var(--color-page)" : "var(--color-muted)",
                  border: activeRange === r ? "none" : "1px solid var(--color-line)",
                  cursor: "pointer",
                }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div style={{ position: "relative", height: 150 }}>
            {/* Event pins */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }}>
              {pins.map((pin, i) => (
                <div key={i} style={{ position: "absolute", left: pin.left, top: pin.top, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    borderRadius: 99, padding: "2px 6px", fontSize: 8, fontWeight: 600, whiteSpace: "nowrap", marginBottom: 2,
                    background: pin.color === "#8FFFD6" ? "#8FFFD611" : pin.color === "#fff" ? "#88888811" : "#ef444411",
                    color: pin.color === "#8FFFD6" ? "#8FFFD6" : pin.color === "#fff" ? "var(--color-primary)" : "#ef9999",
                    border: `1px solid ${pin.color === "#8FFFD6" ? "#8FFFD633" : pin.color === "#fff" ? "var(--color-line)" : "#ef444433"}`,
                  }}>{pin.label}</div>
                  <div style={{ width: 1, height: 14, background: pin.color + "55" }} />
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%", fontSize: 7, fontWeight: 700, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: pin.color === "#8FFFD6" ? "#76b900" : pin.color === "#fff" ? "var(--color-muted)" : "#ef4444",
                  }}>{pin.letter}</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={filterDashboardData(activeRange)} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8FFFD6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#8FFFD6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 9 }} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 11 }}
                  itemStyle={{ color: "var(--color-primary)" }}
                  labelStyle={{ color: "var(--color-muted)" }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={1.5}
                  fill="url(#actGrad)" dot={false} isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Trading Score */}
        <Card style={{ position: "relative", overflow: "hidden", minHeight: 240 }}>
          <CoinSVG />
          <div style={{ position: "relative", zIndex: 10 }}>
            <p style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 12, marginBottom: 20 }}>Trading Score</p>
            <p style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: 24, lineHeight: 1, letterSpacing: "-0.03em", margin: "0 0 4px" }}>
              {md.tradingScore}
            </p>
            <p style={{ color: "var(--color-muted)", fontSize: 11, margin: "0 0 16px" }}>Total buy volume</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: 20 }}>
                {md.tradingPoints.toLocaleString()}
              </span>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#8FFFD622", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#8FFFD6"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
            </div>
            <p style={{ color: "var(--color-muted)", fontSize: 11, marginTop: 2 }}>Trading points</p>
          </div>
        </Card>
      </div>

      {/* ── ROW 2: Holdings | Portfolio | Transactions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr) minmax(0,1fr)", gap: 12 }}>

        {/* LEFT col */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* Total Holdings */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>Total holdings</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {md.holdings.map(h => {
                const navSymbol = resolveSymbol(h.symbol, key);
                return (
                  <button key={h.symbol}
                    onClick={() => router.push(`/dashboard/stock/${navSymbol}?market=${key}`)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 8px", borderRadius: 10, background: "transparent",
                      border: "none", cursor: "pointer", textAlign: "left",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <StockAvatar symbol={h.symbol} color={h.color} bg={h.bg} letter={h.letter} px={28} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 600, margin: 0 }}>
                        {h.shares} {h.shares > 999 ? "u" : "Sh"}
                      </p>
                      <p style={{ color: "var(--color-muted)", fontSize: 9, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 60 }}>
                        {h.symbol.replace(".BSE","")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Trading Activity */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13, margin: "0 0 4px" }}>Trading Activity</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: 22 }}>48</span>
                  <span style={{ color: "var(--color-muted)", fontSize: 11 }}>/trades</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }}>
                {WEEKLY_ACTIVITY.map((d, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{
                      width: 10, borderRadius: 3,
                      height: `${(d.trades / 12) * 34}px`,
                      background: i === 2 ? "#8FFFD6" : "var(--color-line)",
                    }}/>
                    <span style={{ color: "var(--color-muted)", fontSize: 7 }}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Next Dividend */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>Next Dividend</span>
              <span style={{ color: "var(--color-muted)", fontSize: 13 }}>···</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "var(--color-muted)", fontSize: 10, margin: 0 }}>Expected</p>
                <p style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: 16, margin: "2px 0" }}>
                  {key === "IN" ? "₹2,840" : key === "FX" ? "$128.40" : "$342.80"}
                </p>
                <p style={{ color: "var(--color-muted)", fontSize: 9, margin: 0 }}>Jul 15, 2025</p>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 32 }}>
                {[4,7,5,9,6,8,5,7,9,6,8,5].map((v, i) => (
                  <div key={i} style={{ width: 4, borderRadius: 2, height: `${(v / 9) * 28}px`, background: "var(--color-line)" }}/>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* CENTER: Portfolio */}
        <Card style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>My Portfolio</span>
            <button style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600,
              background: "var(--color-primary)", color: "var(--color-page)",
              border: "none", cursor: "pointer",
            }}>
              + Deposit
            </button>
          </div>
          <p style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: 26, lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 4px" }}>
            {md.portfolioValue}
          </p>
          <p style={{ color: "#22c55e", fontSize: 12, fontWeight: 600, margin: "0 0 12px" }}>{md.portfolioGain}</p>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            {PORTFOLIO_CATEGORIES.map(cat => (
              <div key={cat.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--color-muted)", fontSize: 11 }}>{cat.label}</span>
                  <span style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 700 }}>{cat.pct}%</span>
                </div>
                <div style={{ height: 44, borderRadius: 10, overflow: "hidden", background: "var(--color-surface-hover)", position: "relative" }}>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "flex-end", gap: 1, padding: "0 4px", height: "100%" }}>
                    {BAR_HEIGHTS[cat.label].map((h, i) => (
                      <div key={i} style={{ flex: 1, borderRadius: "2px 2px 0 0", height: `${h}%`, background: cat.color, opacity: 0.65 + i / 60 }}/>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* RIGHT: Transactions */}
        <Card style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>Transactions</span>
              {Object.values(livePrices).some(p => p.live) && <LiveDot />}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: "var(--color-muted)", fontSize: 11 }}>Today</span>
            <span style={{ color: "var(--color-muted)", fontSize: 11 }}>5 Transactions</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {md.transactions.map(tx => {
              const resolvedSym   = resolveSymbol(tx.symbol, key);
              const live          = livePrices[resolvedSym];
              const liveChange    = live?.changePct ?? null;
              const displayChange = live?.live ? liveChange : tx.change;
              const isPos         = displayChange !== null && displayChange > 0;
              const isNeg         = displayChange !== null && displayChange < 0;

              return (
                <button key={tx.symbol}
                  onClick={() => router.push(`/dashboard/stock/${resolvedSym}?market=${key}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 6px", borderRadius: 10, width: "100%",
                    background: "transparent", border: "none", cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <StockAvatar symbol={tx.symbol} color={tx.color} bg={tx.bg} letter={tx.letter} px={30} />

                  <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <p style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.symbol.replace(".BSE","")}
                    </p>
                    {live?.live ? (
                      <p style={{ fontSize: 10, fontWeight: 600, margin: 0, color: isPos ? "#22c55e" : isNeg ? "#ef4444" : "var(--color-muted)" }}>
                        {currency}{live.price?.toFixed(2)}
                      </p>
                    ) : (
                      <p style={{ color: "var(--color-muted)", fontSize: 10, margin: 0 }}>{tx.name}</p>
                    )}
                  </div>

                  {displayChange !== null && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 99, flexShrink: 0,
                      background: isPos ? "#22c55e22" : "#ef444422",
                      color: isPos ? "#22c55e" : "#ef4444",
                    }}>
                      {isPos ? "+" : ""}{live?.live ? `${liveChange?.toFixed(1)}%` : displayChange}
                    </span>
                  )}

                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 8, flexShrink: 0,
                    background: tx.amount < 0 ? "#ef444422" : "#22c55e22",
                    color: tx.amount < 0 ? "#ef4444" : "#22c55e",
                  }}>
                    {tx.amount < 0 ? "-" : "+"}{currency}{Math.abs(tx.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}