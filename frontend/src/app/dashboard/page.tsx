"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMarket } from "@/lib/MarketContext";
import StockSearch from "@/components/StockSearch";
import { useLivePrices } from "@/lib/websocket";
import { fetchWithAuth } from "@/lib/auth";
import { Search, SlidersHorizontal, TrendingUp, TrendingDown, Trophy } from "lucide-react";

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariant = {
  hidden:  { opacity: 0, y: 20, scale: 0.98 },
  visible: { opacity: 1, y: 0,  scale: 1    },
};

const useCountUp = (target: number, duration: number = 1500) => {
  const [count, setCount] = useState(0);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    let startTime: number;
    const animate = () => {
      if (!startTime) startTime = Date.now();
      const elapsed  = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) animationRef.current = setTimeout(animate, 16);
    };
    animate();
    return () => clearTimeout(animationRef.current!);
  }, [target, duration]);
  return count;
};

function VisaLogo() {
  return (
    <svg width="26" height="16" viewBox="0 0 50 16" aria-label="Visa">
      <text x="0" y="13" fontFamily="Arial, sans-serif" fontWeight="900"
        fontSize="15" fill="#1a1f71" letterSpacing="-0.5" fontStyle="italic">VISA</text>
    </svg>
  );
}

function MastercardLogo() {
  return (
    <svg width="24" height="16" viewBox="0 0 38 24" aria-label="Mastercard">
      <circle cx="14" cy="12" r="10" fill="#EB001B"/>
      <circle cx="24" cy="12" r="10" fill="#F79E1B"/>
      <path d="M19 4.87a10 10 0 0 1 0 14.26A10 10 0 0 1 19 4.87z" fill="#FF5F00"/>
    </svg>
  );
}

type CardNetwork = "visa" | "mastercard" | null;

interface DashboardTransaction {
  symbol:      string;
  name:        string;
  change:      number | null;
  amount:      number;
  color:       string;
  bg:          string;
  letter:      string;
  cardNetwork: CardNetwork;
  cardLast4:   string;
}

interface OrderRow {
  symbol:     string;
  type?:      string;
  total?:     number;
  market?:    string;
  createdAt?: string;
}

interface PortfolioHoldingRow {
  symbol:    string;
  quantity?: number;
  shares?:   number;
}

interface PortfolioSummaryResponse {
  holdings?:       PortfolioHoldingRow[];
  totalValue?:     number;
  portfolioValue?: number;
  totalInvested?:  number;
  totalCost?:      number;
  totalPnl?:       number;
  totalPnlPct?:    number;
}

// ── Community leaderboard types ───────────────────────────────────────────────
interface LeaderboardEntry {
  userId?: string;
  rank: number; username: string; name: string;
  returnPct: number; totalValue: number; positions: number;
}

function CardNetworkIcon({ network }: { network: CardNetwork }) {
  if (network === "visa")       return <VisaLogo />;
  if (network === "mastercard") return <MastercardLogo />;
  return null;
}

