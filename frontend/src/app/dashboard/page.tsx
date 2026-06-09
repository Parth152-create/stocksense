"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMarket } from "@/lib/MarketContext";
import { useLivePrices } from "@/lib/websocket";
import { fetchWithAuth } from "@/lib/auth";
import {
  TrendingUp, TrendingDown, Trophy, ArrowUpRight,
  Zap, ShoppingCart, Eye, BarChart2, Star,
} from "lucide-react";
import { resolveSymbol } from "@/lib/symbols";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#8FFFD6";
const BULL   = "#22c55e";
const BEAR   = "#ef4444";
const APPLE  = [0.25, 0.46, 0.45, 0.94] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderRow {
  symbol: string; type?: string; total?: number;
  market?: string; createdAt?: string;
}
interface PortfolioHoldingRow {
  symbol: string; quantity?: number; shares?: number;
}
interface PortfolioSummaryResponse {
  holdings?: PortfolioHoldingRow[];
  totalValue?: number; portfolioValue?: number;
  totalInvested?: number; totalCost?: number;
  totalPnl?: number; totalPnlPct?: number;
}
interface LeaderboardEntry {
  userId?: string; rank: number; username: string; name: string;
  returnPct: number; totalValue: number; positions: number;
}
interface DashboardTransaction {
  symbol: string; name: string; change: number | null;
  amount: number; color: string; bg: string; letter: string;
}
interface MoverStock {
  symbol: string; name: string; price: number;
  changePct: number; currency: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const MARKET_DATA: Record<string, {
  holdings: { symbol: string; shares: number; color: string; bg: string; letter: string }[];
  transactions: DashboardTransaction[];
  portfolioValue: string; portfolioGain: string;
  tradingScore: string; tradingPoints: number;
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
    portfolioValue: "₹7,84,320", portfolioGain: "+₹62,410",
    tradingScore: "₹9,42,500", tradingPoints: 4820,
  },
  US: {
    holdings: [
      { symbol: "MSFT", shares: 14,  color: "#00a4ef", bg: "#00a4ef22", letter: "M" },
      { symbol: "ADBE", shares: 36,  color: "#ff0000", bg: "#ff000022", letter: "A" },
      { symbol: "NVDA", shares: 22,  color: "#76b900", bg: "#76b90022", letter: "N" },
      { symbol: "KO",   shares: 165, color: "#f40000", bg: "#f4000022", letter: "K" },
      { symbol: "AAPL", shares: 48,  color: "#aaaaaa", bg: "#aaaaaa22", letter: "A" },
    ],
    transactions: [
      { symbol: "TSLA", name: "Tesla",      change: +3,   amount: -525, color: "#ef4444", bg: "#ef444422", letter: "T" },
      { symbol: "AAPL", name: "Apple",      change: -7,   amount: +120, color: "#aaaaaa", bg: "#aaaaaa22", letter: "A" },
      { symbol: "AMD",  name: "AMD",        change: null, amount: +280, color: "#ed1c24", bg: "#ed1c2422", letter: "A" },
      { symbol: "MSFT", name: "Microsoft",  change: null, amount: -340, color: "#00a4ef", bg: "#00a4ef22", letter: "M" },
      { symbol: "NVDA", name: "Nvidia",     change: null, amount: -90,  color: "#76b900", bg: "#76b90022", letter: "N" },
    ],
    portfolioValue: "$93,314", portfolioGain: "+$8,461",
    tradingScore: "$1,184,600", tradingPoints: 6280,
  },
  CRYPTO: {
    holdings: [
      { symbol: "BTC",  shares: 0.5, color: "#f7931a", bg: "#f7931a22", letter: "₿" },
      { symbol: "ETH",  shares: 4.2, color: "#627eea", bg: "#627eea22", letter: "Ξ" },
      { symbol: "SOL",  shares: 32,  color: "#9945ff", bg: "#9945ff22", letter: "S" },
      { symbol: "BNB",  shares: 8,   color: "#f3ba2f", bg: "#f3ba2f22", letter: "B" },
      { symbol: "AVAX", shares: 15,  color: "#e84142", bg: "#e8414222", letter: "A" },
    ],
    transactions: [
      { symbol: "BTC", name: "Bitcoin",  change: +2.4, amount: -1240, color: "#f7931a", bg: "#f7931a22", letter: "₿" },
      { symbol: "ETH", name: "Ethereum", change: -1.8, amount: +620,  color: "#627eea", bg: "#627eea22", letter: "Ξ" },
      { symbol: "SOL", name: "Solana",   change: +5.1, amount: -380,  color: "#9945ff", bg: "#9945ff22", letter: "S" },
      { symbol: "BNB", name: "BNB",      change: null, amount: +210,  color: "#f3ba2f", bg: "#f3ba2f22", letter: "B" },
      { symbol: "AVAX",name: "Avalanche",change: null, amount: -90,   color: "#e84142", bg: "#e8414222", letter: "A" },
    ],
    portfolioValue: "$28,540", portfolioGain: "+$3,120",
    tradingScore: "$842,000", tradingPoints: 3140,
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
    portfolioValue: "$48,720", portfolioGain: "+$3,210",
    tradingScore: "$2,340,000", tradingPoints: 8940,
  },
};

