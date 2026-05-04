"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, TrendingUp, TrendingDown, Star, StarOff,
  Plus, Minus, Activity, BarChart2, Clock, AlertCircle, CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import StockInsightsPanel from "@/components/StockInsightsPanel";

// Dynamically import chart — no SSR (lightweight-charts is browser-only)
const TradingViewChart = dynamic(() => import("@/components/TradingViewChart"), { ssr: false });

// Safe useMarket import
let useMarketHook: () => { market?: { currency?: string; id?: string } | null };
try {
  useMarketHook = require("@/hooks/useMarket").useMarket;
} catch {
  try { useMarketHook = require("@/context/MarketContext").useMarket; }
  catch { useMarketHook = () => ({ market: null }); }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockQuote {
  symbol: string; price: number; open: number; high: number; low: number;
  previousClose: number; change: number; changePercent: number; volume: number;
  latestTradingDay: string; analystBuy: number; analystHold: number; analystSell: number;
}

interface Candle {
  date: string; open: number; high: number; low: number; close: number; volume: number;
}

type ChartType = "area" | "candlestick";
type OrderType = "buy" | "sell";
type TimeRange = "1D" | "7D" | "1M" | "3M" | "1Y" | "All";

const TIME_RANGES: TimeRange[] = ["1D", "7D", "1M", "3M", "1Y", "All"];

function filterCandles(candles: Candle[], range: TimeRange): Candle[] {
  if (!candles.length || range === "All") return candles;
  const now = new Date();
  const cutoff = new Date(now);
  switch (range) {
    case "1D": cutoff.setDate(now.getDate() - 1);         break;
    case "7D": cutoff.setDate(now.getDate() - 7);         break;
    case "1M": cutoff.setMonth(now.getMonth() - 1);       break;
    case "3M": cutoff.setMonth(now.getMonth() - 3);       break;
    case "1Y": cutoff.setFullYear(now.getFullYear() - 1); break;
  }
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const filtered = candles.filter(c => c.date >= cutoffStr);
  return filtered.length >= 2 ? filtered : candles;
}

// ─── Logo / Avatar ────────────────────────────────────────────────────────────

const LOGO_DOMAINS: Record<string, string> = {
  TSLA:"tesla.com", AAPL:"apple.com", AMD:"amd.com", MSFT:"microsoft.com",
  NVDA:"nvidia.com", ADBE:"adobe.com", KO:"coca-cola.com", MCD:"mcdonalds.com",
  AMZN:"amazon.com", GOOGL:"google.com", META:"meta.com", NFLX:"netflix.com",
  INTC:"intel.com", PYPL:"paypal.com", BABA:"alibaba.com", DIS:"disney.com",
  UBER:"uber.com", LYFT:"lyft.com", SHOP:"shopify.com", SNAP:"snap.com",
  SPOT:"spotify.com", COIN:"coinbase.com",
  "RELIANCE.BSE":"ril.com", "TCS.BSE":"tcs.com", "INFY.BSE":"infosys.com",
  "HDFCBANK.BSE":"hdfcbank.com", "WIPRO.BSE":"wipro.com",
};

const AVATAR_COLORS = [
  ["#8FFFD6","#00c896"],["#818cf8","#6366f1"],["#f59e0b","#d97706"],
  ["#f472b6","#ec4899"],["#34d399","#10b981"],["#60a5fa","#3b82f6"],
];

function StockAvatar({ symbol, size = 52 }: { symbol: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const clean = symbol.replace(".BSE","").replace(".NSE","");
  const domain = LOGO_DOMAINS[symbol] ?? LOGO_DOMAINS[clean];
  const logoUrl = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
  const [from, to] = AVATAR_COLORS[clean.charCodeAt(0) % AVATAR_COLORS.length];
  const gid = `ag-${clean}`;
  if (!logoUrl || imgError) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from}/><stop offset="100%" stopColor={to}/>
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={size/2} fill={`url(#${gid})`}/>
        <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
          fill="#0a0a0a" fontWeight="800" fontSize={size*0.32} fontFamily="Geist,sans-serif">
          {clean.slice(0,2)}
        </text>
      </svg>
    );
  }
  return (
    <div style={{ width:size,height:size,borderRadius:"50%",overflow:"hidden",
      background:"#1f1f1f",display:"flex",alignItems:"center",justifyContent:"center",
      flexShrink:0,border:"1px solid #2a2a2a" }}>
      <img src={logoUrl} alt={clean} width={size*0.6} height={size*0.6}
        onError={() => setImgError(true)} style={{ objectFit:"contain" }}/>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

const Toast = ({ message, type }: { message:string; type:"success"|"error" }) => (
  <div style={{ position:"fixed",bottom:32,right:32,background:"#111",
    border:`1px solid ${type==="success"?"#8FFFD6":"#ef4444"}`,borderRadius:10,
    padding:"14px 20px",display:"flex",alignItems:"center",gap:10,
    zIndex:9999,animation:"fadeInUp 0.3s ease",boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
    {type==="success"?<CheckCircle2 size={18} color="#8FFFD6"/>:<AlertCircle size={18} color="#ef4444"/>}
    <span style={{ color:"#fff",fontSize:14 }}>{message}</span>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // market comes from either the URL ?market= param (set by dashboard/portfolio)
  // or falls back to the global market context
  const { market: ctxMarket } = useMarketHook() ?? {};
  const marketIdFromUrl = searchParams.get("market") ?? ctxMarket?.id ?? "US";

  const isIndian = symbol?.endsWith(".BSE") || symbol?.endsWith(".NSE") || marketIdFromUrl === "IN";
  const currencySymbol = ctxMarket?.currency ?? (isIndian ? "₹" : "$");

  // The symbol to pass to the ML service — strip .BSE since ML service uses plain symbols
  const mlSymbol = symbol?.replace(".BSE","").replace(".NSE","") ?? "";

  const [quote, setQuote]               = useState<StockQuote | null>(null);
  const [history, setHistory]           = useState<Candle[]>([]);
  const [loading, setLoading]           = useState(true);
  const [histLoading, setHistLoading]   = useState(true);
  const [error]                         = useState<string | null>(null);
  const [chartType, setChartType]       = useState<ChartType>("candlestick");
  const [activeRange, setActiveRange]   = useState<TimeRange>("3M");
  const [orderType, setOrderType]       = useState<OrderType>("buy");
  const [quantity, setQuantity]         = useState(1);
  const [orderLoading, setOrderLoading] = useState(false);
  const [toast, setToast]               = useState<{ message:string; type:"success"|"error" } | null>(null);
  const [watchlisted, setWatchlisted]   = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [confirmOpen, setConfirmOpen]   = useState(false);

  const isPositive = (quote?.change ?? 0) >= 0;
  const orderTotal = quote ? quote.price * quantity : 0;

  const getToken    = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const authHeaders = useCallback(() => ({
    "Content-Type":"application/json",
    Authorization:`Bearer ${getToken()}`,
  }), []);

  const showToast = (message: string, type: "success"|"error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Watchlist ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!symbol) return;
    fetch("http://localhost:8081/api/watchlist", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((list: { symbol: string }[]) => {
        setWatchlisted(list.some(w => w.symbol === symbol?.toUpperCase()));
      })
      .catch(() => {});
  }, [symbol, authHeaders]);

  const toggleWatchlist = async () => {
    if (!symbol) return;
    setWatchlistLoading(true);
    try {
      if (watchlisted) {
        await fetch(`http://localhost:8081/api/watchlist/${symbol}`, {
          method: "DELETE", headers: authHeaders(),
        });
        setWatchlisted(false);
        showToast(`${symbol} removed from watchlist`, "success");
      } else {
        await fetch("http://localhost:8081/api/watchlist", {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ symbol: symbol.toUpperCase() }),
        });
        setWatchlisted(true);
        showToast(`${symbol} added to watchlist`, "success");
      }
    } catch {
      showToast("Watchlist update failed", "error");
    } finally {
      setWatchlistLoading(false);
    }
  };

  // ── Mock helpers ──────────────────────────────────────────────────────────

  const getMockQuote = useCallback((sym: string): StockQuote => {
    const indian = sym.endsWith(".BSE") || sym.endsWith(".NSE");
    const seed = sym.split("").reduce((a,c) => a + c.charCodeAt(0), 0);
    const price = indian ? 500 + (seed % 4500) : 20 + (seed % 480);
    return {
      symbol: sym.toUpperCase(), price: +price.toFixed(2),
      open: +(price*0.987).toFixed(2), high: +(price*1.021).toFixed(2),
      low: +(price*0.968).toFixed(2), previousClose: +(price*0.994).toFixed(2),
      change: +(price*0.006).toFixed(2), changePercent: 0.58,
      volume: 4823100, latestTradingDay: new Date().toISOString().split("T")[0],
      analystBuy:65, analystHold:25, analystSell:10,
    };
  }, []);

  const getMockHistory = useCallback((sym: string): Candle[] => {
    const indian = sym.endsWith(".BSE") || sym.endsWith(".NSE");
    const seed = sym.split("").reduce((a,c) => a + c.charCodeAt(0), 0);
    let base = indian ? 500 + (seed % 4500) : 20 + (seed % 480);
    const candles: Candle[] = [];
    for (let i = 365; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const open  = base + (Math.random()-0.5)*base*0.02;
      const close = open + (Math.random()-0.47)*base*0.018;
      const high  = Math.max(open,close) + Math.random()*base*0.01;
      const low   = Math.min(open,close) - Math.random()*base*0.01;
      candles.push({
        date:  d.toISOString().split("T")[0],
        open:  +open.toFixed(2), high: +high.toFixed(2),
        low:   +low.toFixed(2),  close: +close.toFixed(2),
        volume: Math.floor(Math.random()*5000000+500000),
      });
      base = close;
    }
    return candles;
  }, []);

  // ── Fetch quote + history ─────────────────────────────────────────────────

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    // Pass market param so backend appends .BSE for Indian stocks if needed
    fetch(`/api/stocks/${symbol}?market=${marketIdFromUrl}`, { headers: authHeaders() })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setQuote(!data?.price || Number(data.price) === 0 ? getMockQuote(symbol) : data); })
      .catch(() => setQuote(getMockQuote(symbol)))
      .finally(() => setLoading(false));
  }, [symbol, marketIdFromUrl, authHeaders, getMockQuote]);

  useEffect(() => {
    if (!symbol) return;
    setHistLoading(true);
    fetch(`/api/stocks/${symbol}/history?market=${marketIdFromUrl}`, { headers: authHeaders() })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setHistory(data?.candles?.length > 0 ? data.candles : getMockHistory(symbol)); })
      .catch(() => setHistory(getMockHistory(symbol)))
      .finally(() => setHistLoading(false));
  }, [symbol, marketIdFromUrl, authHeaders, getMockHistory]);

  // ── Order ─────────────────────────────────────────────────────────────────

  const handleOrder = async () => {
    if (!quote || quantity <= 0) return;
    setOrderLoading(true);
    try {
      const meRes = await fetch("/api/users/me", { headers: authHeaders() });
      if (!meRes.ok) throw new Error("Auth failed");
      const me = await meRes.json();
      const res = await fetch("/api/holdings", {
        method:"POST", headers: authHeaders(),
        body: JSON.stringify({
          portfolioId: me.portfolioId, symbol: quote.symbol,
          quantity: orderType === "sell" ? -quantity : quantity,
          buyPrice: quote.price,
        }),
      });
      if (!res.ok) throw new Error(`Order failed: ${res.status}`);
      showToast(`${orderType==="buy"?"Bought":"Sold"} ${quantity} × ${quote.symbol} @ ${currencySymbol}${quote.price.toLocaleString("en-IN",{minimumFractionDigits:2})}`, "success");
      setQuantity(1);
    } catch (e: any) {
      showToast(e.message ?? "Order failed", "error");
    } finally {
      setOrderLoading(false);
    }
  };

  // ── Formatters ────────────────────────────────────────────────────────────

  const fmt    = (n:number) => (n??0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtVol = (n:number) => {
    if (!n) return "—";
    if (n>=1e7) return (n/1e7).toFixed(2)+" Cr";
    if (n>=1e5) return (n/1e5).toFixed(2)+" L";
    return n.toLocaleString("en-IN");
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding:"24px 32px", maxWidth:1200, margin:"0 auto" }}>
      <Skeleton className="h-4 w-24 mb-6" />
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-5" style={{ gridTemplateColumns:"1fr 340px" }}>
        <Skeleton className="h-[400px] rounded-2xl" />
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding:"40px 32px",textAlign:"center" }}>
      <AlertCircle size={40} color="#ef4444" style={{ margin:"0 auto 12px",display:"block" }}/>
      <p style={{ color:"#ef4444",fontWeight:600 }}>{error}</p>
      <button onClick={() => router.back()} style={{ marginTop:16,color:"#8FFFD6",background:"none",border:"none",cursor:"pointer" }}>← Go back</button>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeInUp { from { opacity:0;transform:translateY(12px); } to { opacity:1;transform:translateY(0); } }
        .ss-btn:hover { opacity:0.85; }
        .ss-stat:hover { border-color:#2a2a2a !important; }
        .ss-back:hover { color:#8FFFD6 !important; }
        .ss-order:hover { filter:brightness(1.1); }
        .ss-order:active { transform:scale(0.98); }
        .ss-qty:hover { background:#1f1f1f !important; }
      `}</style>

      <div style={{ padding:"24px 32px",maxWidth:1200,margin:"0 auto",animation:"fadeInUp 0.4s ease" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:28 }}>
          <div>
            <button className="ss-back" onClick={() => router.back()}
              style={{ display:"flex",alignItems:"center",gap:6,color:"#888",background:"none",
                border:"none",cursor:"pointer",fontSize:13,marginBottom:16,padding:0,transition:"color 0.2s" }}>
              <ArrowLeft size={14}/> Back
            </button>
            <div style={{ display:"flex",alignItems:"center",gap:16 }}>
              <StockAvatar symbol={quote?.symbol ?? symbol ?? ""} size={52}/>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <h1 style={{ fontSize:22,fontWeight:700,color:"#fff",margin:0 }}>{quote?.symbol ?? symbol}</h1>
                  <span style={{ fontSize:11,padding:"2px 8px",background:"#1f1f1f",borderRadius:6,color:"#888",border:"1px solid #2a2a2a" }}>
                    {symbol?.endsWith(".BSE")?"BSE":symbol?.endsWith(".NSE")?"NSE":marketIdFromUrl==="IN"?"NSE":"NASDAQ"}
                  </span>
                </div>
                <p style={{ color:"#888",fontSize:13,margin:"4px 0 0" }}>
                  {quote?.latestTradingDay
                    ? `Last updated: ${new Date(quote.latestTradingDay).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}`
                    : "Live data"}
                </p>
              </div>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:32,fontWeight:800,color:"#fff",letterSpacing:-1 }}>
              {currencySymbol}{fmt(quote?.price??0)}
            </div>
            <Badge
              variant="outline"
              className="text-sm font-semibold px-3 py-1 mt-2"
              style={{
                background: isPositive?"rgba(143,255,214,0.08)":"rgba(239,68,68,0.08)",
                borderColor: isPositive?"rgba(143,255,214,0.2)":"rgba(239,68,68,0.2)",
                color: isPositive?"#8FFFD6":"#ef4444",
              }}
            >
              {isPositive?<TrendingUp size={13} className="mr-1"/>:<TrendingDown size={13} className="mr-1"/>}
              {isPositive?"+":""}{fmt(quote?.change??0)} ({isPositive?"+":""}{(quote?.changePercent??0).toFixed(2)}%)
            </Badge>
          </div>
        </div>

        {/* ── Two-col layout ── */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 340px",gap:20,alignItems:"start" }}>

          {/* ── LEFT column ── */}
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

            {/* Chart card */}
            <div style={{ background:"#111",border:"1px solid #1f1f1f",borderRadius:14,padding:"20px 24px" }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <Activity size={15} color="#8FFFD6"/>
                  <span style={{ color:"#fff",fontWeight:600,fontSize:14 }}>Price Chart</span>
                  <span style={{ fontSize:10,padding:"2px 8px",background:"#8FFFD611",
                    border:"1px solid #8FFFD633",borderRadius:99,color:"#8FFFD6",fontWeight:600 }}>
                    TradingView
                  </span>
                </div>
                <Tabs value={chartType} onValueChange={v => setChartType(v as ChartType)}>
                  <TabsList className="bg-[#0a0a0a] border border-[#1f1f1f]">
                    <TabsTrigger value="candlestick" className="flex items-center gap-1.5 text-xs data-[state=active]:text-[#8FFFD6]">
                      <BarChart2 size={12}/> Candlestick
                    </TabsTrigger>
                    <TabsTrigger value="area" className="flex items-center gap-1.5 text-xs data-[state=active]:text-[#8FFFD6]">
                      <Activity size={12}/> Area
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div style={{ display:"flex",gap:6,marginBottom:16 }}>
                {TIME_RANGES.map(r => (
                  <button key={r} onClick={() => setActiveRange(r)}
                    style={{
                      padding:"4px 12px",borderRadius:99,fontSize:11,fontWeight:600,
                      cursor:"pointer",transition:"all 0.15s",border:"none",
                      background: activeRange===r ? "#8FFFD6" : "#1a1a1a",
                      color:      activeRange===r ? "#0a0a0a" : "#555",
                    }}>
                    {r}
                  </button>
                ))}
              </div>

              {histLoading ? (
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-[300px] w-full rounded-lg" />
                </div>
              ) : (
                <TradingViewChart
                  candles={filterCandles(history, activeRange)}
                  type={chartType}
                />
              )}

              <p style={{ color:"#333",fontSize:10,marginTop:8,textAlign:"right" }}>
                Volume bars shown below price
              </p>
            </div>

            {/* Stats row 1 */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10 }}>
              {[
                { label:"Open",        value:`${currencySymbol}${fmt(quote?.open??0)}` },
                { label:"Day High",    value:`${currencySymbol}${fmt(quote?.high??0)}`,        color:"#8FFFD6" },
                { label:"Day Low",     value:`${currencySymbol}${fmt(quote?.low??0)}`,         color:"#ef4444" },
                { label:"Prev. Close", value:`${currencySymbol}${fmt(quote?.previousClose??0)}` },
              ].map(({ label, value, color }) => (
                <div key={label} className="ss-stat" style={{ background:"#111",border:"1px solid #1f1f1f",borderRadius:10,padding:"14px 16px",transition:"border-color 0.2s" }}>
                  <p style={{ color:"#555",fontSize:11,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:0.5 }}>{label}</p>
                  <p style={{ color:color??"#fff",fontWeight:600,fontSize:15,margin:0 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Stats row 2 */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10 }}>
              {[
                { label:"Volume",           value:fmtVol(quote?.volume??0) },
                { label:"Last Trading Day", value:quote?.latestTradingDay??"—" },
              ].map(({ label, value }) => (
                <div key={label} className="ss-stat" style={{ background:"#111",border:"1px solid #1f1f1f",borderRadius:10,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,transition:"border-color 0.2s" }}>
                  <Clock size={14} color="#555"/>
                  <div>
                    <p style={{ color:"#555",fontSize:11,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:0.5 }}>{label}</p>
                    <p style={{ color:"#fff",fontWeight:600,fontSize:14,margin:0 }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Analyst Ratings */}
            <div style={{ background:"#111",border:"1px solid #1f1f1f",borderRadius:14,padding:"20px 24px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:20 }}>
                <Star size={15} color="#8FFFD6"/>
                <span style={{ color:"#fff",fontWeight:600,fontSize:14 }}>Analyst Ratings</span>
                <span style={{ marginLeft:"auto",fontSize:11,color:"#555",background:"#0a0a0a",border:"1px solid #1f1f1f",padding:"2px 8px",borderRadius:5 }}>AI-powered</span>
              </div>
              <div style={{ display:"flex",gap:10,marginBottom:20 }}>
                {[
                  { label:"Strong Buy", val:quote?.analystBuy??65,  color:"#8FFFD6", bg:"rgba(143,255,214,0.07)" },
                  { label:"Hold",       val:quote?.analystHold??25, color:"#f59e0b", bg:"rgba(245,158,11,0.07)" },
                  { label:"Sell",       val:quote?.analystSell??10, color:"#ef4444", bg:"rgba(239,68,68,0.07)" },
                ].map(({ label, val, color, bg }) => (
                  <div key={label} style={{ flex:1,textAlign:"center",background:bg,border:`1px solid ${color}22`,borderRadius:10,padding:"12px 8px" }}>
                    <div style={{ fontSize:22,fontWeight:800,color }}>{val}%</div>
                    <div style={{ fontSize:11,color:"#888",marginTop:3 }}>{label}</div>
                  </div>
                ))}
              </div>
              {[
                { label:"Buy",  val:quote?.analystBuy??65,  color:"#8FFFD6", tip:"Analysts recommending to buy this stock" },
                { label:"Hold", val:quote?.analystHold??25, color:"#f59e0b", tip:"Analysts recommending to hold this stock" },
                { label:"Sell", val:quote?.analystSell??10, color:"#ef4444", tip:"Analysts recommending to sell this stock" },
              ].map(({ label, val, color, tip }) => (
                <div key={label} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                    <span style={{ fontSize:12,color:"#888" }}>{label}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span style={{ fontSize:12,color,fontWeight:600,cursor:"help" }}>{val}%</span>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-xs">{tip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div style={{ height:5,background:"#1f1f1f",borderRadius:3,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${val}%`,background:color,borderRadius:3,transition:"width 0.8s cubic-bezier(0.16,1,0.3,1)" }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* ── AI Insights Panel — wired below analyst ratings ── */}
            <StockInsightsPanel
              symbol={mlSymbol}
              market={ctxMarket as any}
            />

          </div>{/* end LEFT column */}

          {/* ── RIGHT — Order Panel ── */}
          <div style={{ background:"#111",border:"1px solid #1f1f1f",borderRadius:14,padding:"20px",position:"sticky",top:20 }}>
            <h3 style={{ color:"#fff",fontWeight:700,fontSize:15,margin:"0 0 18px" }}>Place Order</h3>
            <div style={{ display:"flex",background:"#0a0a0a",border:"1px solid #1f1f1f",borderRadius:10,padding:4,marginBottom:20 }}>
              {(["buy","sell"] as OrderType[]).map(t => (
                <button key={t} className="ss-btn" onClick={() => setOrderType(t)} style={{
                  flex:1,padding:"10px 0",borderRadius:7,border:"none",cursor:"pointer",
                  fontSize:13,fontWeight:600,transition:"all 0.2s",
                  background:orderType===t?(t==="buy"?"rgba(143,255,214,0.12)":"rgba(239,68,68,0.12)"):"transparent",
                  color:orderType===t?(t==="buy"?"#8FFFD6":"#ef4444"):"#555",
                  borderTop:orderType===t?`2px solid ${t==="buy"?"#8FFFD6":"#ef4444"}`:"2px solid transparent",
                }}>{t.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ background:"#0a0a0a",border:"1px solid #1f1f1f",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ color:"#888",fontSize:12 }}>Market Price</span>
              <span style={{ color:"#fff",fontWeight:700,fontSize:16 }}>{currencySymbol}{fmt(quote?.price??0)}</span>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block",color:"#888",fontSize:12,marginBottom:8 }}>Quantity</label>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <button className="ss-qty" onClick={() => setQuantity(Math.max(1,quantity-1))}
                  style={{ width:36,height:36,background:"#111",border:"1px solid #1f1f1f",borderRadius:8,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s" }}>
                  <Minus size={14}/>
                </button>
                <input type="number" value={quantity} min={1}
                  onChange={e => setQuantity(Math.max(1,parseInt(e.target.value)||1))}
                  style={{ flex:1,background:"#0a0a0a",border:"1px solid #1f1f1f",borderRadius:8,color:"#fff",fontSize:16,fontWeight:600,textAlign:"center",padding:"8px 0",outline:"none" }}/>
                <button className="ss-qty" onClick={() => setQuantity(quantity+1)}
                  style={{ width:36,height:36,background:"#111",border:"1px solid #1f1f1f",borderRadius:8,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s" }}>
                  <Plus size={14}/>
                </button>
              </div>
            </div>
            <div style={{ background:"#0a0a0a",border:"1px solid #1f1f1f",borderRadius:10,padding:"14px 16px",marginBottom:20 }}>
              {[
                { label:"Price per share", value:`${currencySymbol}${fmt(quote?.price??0)}` },
                { label:"Quantity",        value:quantity.toString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
                  <span style={{ color:"#555",fontSize:12 }}>{label}</span>
                  <span style={{ color:"#888",fontSize:12 }}>{value}</span>
                </div>
              ))}
              <div style={{ borderTop:"1px solid #1f1f1f",paddingTop:10,marginTop:4,display:"flex",justifyContent:"space-between" }}>
                <span style={{ color:"#888",fontSize:13 }}>Total</span>
                <span style={{ color:"#fff",fontWeight:700,fontSize:15 }}>
                  {currencySymbol}{orderTotal.toLocaleString("en-IN",{minimumFractionDigits:2})}
                </span>
              </div>
            </div>
            <button className="ss-order" onClick={() => setConfirmOpen(true)} disabled={orderLoading} style={{
              width:"100%",padding:"14px 0",borderRadius:10,border:"none",
              cursor:orderLoading?"not-allowed":"pointer",
              fontWeight:700,fontSize:14,letterSpacing:0.3,transition:"all 0.2s",
              background:orderType==="buy"?"linear-gradient(135deg,#8FFFD6,#00c896)":"linear-gradient(135deg,#ef4444,#dc2626)",
              color:orderType==="buy"?"#0a0a0a":"#fff",
              opacity:orderLoading?0.7:1,
            }}>
              {orderLoading?"Processing…":`${orderType==="buy"?"Buy":"Sell"} ${quantity} × ${quote?.symbol??symbol}`}
            </button>

            <button onClick={toggleWatchlist} disabled={watchlistLoading} style={{
              width:"100%",marginTop:10,padding:"11px 0",borderRadius:10,
              border:`1px solid ${watchlisted?"#8FFFD6":"#1f1f1f"}`,cursor:"pointer",
              fontWeight:600,fontSize:13,background:"transparent",
              color:watchlisted?"#8FFFD6":"#888",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.2s",
              opacity: watchlistLoading ? 0.6 : 1,
            }}>
              {watchlisted?<Star size={14} fill="#8FFFD6"/>:<StarOff size={14}/>}
              {watchlistLoading ? "Updating…" : watchlisted?"Watchlisted":"Add to Watchlist"}
            </button>
            <p style={{ color:"#333",fontSize:11,textAlign:"center",marginTop:16,lineHeight:1.5 }}>
              Market orders are executed at prevailing prices. Past performance is not indicative of future results.
            </p>
          </div>

        </div>{/* end two-col grid */}
      </div>

      {toast && <Toast {...toast}/>}

      {/* ── Order Confirmation Dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-[#111] border-[#1f1f1f] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              Confirm {orderType === "buy" ? "Purchase" : "Sale"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#888]">Symbol</span>
              <span className="font-semibold">{quote?.symbol ?? symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888]">Action</span>
              <span className="font-semibold capitalize" style={{ color: orderType==="buy"?"#8FFFD6":"#ef4444" }}>
                {orderType}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888]">Quantity</span>
              <span className="font-semibold">{quantity}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888]">Price</span>
              <span className="font-semibold">{currencySymbol}{fmt(quote?.price??0)}</span>
            </div>
            <div className="border-t border-[#1f1f1f] pt-3 flex justify-between">
              <span className="text-[#888] text-sm">Total</span>
              <span className="font-bold text-base">{currencySymbol}{orderTotal.toLocaleString("en-IN",{minimumFractionDigits:2})}</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}
              className="border-[#1f1f1f] text-[#888] hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={() => { setConfirmOpen(false); handleOrder(); }}
              className="font-bold"
              style={{
                background: orderType==="buy"?"linear-gradient(135deg,#8FFFD6,#00c896)":"linear-gradient(135deg,#ef4444,#dc2626)",
                color: orderType==="buy"?"#0a0a0a":"#fff",
                border:"none",
              }}
            >
              Confirm {orderType === "buy" ? "Buy" : "Sell"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}