const MARKET_DATA: Record<string, {
  holdings:     { symbol: string; shares: number; color: string; bg: string; letter: string }[];
  transactions: DashboardTransaction[];
  portfolioValue: string;
  portfolioGain:  string;
  tradingScore:   string;
  tradingPoints:  number;
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
      { symbol: "RELIANCE", name: "Reliance",  change: +2,   amount: -4200, color: "#0ea5e9", bg: "#0ea5e922", letter: "R", cardNetwork: "mastercard", cardLast4: "4641" },
      { symbol: "TCS",      name: "TCS",       change: -3,   amount: +1800, color: "#8b5cf6", bg: "#8b5cf622", letter: "T", cardNetwork: "visa",       cardLast4: "8941" },
      { symbol: "INFY",     name: "Infosys",   change: null, amount: +950,  color: "#f59e0b", bg: "#f59e0b22", letter: "I", cardNetwork: "mastercard", cardLast4: "4641" },
      { symbol: "HDFCBANK", name: "HDFC Bank", change: null, amount: -2100, color: "#10b981", bg: "#10b98122", letter: "H", cardNetwork: "visa",       cardLast4: "8941" },
      { symbol: "WIPRO",    name: "Wipro",     change: null, amount: -800,  color: "#ef4444", bg: "#ef444422", letter: "W", cardNetwork: "mastercard", cardLast4: "4641" },
    ],
    portfolioValue: "₹7,84,320",
    portfolioGain:  "+₹62,410 this month",
    tradingScore:   "₹9,42,500",
    tradingPoints:  4820,
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
      { symbol: "TSLA",  name: "Tesla",      change: +3,   amount: -525,  color: "#ef4444", bg: "#ef444422", letter: "T", cardNetwork: "mastercard", cardLast4: "4641" },
      { symbol: "AAPL",  name: "Apple",      change: -7,   amount: +120,  color: "#aaaaaa", bg: "#aaaaaa22", letter: "",  cardNetwork: "visa",        cardLast4: "8941" },
      { symbol: "AMD",   name: "AMD",        change: null, amount: +280,  color: "#ed1c24", bg: "#ed1c2422", letter: "A", cardNetwork: "mastercard",  cardLast4: "4641" },
      { symbol: "SNCLD", name: "Soundcloud", change: null, amount: -90,   color: "#ff5500", bg: "#ff550022", letter: "S", cardNetwork: "visa",        cardLast4: "8941" },
      { symbol: "MCD",   name: "McDonald's", change: null, amount: -340,  color: "#ffbc0d", bg: "#ffbc0d22", letter: "M", cardNetwork: "mastercard",  cardLast4: "4641" },
    ],
    portfolioValue: "$93,314",
    portfolioGain:  "+$8,461 this month",
    tradingScore:   "$1,184,600",
    tradingPoints:  6280,
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
      { symbol: "BTC",  name: "Bitcoin",   change: +2.4, amount: -1240, color: "#f7931a", bg: "#f7931a22", letter: "₿", cardNetwork: "mastercard", cardLast4: "4641" },
      { symbol: "ETH",  name: "Ethereum",  change: -1.8, amount: +620,  color: "#627eea", bg: "#627eea22", letter: "Ξ", cardNetwork: "visa",       cardLast4: "8941" },
      { symbol: "SOL",  name: "Solana",    change: +5.1, amount: -380,  color: "#9945ff", bg: "#9945ff22", letter: "S", cardNetwork: "mastercard", cardLast4: "4641" },
      { symbol: "BNB",  name: "BNB",       change: null, amount: +210,  color: "#f3ba2f", bg: "#f3ba2f22", letter: "B", cardNetwork: "visa",       cardLast4: "8941" },
      { symbol: "AVAX", name: "Avalanche", change: null, amount: -90,   color: "#e84142", bg: "#e8414222", letter: "A", cardNetwork: "mastercard", cardLast4: "4641" },
    ],
    portfolioValue: "$28,540",
    portfolioGain:  "+$3,120 this month",
    tradingScore:   "$842,000",
    tradingPoints:  3140,
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
      { symbol: "EUR/USD", name: "EUR/USD", change: +1,   amount: -1200, color: "#3b82f6", bg: "#3b82f622", letter: "€", cardNetwork: "visa",       cardLast4: "8941" },
      { symbol: "GBP/USD", name: "GBP/USD", change: -2,  amount: +800,  color: "#8b5cf6", bg: "#8b5cf622", letter: "£", cardNetwork: "mastercard", cardLast4: "4641" },
      { symbol: "USD/JPY", name: "USD/JPY", change: null, amount: +450,  color: "#f59e0b", bg: "#f59e0b22", letter: "¥", cardNetwork: "visa",       cardLast4: "8941" },
      { symbol: "AUD/USD", name: "AUD/USD", change: null, amount: -320,  color: "#10b981", bg: "#10b98122", letter: "A", cardNetwork: "mastercard", cardLast4: "4641" },
      { symbol: "USD/CAD", name: "USD/CAD", change: null, amount: -180,  color: "#ef4444", bg: "#ef444422", letter: "C", cardNetwork: "visa",       cardLast4: "8941" },
    ],
    portfolioValue: "$48,720",
    portfolioGain:  "+$3,210 this month",
    tradingScore:   "$2,340,000",
    tradingPoints:  8940,
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
  const maxDays  = cutoffs[range] ?? 9999;
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
    { label: "Reliance Q3 Strong",  letter: "R", color: "#8FFFD6", left: "8%",  top: "55%" },
    { label: "TCS Record Revenue",  letter: "T", color: "#fff",    left: "50%", top: "15%" },
    { label: "HDFC Merger Done",    letter: "H", color: "#ef4444", left: "72%", top: "30%" },
  ],
  US: [
    { label: "NVIDIA Q3 Earnings",   letter: "N", color: "#8FFFD6", left: "8%",  top: "55%" },
    { label: "Apple Record Revenue", letter: "A", color: "#fff",    left: "50%", top: "15%" },
    { label: "Tesla FSD 2.0",        letter: "T", color: "#ef4444", left: "72%", top: "30%" },
  ],
  CRYPTO: [
    { label: "BTC ETF Approval",   letter: "₿", color: "#8FFFD6", left: "8%",  top: "55%" },
    { label: "ETH Dencun Upgrade", letter: "Ξ", color: "#fff",    left: "50%", top: "15%" },
    { label: "SOL Congestion",     letter: "S", color: "#ef4444", left: "72%", top: "30%" },
  ],
  FX: [
    { label: "Fed Rate Decision",   letter: "F", color: "#8FFFD6", left: "8%",  top: "55%" },
    { label: "ECB Rate Cut",        letter: "E", color: "#fff",    left: "50%", top: "15%" },
    { label: "USD/JPY 5-Year High", letter: "¥", color: "#ef4444", left: "72%", top: "30%" },
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
    return `${symbol}.NS`;
  return symbol;
}