const ACTIVITY_DATA = [
  { date: "Sep", value: 4200 }, { date: "Oct", value: 3800 },
  { date: "Nov", value: 4100 }, { date: "Dec", value: 3600 },
  { date: "Jan", value: 5200 }, { date: "Feb", value: 6800 },
  { date: "Mar", value: 7400 }, { date: "Apr", value: 6900 },
  { date: "May", value: 8200 }, { date: "Jun", value: 9100 },
];

const PORTFOLIO_CATEGORIES = [
  { label: "Stocks", pct: 40, color: "#a78bfa" },
  { label: "Crypto", pct: 30, color: "#818cf8" },
  { label: "Funds",  pct: 22, color: "#6366f1" },
  { label: "Other",  pct: 8,  color: "#4338ca" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const useCountUp = (target: number, duration = 1400) => {
  const [count, setCount] = useState(0);
  const raf = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let startTime: number;
    const tick = () => {
      if (!startTime) startTime = Date.now();
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(eased * target));
      if (p < 1) raf.current = setTimeout(tick, 16);
    };
    tick();
    return () => { if (raf.current) clearTimeout(raf.current); };
  }, [target, duration]);
  return count;
};

// ─── Noise texture SVG (data URI) ─────────────────────────────────────────────

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 7, height: 7 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ACCENT, opacity: 0.7, animation: "ping 1.2s ease infinite" }} />
      <span style={{ position: "relative", borderRadius: "50%", width: 7, height: 7, background: ACCENT, display: "block" }} />
    </span>
  );
}

const LOGO_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com", AAPL: "apple.com", AMD: "amd.com",
  MSFT: "microsoft.com", NVDA: "nvidia.com", ADBE: "adobe.com",
  KO: "coca-cola.com", MCD: "mcdonalds.com",
  RELIANCE: "ril.com", TCS: "tcs.com", INFY: "infosys.com",
  HDFCBANK: "hdfcbank.com", WIPRO: "wipro.com",
};

function StockAvatar({ symbol, color, bg, letter, px = 32 }: {
  symbol: string; color: string; bg: string; letter: string; px?: number;
}) {
  const [err, setErr] = useState(false);
  const clean = symbol.replace(/\.(NS|BSE|NSE)$/, "").toUpperCase();
  const isFx  = symbol.includes("/");
  const domain = LOGO_DOMAINS[clean];
  const url = domain
    ? `https://icons.duckduckgo.com/ip3/${domain}.ico`
    : `https://unavatar.io/clearbit/${clean.toLowerCase()}`;
  return (
    <div style={{
      width: px, height: px, borderRadius: "50%", flexShrink: 0,
      background: bg, border: `1px solid ${color}33`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: px * 0.34, fontWeight: 700, color, overflow: "hidden",
    }}>
      {!err && !isFx
        ? <img src={url} alt="" width={px * 0.6} height={px * 0.6}
            style={{ objectFit: "contain" }} onError={() => setErr(true)} />
        : (letter || clean.charAt(0))}
    </div>
  );
}

// ─── Ticker strip ─────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { sym: "AAPL",    chg: +1.23 }, { sym: "NVDA",  chg: +3.41 },
  { sym: "TSLA",    chg: -2.18 }, { sym: "MSFT",  chg: +0.87 },
  { sym: "BTC/USD", chg: +2.91 }, { sym: "ETH",   chg: -1.04 },
  { sym: "RELIANCE",chg: +0.54 }, { sym: "TCS",   chg: -0.32 },
  { sym: "EUR/USD", chg: +0.11 }, { sym: "INFY",  chg: +1.76 },
  { sym: "SOL",     chg: +5.12 }, { sym: "ADBE",  chg: -0.68 },
];

function TickerStrip() {
  return (
    <div style={{
      overflow: "hidden", whiteSpace: "nowrap",
      borderRadius: 10,
      background: "var(--color-card)",
      border: "1px solid var(--color-line)",
      padding: "7px 0",
      marginBottom: 14,
    }}>
      <div style={{ display: "inline-flex", gap: 0, animation: "tickerScroll 28s linear infinite" }}>
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => {
          const up = t.chg >= 0;
          return (
            <span key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "0 18px", borderRight: "1px solid var(--color-line)",
              fontSize: 11, fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            }}>
              <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>{t.sym}</span>
              <span style={{ fontWeight: 600, color: up ? BULL : BEAR, display: "flex", alignItems: "center", gap: 2 }}>
                {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                {up ? "+" : ""}{t.chg.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions({ onBuy, onWatchlist, onScreener }: {
  onBuy: () => void; onWatchlist: () => void; onScreener: () => void;
}) {
  const actions = [
    { label: "Buy",       icon: <ShoppingCart size={13} />, onClick: onBuy,       accent: BULL,   bg: `${BULL}18`   },
    { label: "Watchlist", icon: <Eye size={13} />,          onClick: onWatchlist, accent: ACCENT, bg: `${ACCENT}12` },
    { label: "Screener",  icon: <BarChart2 size={13} />,    onClick: onScreener,  accent: "#a78bfa", bg: "#a78bfa15" },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {actions.map(a => (
        <motion.button key={a.label}
          whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }}
          onClick={a.onClick}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 0", borderRadius: 10, border: `1px solid ${a.accent}33`,
            background: a.bg, color: a.accent, cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            transition: "box-shadow 0.15s",
          }}
        >
          {a.icon}{a.label}
        </motion.button>
      ))}
    </div>
  );
}

