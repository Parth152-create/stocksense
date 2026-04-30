"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMarket } from "@/lib/MarketContext";
import StockSearch from "@/components/StockSearch";

// ─── Market-aware data ────────────────────────────────────────────────────────

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
    portfolioValue: "₹7,84,320.00",
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
      { symbol: "TSLA",  name: "Tesla",       change: +3,   amount: -525,  color: "#ef4444", bg: "#ef444422", letter: "T" },
      { symbol: "AAPL",  name: "Apple",       change: -7,   amount: +120,  color: "#aaaaaa", bg: "#aaaaaa22", letter: "" },
      { symbol: "AMD",   name: "AMD",         change: null, amount: +280,  color: "#ed1c24", bg: "#ed1c2422", letter: "A" },
      { symbol: "SNCLD", name: "Soundcloud",  change: null, amount: -90,   color: "#ff5500", bg: "#ff550022", letter: "S" },
      { symbol: "MCD",   name: "McDonald's",  change: null, amount: -340,  color: "#ffbc0d", bg: "#ffbc0d22", letter: "M" },
    ],
    portfolioValue: "$93,314.56",
    portfolioGain: "+$8,461.16 this month",
    tradingScore: "$1,184,600",
    tradingPoints: 6280,
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
      { symbol: "EUR/USD", name: "Euro/Dollar",   change: +1,   amount: -1200, color: "#3b82f6", bg: "#3b82f622", letter: "€" },
      { symbol: "GBP/USD", name: "Pound/Dollar",  change: -2,   amount: +800,  color: "#8b5cf6", bg: "#8b5cf622", letter: "£" },
      { symbol: "USD/JPY", name: "Dollar/Yen",    change: null, amount: +450,  color: "#f59e0b", bg: "#f59e0b22", letter: "¥" },
      { symbol: "AUD/USD", name: "Aussie/Dollar", change: null, amount: -320,  color: "#10b981", bg: "#10b98122", letter: "A" },
      { symbol: "USD/CAD", name: "Dollar/CAD",    change: null, amount: -180,  color: "#ef4444", bg: "#ef444422", letter: "C" },
    ],
    portfolioValue: "$48,720.00",
    portfolioGain: "+$3,210.50 this month",
    tradingScore: "$2,340,000",
    tradingPoints: 8940,
  },
};

// ─── Static data ──────────────────────────────────────────────────────────────

const BUY_SELL_DATA = [
  { date: "Sep", value: 4200 }, { date: "Oct", value: 3800 }, { date: "Nov", value: 4100 },
  { date: "Dec", value: 3600 }, { date: "Jan", value: 5200 }, { date: "Feb", value: 6800 },
  { date: "Mar", value: 7400 }, { date: "Apr", value: 6900 }, { date: "May", value: 8200 },
  { date: "Jun", value: 9100 },
];

const PORTFOLIO_CATEGORIES = [
  { label: "Stocks", pct: 40, color: "#a78bfa" },
  { label: "Crypto", pct: 30, color: "#818cf8" },
  { label: "Funds",  pct: 22, color: "#6366f1" },
  { label: "Other",  pct: 8,  color: "#4f46e5" },
];

const WEEKLY_ACTIVITY = [
  { day: "M", trades: 6 }, { day: "T", trades: 9 }, { day: "W", trades: 12 },
  { day: "T", trades: 8 }, { day: "F", trades: 11 }, { day: "S", trades: 5 }, { day: "S", trades: 4 },
];

// Stable bar heights — no Math.random() to avoid hydration flicker
const BAR_HEIGHTS: Record<string, number[]> = {
  Stocks: [45,62,38,71,55,48,66,42,58,74,51,63,47,69,54,61,43,70,56,65],
  Crypto: [38,55,71,44,62,49,67,41,58,73,50,64,46,68,53,60,42,69,55,63],
  Funds:  [52,41,65,48,59,72,44,61,47,66,53,70,45,62,49,57,64,43,68,51],
  Other:  [33,58,44,67,39,54,71,46,63,48,57,42,69,50,61,36,72,45,59,64],
};