function StockAvatar({ symbol, color, bg, letter, px = 32 }: {
  symbol: string; color: string; bg: string; letter: string; px?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const clean = symbol.replace(/\.(NS|BSE|NSE)$/, "").toUpperCase();
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
        <img src={url} alt={symbol} width={px * 0.6} height={px * 0.6}
          style={{ objectFit: "contain", borderRadius: "50%" }}
          onError={() => setImgError(true)} />
      ) : (letter || clean.charAt(0))}
    </div>
  );
}

function CoinSVG() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const outerFill  = dark ? "#2a2a2a" : "#e2e8f0";
  const innerFill  = dark ? "#181818" : "#cbd5e1";
  const outerFill2 = dark ? "#222222" : "#dde4ee";
  const innerFill2 = dark ? "#131313" : "#c8d3e0";
  const edgeStroke = dark ? "#ffffff" : "#94a3b8";
  return (
    <div style={{
      position: "absolute", right: -8, top: 0, bottom: 0,
      width: "48%", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "flex-end",
      pointerEvents: "none",
    }}>
      <svg width="160" height="180" viewBox="0 0 200 200" style={{ opacity: dark ? 0.95 : 0.85 }}>
        <defs>
          <radialGradient id="coin1" cx="38%" cy="32%" r="65%">
            <stop offset="0%"   stopColor={outerFill}/>
            <stop offset="100%" stopColor={dark ? "#080808" : "#b8c4d4"}/>
          </radialGradient>
          <radialGradient id="coin2" cx="38%" cy="32%" r="65%">
            <stop offset="0%"   stopColor={innerFill}/>
            <stop offset="100%" stopColor={dark ? "#0a0a0a" : "#a8b8cc"}/>
          </radialGradient>
          <radialGradient id="coin3" cx="38%" cy="32%" r="65%">
            <stop offset="0%"   stopColor={outerFill2}/>
            <stop offset="100%" stopColor={dark ? "#090909" : "#b0bece"}/>
          </radialGradient>
          <radialGradient id="coin4" cx="38%" cy="32%" r="65%">
            <stop offset="0%"   stopColor={innerFill2}/>
            <stop offset="100%" stopColor={dark ? "#0b0b0b" : "#a0b0c4"}/>
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <ellipse cx="118" cy="125" rx="56" ry="56" fill="url(#coin1)"/>
        <ellipse cx="118" cy="122" rx="48" ry="48" fill="url(#coin2)"/>
        <ellipse cx="118" cy="125" rx="56" ry="56" fill="none" stroke={edgeStroke} strokeWidth="0.4" strokeOpacity="0.15"/>
        <polygon points="122,98 109,124 119,124 112,150 132,117 120,117" fill="#8FFFD6" opacity={dark ? 0.45 : 0.6} filter="url(#glow)"/>
        <ellipse cx="88" cy="98"  rx="60" ry="60" fill="url(#coin3)"/>
        <ellipse cx="88" cy="95"  rx="51" ry="51" fill="url(#coin4)"/>
        <ellipse cx="88" cy="98"  rx="60" ry="60" fill="none" stroke={edgeStroke} strokeWidth="0.5" strokeOpacity="0.2"/>
        <polygon points="93,68 78,98 90,98 82,128 104,93 91,93" fill="#8FFFD6" opacity={dark ? 1 : 0.9} filter="url(#glow)"/>
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

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <motion.div
      variants={cardVariant}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
      style={{
        background:           "var(--color-card)",
        border:               "1px solid var(--color-line)",
        borderRadius:         16,
        padding:              16,
        backdropFilter:       "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Community Mini Widget ─────────────────────────────────────────────────────
function CommunityWidget() {
  const router = useRouter();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth("/api/community/leaderboard?sort=returnPct&limit=3")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.leaderboard) setLeaders(data.leaderboard); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Trophy size={13} color="#8FFFD6" />
          <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>Top Traders</span>
        </div>
        <button onClick={() => router.push("/dashboard/community")}
          style={{ background: "none", border: "none", color: "#8FFFD6", fontSize: 10, fontWeight: 600, cursor: "pointer", padding: 0 }}>
          View all →
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--color-line)", opacity: 0.4, flexShrink: 0 }} />
              <div style={{ flex: 1, height: 10, borderRadius: 4, background: "var(--color-line)", opacity: 0.3 }} />
              <div style={{ width: 36, height: 10, borderRadius: 4, background: "var(--color-line)", opacity: 0.3 }} />
            </div>
          ))}
        </div>
      ) : leaders.length === 0 ? (
        <div style={{ padding: "16px 0", textAlign: "center" }}>
          <p style={{ color: "var(--color-muted)", fontSize: 11, margin: 0 }}>No public traders yet</p>
          <button onClick={() => router.push("/dashboard/community")}
            style={{ marginTop: 8, padding: "5px 14px", borderRadius: 8, border: "1px solid #8FFFD644", background: "#8FFFD610", color: "#8FFFD6", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Join Community
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {leaders.map((entry, i) => {
            const up     = entry.returnPct >= 0;
            const letter = (entry.name || entry.username || "?")[0].toUpperCase();
            const hue    = (letter.charCodeAt(0) * 37) % 360;
            return (
              <motion.button key={entry.userId ?? i}
                whileHover={{ x: 3 }}
                onClick={() => router.push("/dashboard/community")}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{medals[i]}</span>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: `hsl(${hue},60%,35%)`,
                  border: `1px solid hsl(${hue},60%,50%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: `hsl(${hue},80%,80%)`,
                }}>
                  {letter}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.name || entry.username || "Anonymous"}
                  </p>
                  {entry.username && (
                    <p style={{ color: "var(--color-muted)", fontSize: 9, margin: 0 }}>@{entry.username}</p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  {up ? <TrendingUp size={10} color="#22c55e" /> : <TrendingDown size={10} color="#ef4444" />}
                  <span style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 11, fontWeight: 700 }}>
                    {up ? "+" : ""}{entry.returnPct.toFixed(1)}%
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeRange, setActiveRange] = useState("1M");

  const [realTransactions,  setRealTransactions]  = useState<OrderRow[]>([]);
  const [realHoldings,      setRealHoldings]      = useState<{ symbol: string; shares: number; color: string; bg: string; letter: string }[]>([]);
  const [portfolioValue,    setPortfolioValue]    = useState<string | null>(null);
  const [portfolioGain,     setPortfolioGain]     = useState<string | null>(null);
  const [activityData,      setActivityData]      = useState<{ date: string; value: number; daysAgo: number }[] | null>(null);
  const [realTradingScore,  setRealTradingScore]  = useState<number | null>(null);
  const [realTradingPoints, setRealTradingPoints] = useState<number | null>(null);
  const [dataLoading,       setDataLoading]       = useState(true);

  const { market } = useMarket();
  const rawKey  = market.id as string;
  const key     = (["IN", "US", "FX", "CRYPTO"].includes(rawKey)) ? rawKey : "US";
  const md      = MARKET_DATA[key];
  const currency = market.currency || "$";
  const pins    = EVENT_PINS[key] ?? EVENT_PINS["US"];

  const displayHoldings       = realHoldings.length > 0 ? realHoldings : md.holdings;
  const displayPortfolioValue = portfolioValue ?? md.portfolioValue;
  const displayPortfolioGain  = portfolioGain ?? md.portfolioGain;

  const displayTransactions: DashboardTransaction[] = realTransactions.length > 0
    ? realTransactions.slice(0, 5).map((o) => ({
        symbol:      o.symbol,
        name:        o.symbol.replace(/\.(BSE|NSE|NS)$/i, ""),
        change:      null,
        amount:      o.type === "BUY" ? -(o.total ?? 0) : (o.total ?? 0),
        color:       "#8FFFD6",
        bg:          "rgba(143,255,214,0.1)",
        letter:      (o.symbol ?? "?")[0],
        cardNetwork: null as CardNetwork,
        cardLast4:   "—",
      }))
    : md.transactions;

  const txSymbols  = displayTransactions.map(t => resolveSymbol(t.symbol, key));
  const livePrices = useLivePrices(txSymbols);

  const tradingPointsTarget  = realTradingPoints ?? md.tradingPoints;
  const tradingScoreNumeric  = realTradingScore  ?? parseInt(md.tradingScore.replace(/[^\d]/g, ""), 10);
  const countedTradingPoints = useCountUp(tradingPointsTarget);
  const countedTradingScore  = useCountUp(tradingScoreNumeric);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setRealTransactions([]);
      setRealHoldings([]);
      setPortfolioValue(null);
      setPortfolioGain(null);
      setRealTradingScore(null);
      setRealTradingPoints(null);
      setDataLoading(true);
    });

    Promise.all([
      fetchWithAuth(`/api/portfolio/summary?market=${key}`),
      fetchWithAuth(`/api/orders/paginated?page=0&size=5`),
    ])
      .then(async ([portfolioRes, ordersRes]) => {
        if (cancelled) return;
        if (portfolioRes.ok) {
          const data = await portfolioRes.json() as PortfolioSummaryResponse;
          if (cancelled) return;
          setRealHoldings((data.holdings ?? []).map((h) => ({
            symbol: h.symbol,
            shares: h.quantity ?? h.shares ?? 0,
            color:  "#8FFFD6",
            bg:     "rgba(143,255,214,0.1)",
            letter: (h.symbol ?? "?")[0],
          })));
          const val = data.totalValue ?? data.portfolioValue ?? null;
          if (val != null) {
            setPortfolioValue(`${currency}${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
          }
          const pnl    = data.totalPnl ?? 0;
          const pnlPct = data.totalPnlPct ?? 0;
          if (pnl !== 0) {
            const sign   = pnl >= 0 ? "+" : "-";
            const pnlStr = `${sign}${currency}${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })} (${sign}${Math.abs(pnlPct).toFixed(2)}%) this month`;
            setPortfolioGain(pnlStr);
          }
          const totalCost = data.totalInvested ?? data.totalCost ?? 0;
          if (totalCost > 0) {
            setRealTradingScore(Math.floor(totalCost));
            setRealTradingPoints(Math.floor(totalCost / 10));
          }
        }
        if (ordersRes.ok) {
          const data = await ordersRes.json() as { orders?: OrderRow[] };
          if (cancelled) return;
          const allOrders = data.orders ?? [];
          const marketOrders = allOrders.filter(o => o.market && o.market.toUpperCase() === key);
          setRealTransactions(marketOrders.length > 0 ? marketOrders : allOrders);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, currency]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) setActivityData(null);
    });

    fetchWithAuth(`/api/orders`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((orders: OrderRow[]) => {
        if (cancelled) return;
        const marketOrders = orders.filter(o => o.market && o.market.toUpperCase() === key);
        const source = marketOrders.length > 0 ? marketOrders : orders;
        const grouped: Record<string, number> = {};
        source.forEach((o) => {
          const d     = new Date(o.createdAt ?? "");
          const label = d.toLocaleString("en-US", { month: "short" });
          grouped[label] = (grouped[label] ?? 0) + Math.abs(o.total ?? 0);
        });
        const result = Object.entries(grouped).map(([date, value]) => ({ date, value: Math.round(value), daysAgo: 0 }));
        if (result.length >= 2) setActivityData(result);
        else setActivityData(null);
      })
      .catch(() => {
        if (!cancelled) setActivityData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <div style={{
      minHeight: "100vh", padding: 16,
      display: "flex", flexDirection: "column", gap: 12,
      background: "var(--color-page)",
      fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
      boxSizing: "border-box", width: "100%", overflowX: "hidden",
    }}>
      <style>{`
        @keyframes ping { 0%{transform:scale(1);opacity:.75} 100%{transform:scale(2.2);opacity:0} }
      `}</style>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ maxWidth: 440 }}>
        <StockSearch />
      </motion.div>

      {/* ROW 1 */}
      <motion.div variants={stagger} initial="hidden" animate="visible"
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 240px", gap: 12 }}
        className="responsive-grid-1">
        <style>{`@media (max-width: 768px) { .responsive-grid-1 { grid-template-columns: 1fr !important; } }`}</style>

        {/* Buy & Sell Activity */}
        <Card style={{ position: "relative", overflow: "hidden", minHeight: 240, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>Buy &amp; Sell Activity</span>
            <div style={{ display: "flex", gap: 4 }}>
              {TIME_RANGES.map(r => (
                <button key={r} onClick={() => setActiveRange(r)} style={{
                  padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                  background: activeRange === r ? "var(--color-primary)" : "transparent",
                  color:      activeRange === r ? "var(--color-page)"    : "var(--color-muted)",
                  border:     activeRange === r ? "none" : "1px solid var(--color-line)",
                  cursor: "pointer", transition: "all 0.15s",
                }}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", height: 160 }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }}>
              {pins.map((pin, i) => {
                const accentColor = pin.color === "#8FFFD6" ? "#8FFFD6" : pin.color === "#fff" ? "var(--color-primary)" : "#ef4444";
                const dotBg = pin.color === "#8FFFD6" ? "#22c55e" : pin.color === "#fff" ? "#555" : "#ef4444";
                return (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.1, duration: 0.3, type: "spring" }}
                    style={{ position: "absolute", left: pin.left, top: pin.top, display: "flex", flexDirection: "column", alignItems: "center", transform: "translateX(-50%)" }}>
                    <div style={{ borderRadius: 6, padding: "2px 7px", fontSize: 9, fontWeight: 600, whiteSpace: "nowrap", marginBottom: 3, background: "var(--color-card)", color: accentColor, border: `1px solid ${accentColor}44`, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>{pin.label}</div>
                    <div style={{ width: 1, height: 12, background: `${accentColor}88` }} />
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: dotBg, border: `2px solid ${accentColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "#fff", boxShadow: `0 0 6px ${accentColor}66` }}>{pin.letter}</div>
                  </motion.div>
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={activityData ?? filterDashboardData(activeRange)} margin={{ top: 28, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8FFFD6" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#8FFFD6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 9 }} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 11 }} itemStyle={{ color: "var(--color-primary)" }} labelStyle={{ color: "var(--color-muted)" }}/>
                <Area type="monotone" dataKey="value" stroke="#8FFFD6" strokeWidth={1.5} fill="url(#actGrad)" dot={false} isAnimationActive animationDuration={600} animationEasing="ease-out"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Trading Score */}
        <Card style={{ position: "relative", overflow: "hidden", minHeight: 240 }}>
          <CoinSVG />
          <div style={{ position: "relative", zIndex: 10 }}>
            <p style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 12, marginBottom: 24 }}>Trading Score</p>
            <p style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: 22, lineHeight: 1, letterSpacing: "-0.03em", margin: "0 0 4px" }}>
              {currency}{countedTradingScore.toLocaleString()}
            </p>
            <p style={{ color: "var(--color-muted)", fontSize: 11, margin: "0 0 20px" }}>Total buy volume</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>{countedTradingPoints.toLocaleString()}</span>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#8FFFD6,#00c896)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 8px #8FFFD644" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#0a0a0a"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
            </div>
            <p style={{ color: "var(--color-muted)", fontSize: 11, marginTop: 4 }}>Trading points</p>
          </div>
        </Card>
      </motion.div>

      {/* ROW 2 */}
      <motion.div variants={stagger} initial="hidden" animate="visible" transition={{ delayChildren: 0.15 }}
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr) minmax(0,1fr)", gap: 12 }}
        className="responsive-grid-2">
        <style>{`@media (max-width: 768px) { .responsive-grid-2 { grid-template-columns: 1fr !important; } }`}</style>

        {/* LEFT col — Holdings + Activity + Dividend + Community */}
        <motion.div variants={fadeUp} style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* Total Holdings */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>Total holdings</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {displayHoldings.map((h, i) => {
                const navSymbol = resolveSymbol(h.symbol, key);
                return (
                  <motion.button key={h.symbol}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => router.push(`/dashboard/stock/${navSymbol}?market=${key}`)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <StockAvatar symbol={h.symbol} color={h.color} bg={h.bg} letter={h.letter} px={28} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 600, margin: 0 }}>{h.shares} {h.shares > 999 ? "u" : "Sh"}</p>
                      <p style={{ color: "var(--color-muted)", fontSize: 9, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 60 }}>{h.symbol.replace(/\.(NS|BSE|NSE)$/, "")}</p>
                    </div>
                  </motion.button>
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
                  <span style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: 22 }}>{realTransactions.length > 0 ? realTransactions.length : 48}</span>
                  <span style={{ color: "var(--color-muted)", fontSize: 11 }}>/trades</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }}>
                {WEEKLY_ACTIVITY.map((d, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.5 + i * 0.05, duration: 0.4, ease: "easeOut" }}
                      style={{ width: 10, borderRadius: 3, height: `${(d.trades / 12) * 34}px`, background: i === 2 ? "#8FFFD6" : "var(--color-line)", transformOrigin: "bottom" }} />
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

          {/* ── Community Mini Widget ── */}
          <CommunityWidget />
        </motion.div>

        {/* CENTER: Portfolio */}
        <motion.div variants={fadeUp}>
          <Card style={{ display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>My Portfolio</span>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/dashboard/wallet")}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: "linear-gradient(135deg,#8FFFD6,#00c896)", color: "#0a0a0a", border: "none", cursor: "pointer" }}>
                + Deposit
              </motion.button>
            </div>
            <p style={{ color: "var(--color-primary)", fontWeight: 800, fontSize: 26, lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 4px" }}>{displayPortfolioValue}</p>
            <p style={{ color: (portfolioGain ?? "").startsWith("-") ? "#ef4444" : "#22c55e", fontSize: 12, fontWeight: 600, margin: "0 0 12px" }}>{displayPortfolioGain}</p>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {PORTFOLIO_CATEGORIES.map((cat, i) => (
                <div key={cat.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "var(--color-muted)", fontSize: 11 }}>{cat.label}</span>
                    <span style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 700 }}>{cat.pct}%</span>
                  </div>
                  <div style={{ height: 44, borderRadius: 10, overflow: "hidden", background: "var(--color-surface-hover)", position: "relative" }}>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "flex-end", gap: 1, padding: "0 4px", height: "100%" }}>
                      {BAR_HEIGHTS[cat.label].map((h, j) => (
                        <motion.div key={j} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.4 + i * 0.1 + j * 0.01, duration: 0.4, ease: "easeOut" }}
                          style={{ flex: 1, borderRadius: "2px 2px 0 0", height: `${h}%`, background: cat.color, opacity: 0.65 + j / 60, transformOrigin: "bottom" }} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* RIGHT: Transactions */}
        <motion.div variants={fadeUp}>
          <Card style={{ minWidth: 0, height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13 }}>Transactions</span>
                {Object.values(livePrices).some(p => p.live) && <LiveDot />}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", display: "flex", alignItems: "center", padding: 2 }}><Search size={13}/></button>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", display: "flex", alignItems: "center", padding: 2 }}><SlidersHorizontal size={13}/></button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "var(--color-muted)", fontSize: 11 }}>Recent</span>
              <span style={{ color: "var(--color-muted)", fontSize: 11 }}>{displayTransactions.length} Transactions</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {dataLoading ? (
                [1,2,3,4,5].map(i => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 6px" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--color-line)", flexShrink: 0, opacity: 0.4 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ width: 60, height: 10, borderRadius: 4, background: "var(--color-line)", opacity: 0.4, marginBottom: 4 }} />
                      <div style={{ width: 40, height: 8,  borderRadius: 4, background: "var(--color-line)", opacity: 0.3 }} />
                    </div>
                  </div>
                ))
              ) : displayTransactions.map((tx, i) => {
                const resolvedSym   = resolveSymbol(tx.symbol, key);
                const live          = livePrices[resolvedSym];
                const liveChange    = live?.changePct ?? null;
                const displayChange = live?.live ? liveChange : tx.change;
                const isPos = displayChange !== null && displayChange > 0;
                return (
                  <motion.button key={`${tx.symbol}-${i}`}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.07, duration: 0.35 }}
                    whileHover={{ x: 3 }}
                    onClick={() => router.push(`/dashboard/stock/${resolvedSym}?market=${key}`)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 6px", borderRadius: 10, width: "100%", background: "transparent", border: "none", cursor: "pointer" }}>
                    <StockAvatar symbol={tx.symbol} color={tx.color} bg={tx.bg} letter={tx.letter} px={30} />
                    <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                      <p style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 600, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tx.symbol.replace(/\.(BSE|NSE|NS)$/i, "")}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <CardNetworkIcon network={tx.cardNetwork} />
                        <span style={{ color: "var(--color-muted)", fontSize: 10, letterSpacing: "0.05em" }}>****{tx.cardLast4}</span>
                      </div>
                    </div>
                    {displayChange !== null && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 99, flexShrink: 0, background: isPos ? "#22c55e22" : "#ef444422", color: isPos ? "#22c55e" : "#ef4444" }}>
                        {isPos ? "+" : ""}{live?.live ? `${liveChange?.toFixed(1)}%` : displayChange}
                      </span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 8, flexShrink: 0, background: tx.amount < 0 ? "#ef444422" : "#22c55e22", color: tx.amount < 0 ? "#ef4444" : "#22c55e" }}>
                      {tx.amount < 0 ? "-" : "+"}{currency}{Math.abs(tx.amount)}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