// ─── Portfolio hero card (2-col span) ────────────────────────────────────────

function PortfolioHeroCard({
  value, gain, gainUp, currency, tradingPoints, tradingScore, activityData,
}: {
  value: string; gain: string; gainUp: boolean; currency: string;
  tradingPoints: number; tradingScore: number; activityData: { date: string; value: number }[];
}) {
  const countedPts   = useCountUp(tradingPoints);
  const countedScore = useCountUp(tradingScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: APPLE }}
      style={{
        gridColumn: "span 2",
        position: "relative", overflow: "hidden",
        borderRadius: 16, padding: "16px 20px",
        background: "var(--color-card)",
        border: "1px solid var(--color-line)",
        boxSizing: "border-box" as const,
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Noise texture overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.025, pointerEvents: "none",
        backgroundImage: NOISE, backgroundRepeat: "repeat", backgroundSize: "160px",
        zIndex: 0,
      }} />

      {/* Accent glow */}
      <div style={{
        position: "absolute", top: -60, right: -40, width: 240, height: 240,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${ACCENT}18 0%, transparent 70%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 24, flex: 1, minHeight: 0 }}>

        {/* Left: value + gain + points */}
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 0 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--color-muted)", opacity: 0.6 }}>
              Portfolio Value
            </p>
            <p style={{ margin: "0 0 6px", fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--color-primary)", lineHeight: 1 }}>
              {value}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                background: gainUp ? `${BULL}18` : `${BEAR}18`,
                color: gainUp ? BULL : BEAR,
                border: `1px solid ${gainUp ? BULL : BEAR}33`,
              }}>
                {gainUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {gain} this month
              </span>
              <LiveDot />
            </div>
          </div>

          {/* Trading score + points row */}
          <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 10, color: "var(--color-muted)", opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.06em" }}>Score</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--color-primary)", letterSpacing: "-0.02em" }}>
                {currency}{countedScore.toLocaleString()}
              </p>
            </div>
            <div style={{ width: "1px", background: "var(--color-line)" }} />
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 10, color: "var(--color-muted)", opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.06em" }}>Points</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--color-primary)", letterSpacing: "-0.02em" }}>
                  {countedPts.toLocaleString()}
                </p>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(135deg,${ACCENT},#00c896)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={10} color="#0a0a0a" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: chart */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "var(--color-muted)", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Activity</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {PORTFOLIO_CATEGORIES.map(c => (
                <span key={c.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--color-muted)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, display: "block" }} />
                  {c.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={activityData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 11 }}
                itemStyle={{ color: "var(--color-primary)" }}
                labelStyle={{ color: "var(--color-muted)" }}
              />
              <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={1.5}
                fill="url(#heroGrad)" dot={false} animationDuration={800} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Holdings card ────────────────────────────────────────────────────────────