const EVENT_PINS: Record<string, { label: string; letter: string; color: string; left: string; top: string }[]> = {
  IN: [
    { label: "Reliance Q3 Results Strong",  letter: "R", color: "#8FFFD6", left: "8%",  top: "60%" },
    { label: "TCS Reports Record Revenue",  letter: "T", color: "#fff",    left: "52%", top: "10%" },
    { label: "HDFC Bank Merger Complete",   letter: "H", color: "#ef4444", left: "60%", top: "28%" },
  ],
  US: [
    { label: "NVIDIA Reports Strong Q3 Earnings",      letter: "N", color: "#8FFFD6", left: "8%",  top: "60%" },
    { label: "Apple Reports Record Services Revenue",  letter: "A", color: "#fff",    left: "52%", top: "10%" },
    { label: "Tesla Launches Full Self-Driving 2.0",   letter: "T", color: "#ef4444", left: "60%", top: "28%" },
  ],
  FX: [
    { label: "Fed Rate Decision Impact",    letter: "F", color: "#8FFFD6", left: "8%",  top: "60%" },
    { label: "ECB Rate Cut Announcement",   letter: "E", color: "#fff",    left: "52%", top: "10%" },
    { label: "USD/JPY Hits 5-Year High",    letter: "¥", color: "#ef4444", left: "60%", top: "28%" },
  ],
};

const TIME_RANGES = ["1D", "7D", "1M", "1Y", "All"];

// ─── Components ───────────────────────────────────────────────────────────────

// Maps ticker → company domain (used for favicon/logo fetching)
const LOGO_DOMAINS: Record<string, string> = {
  // US
  TSLA: "tesla.com",       AAPL: "apple.com",       AMD: "amd.com",
  MSFT: "microsoft.com",   NVDA: "nvidia.com",       ADBE: "adobe.com",
  KO: "coca-cola.com",     MCD: "mcdonalds.com",     SNCLD: "soundcloud.com",
  AMZN: "amazon.com",      GOOGL: "google.com",      META: "meta.com",
  NFLX: "netflix.com",     INTC: "intel.com",        UBER: "uber.com",
  SPOT: "spotify.com",     PYPL: "paypal.com",       SHOP: "shopify.com",
  // India
  RELIANCE: "ril.com",     TCS: "tcs.com",           INFY: "infosys.com",
  HDFCBANK: "hdfcbank.com",WIPRO: "wipro.com",       TATAMOTORS: "tatamotors.com",
};

// Returns a working logo URL for a ticker using multiple CDN sources
function getLogoUrl(cleanSymbol: string, domain: string | undefined): string {
  if (domain) {
    // Use DuckDuckGo favicon service — no key, no domain config needed, always works
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  }
  // Fallback: unavatar (aggregates from multiple sources, no key)
  return `https://unavatar.io/clearbit/${cleanSymbol.toLowerCase()}`;
}

function StockAvatar({ symbol, color, bg, letter, px = 36 }: {
  symbol: string; color: string; bg: string; letter: string; px?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const cleanSymbol = symbol.replace(/\.BSE$/, "").replace(/^FX_/, "").toUpperCase();
  const isFxPair = symbol.includes("/");
  const domain = LOGO_DOMAINS[cleanSymbol];
  const logoUrl = getLogoUrl(cleanSymbol, domain);

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0 overflow-hidden"
      style={{ width: px, height: px, background: bg, color, border: `1px solid ${color}33`, fontSize: px * 0.33 }}
    >
      {!imgError && !isFxPair ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={symbol}
          width={px * 0.65}
          height={px * 0.65}
          style={{ objectFit: "contain", borderRadius: "50%" }}
          onError={() => setImgError(true)}
        />
      ) : (
        letter || cleanSymbol.charAt(0)
      )}
    </div>
  );
}

function CoinSVG() {
  return (
    <div className="absolute right-0 top-0 bottom-0 flex items-center justify-end overflow-hidden rounded-2xl" style={{ width: "45%" }}>
      <svg width="180" height="180" viewBox="0 0 180 180" className="opacity-90">
        <defs>
          <radialGradient id="cg1" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2d2d2d" /><stop offset="100%" stopColor="#111" />
          </radialGradient>
          <radialGradient id="cg2" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#353535" /><stop offset="100%" stopColor="#181818" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="115" rx="55" ry="55" fill="url(#cg1)" />
        <ellipse cx="100" cy="115" rx="55" ry="55" fill="none" stroke="#2a2a2a" strokeWidth="2" />
        <ellipse cx="100" cy="112" rx="48" ry="48" fill="url(#cg2)" />
        <ellipse cx="80" cy="90" rx="58" ry="58" fill="url(#cg1)" />
        <ellipse cx="80" cy="90" rx="58" ry="58" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
        <ellipse cx="80" cy="87" rx="50" ry="50" fill="url(#cg2)" />
        <polygon points="85,62 72,88 82,88 75,115 93,82 82,82" fill="#8FFFD6" opacity="0.95" />
        <polygon points="105,68 90,92 100,92 92,118 112,85 100,85" fill="#8FFFD6" opacity="0.6" />
      </svg>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [activeRange, setActiveRange] = useState("1M");

  // Global market context — switches when user changes dropdown
  const { market } = useMarket();
  const key = market.id; // MarketId: "IN" | "US" | "FX"
  const md = MARKET_DATA[key];
  const currency = market.currency || "$";
  const pins = EVENT_PINS[key];

  return (
    <div className="min-h-screen p-5 flex flex-col gap-4"
      style={{ background: "#0a0a0a", fontFamily: "'Geist', 'Inter', sans-serif" }}>

      {/* ── SEARCH BAR ── */}
      <div style={{ maxWidth: 480 }}>
        <StockSearch />
      </div>

      {/* ── ROW 1 ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 320px" }}>

        {/* Buy & Sell Activity */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "#111111", border: "1px solid #1f1f1f", minHeight: 260 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-semibold text-sm">Buy &amp; Sell Activity</span>
            <div className="flex items-center gap-1.5">
              {TIME_RANGES.map((r) => (
                <button key={r} onClick={() => setActiveRange(r)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: activeRange === r ? "#fff" : "transparent",
                    color: activeRange === r ? "#000" : "#555",
                    border: activeRange === r ? "none" : "1px solid #1f1f1f",
                  }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="relative" style={{ height: 160 }}>
            {/* Event pins */}
            <div className="absolute inset-0 pointer-events-none z-10">
              {pins.map((pin, i) => (
                <div key={i} className="absolute flex flex-col items-center" style={{ left: pin.left, top: pin.top }}>
                  <div className="rounded-full px-2 py-0.5 text-[9px] font-semibold whitespace-nowrap mb-0.5"
                    style={{
                      background: pin.color === "#8FFFD6" ? "#8FFFD611" : pin.color === "#fff" ? "#ffffff11" : "#ef444411",
                      color: pin.color === "#8FFFD6" ? "#8FFFD6" : pin.color === "#fff" ? "#fff" : "#ef9999",
                      border: `1px solid ${pin.color === "#8FFFD6" ? "#8FFFD633" : pin.color === "#fff" ? "#ffffff33" : "#ef444433"}`,
                    }}>
                    {pin.label}
                  </div>
                  <div className="w-px h-4" style={{ background: pin.color + "55" }} />
                  <div className="w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold"
                    style={{ background: pin.color === "#8FFFD6" ? "#76b900" : pin.color === "#fff" ? "#555" : "#ef4444", color: "#fff" }}>
                    {pin.letter}
                  </div>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={BUY_SELL_DATA} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: "#161616", border: "1px solid #222", borderRadius: 10, fontSize: 11 }}
                  itemStyle={{ color: "#fff" }} labelStyle={{ color: "#555" }} />
                <Area type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={1.5}
                  fill="url(#actGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trading Score */}
        <div className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: "#111111", border: "1px solid #1f1f1f", minHeight: 260 }}>
          <CoinSVG />
          <div className="relative z-10">
            <p className="text-white font-semibold text-sm mb-8">Trading Score</p>
            <p className="text-white font-bold" style={{ fontSize: 34, lineHeight: 1, letterSpacing: "-0.03em" }}>
              {md.tradingScore}
            </p>
            <p className="text-[#555] text-xs mt-1 mb-6">Total buy volume</p>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-2xl">{md.tradingPoints.toLocaleString()}</span>
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#8FFFD622" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#8FFFD6"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              </div>
            </div>
            <p className="text-[#555] text-xs mt-1">Trading points</p>
          </div>
        </div>
      </div>

      {/* ── ROW 2 ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.1fr 1fr" }}>

        {/* LEFT */}
        <div className="flex flex-col gap-4">

          {/* Total Holdings */}
          <div className="rounded-2xl p-5" style={{ background: "#111111", border: "1px solid #1f1f1f" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-semibold text-sm">Total holdings</span>
              <button className="text-[#555] hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {md.holdings.map((h) => (
                <button key={h.symbol}
                  onClick={() => router.push(`/dashboard/stock/${h.symbol}`)}
                  className="flex items-center gap-2 p-2 rounded-xl transition-colors hover:bg-[#1a1a1a]">
                  <StockAvatar symbol={h.symbol} color={h.color} bg={h.bg} letter={h.letter} px={32} />
                  <div className="text-left">
                    <p className="text-white text-xs font-semibold">{h.shares} {h.shares > 999 ? "units" : "Shares"}</p>
                    <p className="text-[#555] text-[10px] truncate max-w-[72px]">{h.symbol}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Trading Activity */}
          <div className="rounded-2xl p-5" style={{ background: "#111111", border: "1px solid #1f1f1f" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-sm mb-1">Trading Activity</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-white font-bold text-2xl">48</span>
                  <span className="text-[#555] text-xs">/trades</span>
                </div>
              </div>
              <div className="flex items-end gap-0.5 h-12">
                {WEEKLY_ACTIVITY.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <div className="w-3 rounded-sm"
                      style={{ height: `${(d.trades / 12) * 40}px`, background: i === 2 ? "#8FFFD6" : "#222" }} />
                    <span className="text-[8px]" style={{ color: "#444" }}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Next Dividend */}
          <div className="rounded-2xl p-5" style={{ background: "#111111", border: "1px solid #1f1f1f" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-semibold text-sm">Next Dividend Payout</span>
              <button className="text-[#444]">···</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#555] text-xs">Expected</p>
                <p className="text-white font-bold text-lg">
                  {key === "IN" ? "₹2,840" : key === "FX" ? "$128.40" : "$342.80"}
                </p>
                <p className="text-[#555] text-[10px] mt-0.5">Jul 15, 2025</p>
              </div>
              <div className="flex items-end gap-0.5 h-10">
                {[4, 7, 5, 9, 6, 8, 5, 7, 9, 6, 8, 5].map((v, i) => (
                  <div key={i} className="w-1.5 rounded-sm"
                    style={{ height: `${(v / 9) * 36}px`, background: "#1f1f1f" }} />
                ))}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "#aaaaaa22" }}>
                <img src="https://icons.duckduckgo.com/ip3/apple.com.ico" alt="AAPL" width={20} height={20} style={{ objectFit: "contain", borderRadius: "50%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: My Portfolio */}
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: "#111111", border: "1px solid #1f1f1f" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-white font-semibold text-sm">My Portfolio</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-all"
              style={{ background: "#fff", color: "#000" }}>
              + Deposit
            </button>
          </div>
          <div className="mb-4">
            <p className="text-white font-bold" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
              {md.portfolioValue}
            </p>
            <p className="text-sm font-semibold mt-1" style={{ color: "#22c55e" }}>{md.portfolioGain}</p>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            {PORTFOLIO_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#888] text-xs">{cat.label}</span>
                  <span className="text-white text-xs font-bold">{cat.pct}%</span>
                </div>
                <div className="relative h-14 rounded-xl overflow-hidden" style={{ background: "#0d0d0d" }}>
                  <div className="absolute bottom-0 left-0 right-0 flex items-end gap-px px-1 h-full">
                    {BAR_HEIGHTS[cat.label].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm"
                        style={{ height: `${h}%`, background: cat.color, opacity: 0.65 + (i / 60) }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Transactions */}
        <div className="rounded-2xl p-5" style={{ background: "#111111", border: "1px solid #1f1f1f" }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-semibold text-sm">Transactions</span>
            <div className="flex items-center gap-2">
              <button className="text-[#555] hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </button>
              <button className="text-[#555] hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-[#555] text-xs">Today</span>
            <span className="text-[#555] text-xs">5 Transactions</span>
          </div>

          <div className="space-y-1">
            {md.transactions.map((tx) => (
              <button key={tx.symbol}
                onClick={() => router.push(`/dashboard/stock/${tx.symbol}`)}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors hover:bg-[#1a1a1a]">

                {/* Stock avatar — no card logos */}
                <StockAvatar symbol={tx.symbol} color={tx.color} bg={tx.bg} letter={tx.letter} px={36} />

                {/* Name */}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{tx.symbol}</p>
                  <p className="text-[#555] text-[10px] truncate">{tx.name}</p>
                </div>

                {/* Change badge */}
                {tx.change !== null ? (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: tx.change > 0 ? "#22c55e22" : "#ef444422",
                      color: tx.change > 0 ? "#22c55e" : "#ef4444",
                    }}>
                    {tx.change > 0 ? "+" : ""}{tx.change}
                  </span>
                ) : <div className="w-6" />}

                {/* Amount */}
                <span className="text-xs font-bold flex-shrink-0 px-2 py-1 rounded-xl"
                  style={{
                    background: tx.amount < 0 ? "#ef444422" : "#22c55e22",
                    color: tx.amount < 0 ? "#ef4444" : "#22c55e",
                  }}>
                  {tx.amount < 0 ? "-" : "+"}{currency}{Math.abs(tx.amount)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}