function HoldingsCard({ holdings, marketId, onNavigate }: {
  holdings: { symbol: string; shares: number; color: string; bg: string; letter: string }[];
  marketId: string; onNavigate: (sym: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4, ease: APPLE }}
      whileHover={{ y: -2 }}
      style={{
        borderRadius: 16, padding: "18px 18px", flex: 1,
        background: "var(--color-card)", border: "1px solid var(--color-line)",
        boxSizing: "border-box" as const,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>Holdings</span>
        <span style={{ fontSize: 10, color: ACCENT, fontWeight: 600, opacity: 0.8 }}>{holdings.length} positions</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {holdings.map((h, i) => (
          <motion.button key={h.symbol}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate(resolveSymbol(h.symbol, marketId))}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "6px 8px", borderRadius: 10, width: "100%",
              background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
            }}
          >
            <StockAvatar symbol={h.symbol} color={h.color} bg={h.bg} letter={h.letter} px={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
                {h.symbol.replace(/\.(NS|BSE|NSE)$/, "")}
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)" }}>
              {h.shares}{h.shares > 999 ? " u" : " sh"}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Transactions card ────────────────────────────────────────────────────────

function TransactionsCard({ transactions, livePrices, currency, marketId, onNavigate }: {
  transactions: DashboardTransaction[];
  livePrices: Record<string, { price: number; changePct: number | null; live: boolean } | undefined>;
  currency: string; marketId: string; onNavigate: (sym: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4, ease: APPLE }}
      whileHover={{ y: -2 }}
      style={{
        borderRadius: 16, padding: "18px 18px", flex: 1,
        background: "var(--color-card)", border: "1px solid var(--color-line)",
        boxSizing: "border-box" as const,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>Transactions</span>
          {Object.values(livePrices).some(p => p?.live) && <LiveDot />}
        </div>
        <span style={{ fontSize: 10, color: "var(--color-muted)", opacity: 0.5 }}>recent</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {transactions.map((tx, i) => {
          const resolvedSym = resolveSymbol(tx.symbol, marketId);
          const live = livePrices[resolvedSym];
          const displayChange = live?.live ? live.changePct : tx.change;
          const isPos = (displayChange ?? 0) > 0;
          return (
            <motion.button key={`${tx.symbol}-${i}`}
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.06 }}
              whileHover={{ x: 3 }}
              onClick={() => onNavigate(`${resolvedSym}?market=${marketId}`)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 6px", borderRadius: 10, width: "100%",
                background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              <StockAvatar symbol={tx.symbol} color={tx.color} bg={tx.bg} letter={tx.letter} px={30} />
              <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                <p style={{ margin: "0 0 1px", fontSize: 12, fontWeight: 600, color: "var(--color-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tx.symbol.replace(/\.(BSE|NSE|NS)$/i, "")}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: "var(--color-muted)" }}>{tx.name}</p>
              </div>
              {displayChange !== null && displayChange !== undefined && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 99, flexShrink: 0,
                  background: isPos ? `${BULL}18` : `${BEAR}18`,
                  color: isPos ? BULL : BEAR,
                }}>
                  {isPos ? "+" : ""}{displayChange?.toFixed(1)}%
                </span>
              )}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, flexShrink: 0,
                background: tx.amount < 0 ? `${BEAR}18` : `${BULL}18`,
                color: tx.amount < 0 ? BEAR : BULL,
              }}>
                {tx.amount < 0 ? "-" : "+"}{currency}{Math.abs(tx.amount).toLocaleString()}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Portfolio breakdown card ─────────────────────────────────────────────────

function PortfolioBreakdownCard() {
  const BAR_HEIGHTS: Record<string, number[]> = {
    Stocks: [45,62,38,71,55,48,66,42,58,74,51,63,47,69,54,61],
    Crypto: [38,55,71,44,62,49,67,41,58,73,50,64,46,68,53,60],
    Funds:  [52,41,65,48,59,72,44,61,47,66,53,70,45,62,49,57],
    Other:  [33,58,44,67,39,54,71,46,63,48,57,42,69,50,61,36],
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4, ease: APPLE }}
      whileHover={{ y: -2 }}
      style={{
        borderRadius: 16, padding: "18px 18px",
        background: "var(--color-card)", border: "1px solid var(--color-line)",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", display: "block", marginBottom: 14 }}>Allocation</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PORTFOLIO_CATEGORIES.map((cat, i) => (
          <div key={cat.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ color: "var(--color-muted)", fontSize: 11 }}>{cat.label}</span>
              <span style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 700 }}>{cat.pct}%</span>
            </div>
            <div style={{ height: 36, borderRadius: 8, overflow: "hidden", background: "var(--color-line)", position: "relative" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "flex-end", gap: 1, padding: "0 3px", height: "100%" }}>
                {BAR_HEIGHTS[cat.label].map((h, j) => (
                  <motion.div key={j}
                    initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                    transition={{ delay: 0.3 + i * 0.08 + j * 0.012, duration: 0.4, ease: "easeOut" }}
                    style={{ flex: 1, borderRadius: "2px 2px 0 0", height: `${h}%`, background: cat.color, opacity: 0.7 + j / 50, transformOrigin: "bottom" }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Market Movers card ───────────────────────────────────────────────────────

const FALLBACK_MOVERS: Record<string, { gainers: MoverStock[]; losers: MoverStock[] }> = {
  US: {
    gainers: [
      { symbol: "NVDA", name: "NVIDIA Corp",    price: 875.40, changePct: +4.21, currency: "$" },
      { symbol: "META", name: "Meta Platforms", price: 512.30, changePct: +3.18, currency: "$" },
      { symbol: "AAPL", name: "Apple Inc",      price: 189.50, changePct: +1.87, currency: "$" },
      { symbol: "MSFT", name: "Microsoft",      price: 415.20, changePct: +1.42, currency: "$" },
      { symbol: "AMZN", name: "Amazon",         price: 185.60, changePct: +0.98, currency: "$" },
    ],
    losers: [
      { symbol: "TSLA", name: "Tesla Inc",      price: 172.30, changePct: -3.44, currency: "$" },
      { symbol: "ADBE", name: "Adobe Inc",      price: 480.10, changePct: -2.11, currency: "$" },
      { symbol: "NFLX", name: "Netflix",        price: 620.40, changePct: -1.76, currency: "$" },
      { symbol: "AMD",  name: "AMD",            price: 165.20, changePct: -1.32, currency: "$" },
      { symbol: "INTC", name: "Intel Corp",     price: 30.40,  changePct: -0.87, currency: "$" },
    ],
  },
  IN: {
    gainers: [
      { symbol: "RELIANCE",  name: "Reliance Industries", price: 2950, changePct: +2.84, currency: "₹" },
      { symbol: "TCS",       name: "Tata Consultancy",    price: 3840, changePct: +1.92, currency: "₹" },
      { symbol: "HDFCBANK",  name: "HDFC Bank",           price: 1680, changePct: +1.54, currency: "₹" },
      { symbol: "INFY",      name: "Infosys",             price: 1420, changePct: +1.21, currency: "₹" },
      { symbol: "WIPRO",     name: "Wipro",               price: 480,  changePct: +0.93, currency: "₹" },
    ],
    losers: [
      { symbol: "TATAMOTORS", name: "Tata Motors",   price: 960,  changePct: -2.14, currency: "₹" },
      { symbol: "ADANIENT",   name: "Adani Ent.",     price: 2480, changePct: -1.88, currency: "₹" },
      { symbol: "SBIN",       name: "State Bank",     price: 820,  changePct: -1.42, currency: "₹" },
      { symbol: "AXISBANK",   name: "Axis Bank",      price: 1120, changePct: -0.98, currency: "₹" },
      { symbol: "NTPC",       name: "NTPC Ltd",       price: 360,  changePct: -0.61, currency: "₹" },
    ],
  },
  CRYPTO: {
    gainers: [
      { symbol: "SOL",  name: "Solana",    price: 168.40, changePct: +5.12, currency: "$" },
      { symbol: "BTC",  name: "Bitcoin",   price: 67200,  changePct: +2.91, currency: "$" },
      { symbol: "AVAX", name: "Avalanche", price: 38.20,  changePct: +2.34, currency: "$" },
      { symbol: "BNB",  name: "BNB",       price: 592.10, changePct: +1.67, currency: "$" },
      { symbol: "ETH",  name: "Ethereum",  price: 3540,   changePct: +1.12, currency: "$" },
    ],
    losers: [
      { symbol: "DOGE", name: "Dogecoin",  price: 0.162,  changePct: -3.21, currency: "$" },
      { symbol: "ADA",  name: "Cardano",   price: 0.452,  changePct: -2.87, currency: "$" },
      { symbol: "DOT",  name: "Polkadot",  price: 7.84,   changePct: -1.94, currency: "$" },
      { symbol: "MATIC",name: "Polygon",   price: 0.72,   changePct: -1.42, currency: "$" },
      { symbol: "XRP",  name: "Ripple",    price: 0.524,  changePct: -0.88, currency: "$" },
    ],
  },
  FX: {
    gainers: [
      { symbol: "GBP/USD", name: "Pound/Dollar",  price: 1.2734, changePct: +0.42, currency: "" },
      { symbol: "EUR/USD", name: "Euro/Dollar",   price: 1.0842, changePct: +0.18, currency: "" },
      { symbol: "AUD/USD", name: "AUD/Dollar",    price: 0.6521, changePct: +0.11, currency: "" },
      { symbol: "NZD/USD", name: "NZD/Dollar",    price: 0.5980, changePct: +0.08, currency: "" },
      { symbol: "EUR/GBP", name: "Euro/Pound",    price: 0.8512, changePct: +0.04, currency: "" },
    ],
    losers: [
      { symbol: "USD/JPY", name: "Dollar/Yen",    price: 154.82, changePct: -0.38, currency: "" },
      { symbol: "USD/CAD", name: "Dollar/CAD",    price: 1.3621, changePct: -0.22, currency: "" },
      { symbol: "USD/CHF", name: "Dollar/Franc",  price: 0.9012, changePct: -0.14, currency: "" },
      { symbol: "EUR/JPY", name: "Euro/Yen",      price: 167.84, changePct: -0.09, currency: "" },
      { symbol: "GBP/JPY", name: "Pound/Yen",     price: 197.21, changePct: -0.05, currency: "" },
    ],
  },
};

function MarketMoversCard({ marketId, currency, onNavigate }: {
  marketId: string; currency: string; onNavigate: (sym: string) => void;
}) {
  const [gainers,  setGainers]  = useState<MoverStock[]>([]);
  const [losers,   setLosers]   = useState<MoverStock[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<"gainers" | "losers">("gainers");

  useEffect(() => {
    setLoading(true);
    const fallback = FALLBACK_MOVERS[marketId] ?? FALLBACK_MOVERS["US"];
    // Show fallback immediately, replace with real data when it arrives
    setGainers(fallback.gainers);
    setLosers(fallback.losers);

    Promise.all([
      fetchWithAuth(`/api/screener?market=${marketId}&sortBy=changePct&sortDir=desc&limit=5`),
      fetchWithAuth(`/api/screener?market=${marketId}&sortBy=changePct&sortDir=asc&limit=5`),
    ])
      .then(async ([gRes, lRes]) => {
        if (gRes.ok) {
          const d = await gRes.json();
          const results = (d.results ?? []).map((r: any) => ({
            symbol: r.symbol, name: r.name,
            price: r.price, changePct: r.changePct, currency: r.currency ?? currency,
          }));
          if (results.length > 0) setGainers(results);
        }
        if (lRes.ok) {
          const d = await lRes.json();
          const results = (d.results ?? []).map((r: any) => ({
            symbol: r.symbol, name: r.name,
            price: r.price, changePct: r.changePct, currency: r.currency ?? currency,
          }));
          if (results.length > 0) setLosers(results);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [marketId, currency]);

  const items = tab === "gainers" ? gainers : losers;

  const Skeleton = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--color-line)", opacity: 0.3, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: 50, height: 10, borderRadius: 3, background: "var(--color-line)", opacity: 0.3, marginBottom: 4 }} />
            <div style={{ width: 80, height: 8,  borderRadius: 3, background: "var(--color-line)", opacity: 0.2 }} />
          </div>
          <div style={{ width: 44, height: 20, borderRadius: 99, background: "var(--color-line)", opacity: 0.2 }} />
        </div>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4, ease: APPLE }}
      whileHover={{ y: -2 }}
      style={{
        borderRadius: 16, padding: "18px 18px", height: "100%",
        background: "var(--color-card)", border: "1px solid var(--color-line)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Zap size={13} color={ACCENT} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>Market Movers</span>
        </div>
        {/* Tab toggle */}
        <div style={{
          display: "flex", background: "var(--color-line)",
          borderRadius: 8, padding: 2, gap: 2,
        }}>
          {(["gainers", "losers"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 10, fontWeight: 700, transition: "all 0.15s",
              background: tab === t ? "var(--color-card)" : "transparent",
              color: tab === t
                ? (t === "gainers" ? BULL : BEAR)
                : "var(--color-muted)",
              fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            }}>
              {t === "gainers" ? "▲ Top" : "▼ Bot"}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Skeleton /> : items.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 120, gap: 6 }}>
          <BarChart2 size={24} style={{ color: "var(--color-muted)", opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)", opacity: 0.5 }}>No data yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((stock, i) => {
            const up   = stock.changePct >= 0;
            const clean = stock.symbol.replace(/\.(NS|BSE|NSE)$/, "");
            return (
              <motion.button key={stock.symbol}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                whileHover={{ x: 3 }}
                onClick={() => onNavigate(stock.symbol)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 6px", borderRadius: 10, width: "100%",
                  background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                {/* Rank + color bar */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: up ? `${BULL}12` : `${BEAR}12`,
                  border: `1px solid ${up ? BULL : BEAR}22`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800,
                  color: up ? BULL : BEAR,
                }}>
                  {i + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>
                    {clean}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: "var(--color-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                    {stock.name}
                  </p>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--color-primary)" }}>
                    {stock.currency}{stock.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 2,
                    fontSize: 10, fontWeight: 700,
                    padding: "1px 6px", borderRadius: 99,
                    background: up ? `${BULL}15` : `${BEAR}15`,
                    color: up ? BULL : BEAR,
                  }}>
                    {up ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                    {up ? "+" : ""}{stock.changePct.toFixed(2)}%
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Community leaderboard card ───────────────────────────────────────────────

function CommunityCard({ onNavigate }: { onNavigate: () => void }) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const medals = ["🥇", "🥈", "🥉"];

  useEffect(() => {
    fetchWithAuth("/api/community/leaderboard?sort=returnPct&limit=3")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.leaderboard) setLeaders(data.leaderboard); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4, ease: APPLE }}
      whileHover={{ y: -2 }}
      style={{
        borderRadius: 16, padding: "18px 18px",
        background: "var(--color-card)", border: "1px solid var(--color-line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Trophy size={13} color={ACCENT} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>Top Traders</span>
        </div>
        <button onClick={onNavigate} style={{
          background: "none", border: "none", cursor: "pointer",
          color: ACCENT, fontSize: 10, fontWeight: 600, padding: 0,
          display: "flex", alignItems: "center", gap: 3,
        }}>
          View all <ArrowUpRight size={10} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--color-line)", opacity: 0.4 }} />
              <div style={{ flex: 1, height: 10, borderRadius: 4, background: "var(--color-line)", opacity: 0.3 }} />
            </div>
          ))}
        </div>
      ) : leaders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <p style={{ color: "var(--color-muted)", fontSize: 11, margin: "0 0 8px" }}>No public traders yet</p>
          <button onClick={onNavigate} style={{
            padding: "5px 14px", borderRadius: 8, border: `1px solid ${ACCENT}44`,
            background: `${ACCENT}10`, color: ACCENT, fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>Join Community</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {leaders.map((entry, i) => {
            const up = entry.returnPct >= 0;
            const letter = (entry.name || entry.username || "?")[0].toUpperCase();
            const hue = (letter.charCodeAt(0) * 37) % 360;
            return (
              <motion.button key={entry.userId ?? i}
                whileHover={{ x: 3 }}
                onClick={onNavigate}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 4px", borderRadius: 8, background: "transparent",
                  border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{medals[i]}</span>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: `hsl(${hue},55%,30%)`, border: `1px solid hsl(${hue},55%,45%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: `hsl(${hue},80%,75%)`,
                }}>
                  {letter}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--color-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.name || entry.username || "Anonymous"}
                  </p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: up ? BULL : BEAR,
                  display: "flex", alignItems: "center", gap: 2,
                }}>
                  {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {up ? "+" : ""}{entry.returnPct.toFixed(1)}%
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Watchlist preview card ───────────────────────────────────────────────────

function WatchlistCard({ marketId, currency, onNavigate }: {
  marketId: string; currency: string; onNavigate: (sym: string) => void;
}) {
  const WATCHLIST_PREVIEW = MARKET_DATA[marketId]?.holdings.slice(0, 3) ?? [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4, ease: APPLE }}
      whileHover={{ y: -2 }}
      style={{
        borderRadius: 16, padding: "18px 18px",
        background: "var(--color-card)", border: "1px solid var(--color-line)",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Subtle star decoration */}
      <div style={{ position: "absolute", top: 14, right: 14, opacity: 0.08 }}>
        <Star size={48} color={ACCENT} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Star size={13} color={ACCENT} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>Watchlist</span>
        </div>
        <button onClick={() => onNavigate("/dashboard/watchlist")} style={{
          background: "none", border: "none", cursor: "pointer",
          color: ACCENT, fontSize: 10, fontWeight: 600, padding: 0,
          display: "flex", alignItems: "center", gap: 3,
        }}>
          Manage <ArrowUpRight size={10} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {WATCHLIST_PREVIEW.map((h, i) => (
          <motion.button key={h.symbol}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.35 + i * 0.07 }}
            whileHover={{ x: 3 }}
            onClick={() => onNavigate(`/dashboard/stock/${resolveSymbol(h.symbol, marketId)}?market=${marketId}`)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "5px 4px", borderRadius: 8, background: "transparent",
              border: "none", cursor: "pointer", textAlign: "left", width: "100%",
            }}
          >
            <StockAvatar symbol={h.symbol} color={h.color} bg={h.bg} letter={h.letter} px={26} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
              {h.symbol.replace(/\.(NS|BSE|NSE)$/, "")}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{h.shares} sh</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { market } = useMarket();
  const rawKey   = market.id as string;
  const key      = ["IN", "US", "FX", "CRYPTO"].includes(rawKey) ? rawKey : "US";
  const md       = MARKET_DATA[key];
  const currency = market.currency || "$";

  // ── State ──────────────────────────────────────────────────────────────────
  const [realTransactions,  setRealTransactions]  = useState<OrderRow[]>([]);
  const [realHoldings,      setRealHoldings]      = useState<{ symbol: string; shares: number; color: string; bg: string; letter: string }[]>([]);
  const [portfolioValue,    setPortfolioValue]    = useState<string | null>(null);
  const [portfolioGain,     setPortfolioGain]     = useState<string | null>(null);
  const [activityData,      setActivityData]      = useState<{ date: string; value: number }[] | null>(null);
  const [realTradingScore,  setRealTradingScore]  = useState<number | null>(null);
  const [realTradingPoints, setRealTradingPoints] = useState<number | null>(null);
  const [dataLoading,       setDataLoading]       = useState(true);

  // ── Data fetching (identical logic to original) ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setRealTransactions([]); setRealHoldings([]);
      setPortfolioValue(null); setPortfolioGain(null);
      setRealTradingScore(null); setRealTradingPoints(null);
      setDataLoading(true);
    });
    Promise.all([
      fetchWithAuth(`/api/portfolio/summary?market=${key}`),
      fetchWithAuth(`/api/orders/paginated?page=0&size=5`),
    ]).then(async ([portfolioRes, ordersRes]) => {
      if (cancelled) return;
      if (portfolioRes.ok) {
        const data = await portfolioRes.json() as PortfolioSummaryResponse;
        if (cancelled) return;
        setRealHoldings((data.holdings ?? []).map(h => ({
          symbol: h.symbol, shares: h.quantity ?? h.shares ?? 0,
          color: ACCENT, bg: `${ACCENT}12`, letter: (h.symbol ?? "?")[0],
        })));
        const val = data.totalValue ?? data.portfolioValue ?? null;
        if (val != null) setPortfolioValue(`${currency}${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
        const pnl = data.totalPnl ?? 0; const pnlPct = data.totalPnlPct ?? 0;
        if (pnl !== 0) {
          const sign = pnl >= 0 ? "+" : "-";
          setPortfolioGain(`${sign}${currency}${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })} (${sign}${Math.abs(pnlPct).toFixed(2)}%)`);
        }
        const totalCost = data.totalInvested ?? data.totalCost ?? 0;
        if (totalCost > 0) { setRealTradingScore(Math.floor(totalCost)); setRealTradingPoints(Math.floor(totalCost / 10)); }
      }
      if (ordersRes.ok) {
        const data = await ordersRes.json() as { orders?: OrderRow[] };
        const all = data.orders ?? [];
        const filtered = all.filter(o => o.market?.toUpperCase() === key);
        setRealTransactions(filtered.length > 0 ? filtered : all);
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, [key, currency]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setActivityData(null); });
    fetchWithAuth("/api/orders")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((orders: OrderRow[]) => {
        if (cancelled) return;
        const src = orders.filter(o => o.market?.toUpperCase() === key);
        const grouped: Record<string, number> = {};
        (src.length > 0 ? src : orders).forEach(o => {
          const label = new Date(o.createdAt ?? "").toLocaleString("en-US", { month: "short" });
          grouped[label] = (grouped[label] ?? 0) + Math.abs(o.total ?? 0);
        });
        const result = Object.entries(grouped).map(([date, value]) => ({ date, value: Math.round(value) }));
        if (result.length >= 2) setActivityData(result);
      })
      .catch(() => { if (!cancelled) setActivityData(null); });
    return () => { cancelled = true; };
  }, [key]);

  // ── Derived display values ─────────────────────────────────────────────────
  const displayHoldings = realHoldings.length > 0 ? realHoldings : md.holdings;
  const displayValue    = portfolioValue ?? md.portfolioValue;
  const displayGain     = portfolioGain  ?? md.portfolioGain;
  const gainUp          = !displayGain.startsWith("-");
  const displayTxs: DashboardTransaction[] = realTransactions.length > 0
    ? realTransactions.slice(0, 5).map(o => ({
        symbol: o.symbol, name: o.symbol.replace(/\.(BSE|NSE|NS)$/i, ""),
        change: null, amount: o.type === "BUY" ? -(o.total ?? 0) : (o.total ?? 0),
        color: ACCENT, bg: `${ACCENT}12`, letter: (o.symbol ?? "?")[0],
      }))
    : md.transactions;

  const txSymbols  = displayTxs.map(t => resolveSymbol(t.symbol, key));
  const livePrices = useLivePrices(txSymbols);

  const tradingScore  = realTradingScore  ?? parseInt(md.tradingScore.replace(/[^\d]/g, ""), 10);
  const tradingPoints = realTradingPoints ?? md.tradingPoints;

  const nav = (path: string) => router.push(path);

  return (
    <div style={{
      minHeight: "100vh", padding: "16px 20px 32px",
      background: "var(--color-page)",
      fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
      boxSizing: "border-box", overflowX: "hidden",
    }}>
      <style>{`
        @keyframes ping          { 0%{transform:scale(1);opacity:.75} 100%{transform:scale(2.2);opacity:0} }
        @keyframes tickerScroll  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .bento-row1 {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 12px;
          align-items: stretch;
        }
        .bento-row1 > * { min-height: 0; }
        .bento-hero-wrap  { grid-column: span 2; display: flex; flex-direction: column; }
        .bento-hold-wrap  { grid-column: span 1; display: flex; flex-direction: column; }
        .bento-txs-wrap   { grid-column: span 1; display: flex; flex-direction: column; }
        .bento-row2 {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 12px;
          margin-top: 12px;
        }
        @media (max-width: 1024px) {
          .bento-row1, .bento-row2 { grid-template-columns: repeat(2, 1fr) !important; }
          .bento-hero-wrap  { grid-column: span 2 !important; }
          .bento-hold-wrap, .bento-txs-wrap { grid-column: span 1 !important; }
        }
        @media (max-width: 640px) {
          .bento-row1, .bento-row2 { grid-template-columns: 1fr !important; }
          .bento-hero-wrap, .bento-hold-wrap, .bento-txs-wrap { grid-column: span 1 !important; }
        }
      `}</style>

      {/* ── Market ticker strip ── */}
      <TickerStrip />

      {/* ── Quick actions ── */}
      <div style={{ marginBottom: 14 }}>
        <QuickActions
          onBuy={()       => nav("/dashboard/stock/AAPL")}
          onWatchlist={()  => nav("/dashboard/watchlist")}
          onScreener={()   => nav("/dashboard/screener")}
        />
      </div>

      {/* ── ROW 1 ── */}
      <div className="bento-row1">
        <div className="bento-hero-wrap">
          <PortfolioHeroCard
            value={displayValue} gain={displayGain} gainUp={gainUp}
            currency={currency} tradingPoints={tradingPoints}
            tradingScore={tradingScore} activityData={activityData ?? ACTIVITY_DATA}
          />
        </div>

        <div className="bento-hold-wrap">
          <HoldingsCard
            holdings={displayHoldings} marketId={key}
            onNavigate={sym => nav(`/dashboard/stock/${sym}?market=${key}`)}
          />
        </div>

        <div className="bento-txs-wrap">
          {dataLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                borderRadius: 16, padding: "18px 18px", flex: 1,
                background: "var(--color-card)", border: "1px solid var(--color-line)",
              }}>
              <div style={{ width: 80, height: 13, borderRadius: 4, background: "var(--color-line)", marginBottom: 14, opacity: 0.4 }} />
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 6px" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--color-line)", flexShrink: 0, opacity: 0.3 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: 60, height: 10, borderRadius: 4, background: "var(--color-line)", opacity: 0.3, marginBottom: 4 }} />
                    <div style={{ width: 40, height: 8,  borderRadius: 4, background: "var(--color-line)", opacity: 0.2 }} />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <TransactionsCard
              transactions={displayTxs} livePrices={livePrices}
              currency={currency} marketId={key}
              onNavigate={path => nav(`/dashboard/stock/${path}`)}
            />
          )}
        </div>
      </div>

      {/* ── ROW 2 ── */}
      <div className="bento-row2">
        <MarketMoversCard
          marketId={key} currency={currency}
          onNavigate={sym => nav(`/dashboard/stock/${sym}?market=${key}`)}
        />
        <PortfolioBreakdownCard />
        <CommunityCard onNavigate={() => nav("/dashboard/community")} />
        <WatchlistCard
          marketId={key} currency={currency}
          onNavigate={path => nav(path)}
        />
      </div>
    </div>
  );
}