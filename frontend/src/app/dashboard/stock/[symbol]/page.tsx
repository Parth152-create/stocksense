"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { fetchWithAuth } from "@/lib/auth";
import { useLivePrices } from "@/lib/websocket";
import { useMarket } from "@/lib/MarketContext";
import {
  TrendingUp, TrendingDown, ArrowLeft, Star, StarOff,
  BarChart2, AlertCircle, CandlestickChart, LineChart as LineIcon,
} from "lucide-react";

interface StockOverview {
  symbol: string; name: string; exchange: string;
  sector: string; industry: string; marketCap: number;
  peRatio: number; eps: number; dividendYield: number;
  week52High: number; week52Low: number; description: string;
}
interface AnalystRating {
  strongBuy: number; buy: number; hold: number;
  sell: number; strongSell: number; targetPrice: number;
}
interface Insight {
  id: string; type: "BULLISH" | "BEARISH" | "NEUTRAL";
  title: string; body: string; source: string; publishedAt: string;
}
interface Candle {
  time: number; open: number; high: number; low: number;
  close: number; volume: number;
}
interface OrderForm { type: "BUY" | "SELL"; qty: string; }

type ChartType = "candle" | "area";
type Range     = "1D" | "1W" | "1M" | "1Y" | "ALL";
const RANGES: Range[] = ["1D", "1W", "1M", "1Y", "ALL"];

const BULL   = "#22c55e";
const BEAR   = "#ef4444";
const ACCENT = "#8FFFD6";

function Skeleton({ w, h = 16 }: { w: string | number; h?: number }) {
  return <div style={{ width: w, height: h, borderRadius: 4, background: "var(--color-line)", animation: "pulse 1.5s ease-in-out infinite" }} />;
}
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 10, padding: "12px 16px" }}>
      <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
function AnalystBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 72, color: "var(--color-muted)", fontSize: 12 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "var(--color-line)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .5s" }} />
      </div>
      <span style={{ width: 20, textAlign: "right", fontWeight: 600, fontSize: 13 }}>{count}</span>
    </div>
  );
}

// ─── StockChart ───────────────────────────────────────────────────────────────

function StockChart({ symbol, currency, marketId }: {
  symbol: string; currency: string; marketId: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);

  const [chartType, setChartType] = useState<ChartType>("candle");
  const [range,     setRange]     = useState<Range>("1M");
  const [candles,   setCandles]   = useState<Candle[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{
    price: string; change: string; time: string; isUp: boolean;
  } | null>(null);

  // Fetch candles from backend
  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/stocks/${symbol}/history?range=${range}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Candle[]) => setCandles(Array.isArray(data) ? data : []))
      .catch(() => setCandles([]))
      .finally(() => setLoading(false));
  }, [symbol, range]);

  // Build chart — all colour vars defined INSIDE build() so they're never out of scope
  useEffect(() => {
    if (!containerRef.current || loading) return;

    const build = () => {
      const LWC = (window as any).LightweightCharts;
      if (!LWC) return;

      // ── All colour variables defined here, inside build() ──────────────
      const darkMode   = isDark;
      const bgColor    = darkMode ? "#0d0d0d" : "#ffffff";
      const gridColor  = darkMode ? "#1a1a1a" : "#f0f0f0";
      const textColor  = darkMode ? "#555555" : "#9ca3af";
      const borderCol  = darkMode ? "#1f1f1f" : "#e5e7eb";   // ← was "borderColor" (reserved word risk); renamed borderCol
      // ──────────────────────────────────────────────────────────────────

      // Destroy any previous instance
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch { /* gone */ }
        chartRef.current = null;
      }

      const chart = LWC.createChart(containerRef.current, {
        width:  containerRef.current!.clientWidth,
        height: 340,
        layout: {
          background: { type: "solid", color: bgColor },
          textColor,
          fontFamily: "'Geist','Inter',sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        crosshair: { mode: 1 },
        rightPriceScale: {
          borderColor: borderCol,
          scaleMargins: { top: 0.1, bottom: 0.22 },
        },
        timeScale: {
          borderColor:    borderCol,
          timeVisible:    range === "1D",
          secondsVisible: false,
          fixLeftEdge:    true,
          fixRightEdge:   true,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale:  { mouseWheel: true, pinch: true },
      });

      chartRef.current = chart;

      // Price series
      let priceSeries: any;
      if (chartType === "candle" && candles.length > 0) {
        priceSeries = chart.addCandlestickSeries({
          upColor: BULL, downColor: BEAR,
          borderUpColor: BULL, borderDownColor: BEAR,
          wickUpColor: BULL, wickDownColor: BEAR,
        });
        priceSeries.setData(candles.map(c => ({
          time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
        })));
      } else {
        const first     = candles[0]?.close ?? 0;
        const last      = candles[candles.length - 1]?.close ?? 0;
        const lineColor = last >= first ? ACCENT : BEAR;
        priceSeries = chart.addAreaSeries({
          lineColor,
          topColor:    lineColor + "33",
          bottomColor: lineColor + "05",
          lineWidth:   2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius:  4,
        });
        priceSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
      }

      // Volume bars
      if (candles.length > 0) {
        const volSeries = chart.addHistogramSeries({
          priceFormat:  { type: "volume" },
          priceScaleId: "vol",
          scaleMargins: { top: 0.82, bottom: 0 },
        });
        volSeries.setData(candles.map(c => ({
          time:  c.time,
          value: c.volume,
          color: c.close >= c.open ? BULL + "55" : BEAR + "55",
        })));
      }

      // Crosshair hover
      chart.subscribeCrosshairMove((param: any) => {
        if (!param?.time || !param.seriesData) { setHoverInfo(null); return; }
        const d = param.seriesData.get(priceSeries);
        if (!d) { setHoverInfo(null); return; }
        const closeVal: number = "close" in d ? d.close : (d as any).value;
        const first   = candles[0]?.close ?? closeVal;
        const chgPct  = first > 0 ? ((closeVal - first) / first) * 100 : 0;
        const isUp    = chgPct >= 0;
        const date    = new Date(param.time * 1000);
        const timeStr = range === "1D"
          ? date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
          : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
        setHoverInfo({
          price:  `${currency}${closeVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
          change: `${isUp ? "+" : ""}${chgPct.toFixed(2)}%`,
          time:   timeStr,
          isUp,
        });
      });

      // Responsive resize
      const ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      if (containerRef.current) ro.observe(containerRef.current);
      chart.timeScale().fitContent();

      return () => ro.disconnect();
    };

    // Lazy-load LWC from CDN, then call build()
    if ((window as any).LightweightCharts) {
      build();
    } else {
      const existing = document.querySelector('script[data-lwc="1"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src   = "https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js";
        script.setAttribute("data-lwc", "1");
        script.onload = () => build();
        document.head.appendChild(script);
      } else {
        // Script loading — poll until ready
        const poll = setInterval(() => {
          if ((window as any).LightweightCharts) { clearInterval(poll); build(); }
        }, 50);
      }
    }

    return () => {
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch { /* gone */ }
        chartRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, chartType, isDark]);

  const firstClose = candles[0]?.close ?? 0;
  const lastClose  = candles[candles.length - 1]?.close ?? 0;
  const rangeChg   = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const rangeUp    = rangeChg >= 0;

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--color-line)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          {hoverInfo ? (
            <>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>{hoverInfo.price}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: hoverInfo.isUp ? BULL : BEAR }}>{hoverInfo.change}</span>
              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{hoverInfo.time}</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, color: "var(--color-muted)" }}>{range} range</span>
              {firstClose > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: rangeUp ? BULL : BEAR }}>
                  {rangeUp ? "+" : ""}{rangeChg.toFixed(2)}%
                </span>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Chart type toggle */}
          <div style={{ display: "flex", background: "var(--color-page)", border: "1px solid var(--color-line)", borderRadius: 8, padding: 3, gap: 2 }}>
            {([
              { type: "candle" as ChartType, icon: <CandlestickChart size={13} /> },
              { type: "area"   as ChartType, icon: <LineIcon size={13} />          },
            ]).map(({ type, icon }) => (
              <button key={type} onClick={() => setChartType(type)}
                style={{ display: "flex", alignItems: "center", padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: chartType === type ? "var(--color-card)" : "transparent", color: chartType === type ? ACCENT : "var(--color-muted)" }}>
                {icon}
              </button>
            ))}
          </div>

          {/* Range selector */}
          <div style={{ display: "flex", background: "var(--color-page)", border: "1px solid var(--color-line)", borderRadius: 8, padding: 3, gap: 2 }}>
            {RANGES.map(r => (
              <button key={r} onClick={() => setRange(r)}
                style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: range === r ? "var(--color-card)" : "transparent", color: range === r ? ACCENT : "var(--color-muted)" }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: "relative" }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "var(--color-card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--color-line)", borderTop: `2px solid ${ACCENT}`, animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "var(--color-muted)", fontSize: 12 }}>Loading chart…</span>
          </div>
        )}
        <div ref={containerRef} style={{ height: 340, width: "100%" }} />
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 18px", borderTop: "1px solid var(--color-line)", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "var(--color-muted)" }}>
          Lightweight Charts™ · {candles.length} candles
        </span>
        <span style={{ fontSize: 10, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {marketId === "IN" ? "BSE" : marketId === "CRYPTO" ? "Crypto" : "NYSE / NASDAQ"}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StockPage() {
  const params = useParams();
  const router = useRouter();

  const rawSymbol = ((params?.symbol as string) ?? "").toUpperCase();
  const symbol    = rawSymbol.replace(/\.(BSE|NSE)$/i, "");

  const { market, formatPrice } = useMarket();

  const [overview,       setOverview]       = useState<StockOverview | null>(null);
  const [ratings,        setRatings]        = useState<AnalystRating | null>(null);
  const [insights,       setInsights]       = useState<Insight[]>([]);
  const [watchlisted,    setWatchlisted]    = useState(false);
  const [fallbackPrice,  setFallbackPrice]  = useState<number | null>(null);
  const [fallbackChange, setFallbackChange] = useState<number | null>(null);
  const [orderForm,      setOrderForm]      = useState<OrderForm>({ type: "BUY", qty: "" });
  const [orderStatus,    setOrderStatus]    = useState<"idle"|"loading"|"success"|"error">("idle");
  const [orderMsg,       setOrderMsg]       = useState("");
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const prices = useLivePrices([symbol]);
  const live   = prices[symbol];

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [ovRes, ratRes, insRes, wlRes, quoteRes] = await Promise.all([
        fetchWithAuth(`/api/stocks/${symbol}/overview`),
        fetchWithAuth(`/api/stocks/${symbol}/ratings`),
        fetchWithAuth(`/api/stocks/${symbol}/insights`),
        fetchWithAuth(`/api/watchlist`),
        fetchWithAuth(`/api/stocks/${symbol}`),
      ]);
      if (!ovRes.ok) throw new Error(`Symbol not found: ${symbol}`);
      setOverview(await ovRes.json());
      if (ratRes.ok) setRatings(await ratRes.json());
      if (insRes.ok) setInsights(await insRes.json());
      if (quoteRes.ok) {
        const q = await quoteRes.json();
        if (q.price > 0)                  setFallbackPrice(q.price);
        if (q.changePercent !== undefined) setFallbackChange(q.changePercent);
      }
      if (wlRes.ok) {
        const wl: { symbol: string }[] = await wlRes.json();
        setWatchlisted(wl.some(w =>
          w.symbol === symbol || w.symbol.replace(/\.(BSE|NSE)$/i, "") === symbol
        ));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { void load(); }, [load]);

  const toggleWatchlist = async () => {
    const method = watchlisted ? "DELETE" : "POST";
    const res    = await fetchWithAuth(`/api/watchlist/${symbol}`, { method });
    if (res.ok) setWatchlisted(w => !w);
  };

  const placeOrder = async () => {
    if (!orderForm.qty || isNaN(Number(orderForm.qty)) || Number(orderForm.qty) <= 0) {
      setOrderMsg("Enter a valid quantity"); setOrderStatus("error"); return;
    }
    setOrderStatus("loading"); setOrderMsg("");
    try {
      const res = await fetchWithAuth("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol, market: market.id, type: orderForm.type,
          qty: Number(orderForm.qty), price: price ?? 0,
        }),
      });
      if (!res.ok) throw new Error();
      setOrderStatus("success");
      setOrderMsg(`${orderForm.type} order placed for ${orderForm.qty} shares`);
      setOrderForm(f => ({ ...f, qty: "" }));
      setTimeout(() => setOrderStatus("idle"), 3000);
    } catch {
      setOrderStatus("error"); setOrderMsg("Order failed — try again");
    }
  };

  const price     = live?.price     ?? fallbackPrice;
  const changePct = live?.changePct ?? fallbackChange;
  const isUp      = (changePct ?? 0) >= 0;
  const isLive    = !!live?.price;

  const totalRatings = ratings
    ? ratings.strongBuy + ratings.buy + ratings.hold + ratings.sell + ratings.strongSell : 0;

  const fmtCap = (n: number) => {
    if (n >= 1e12) return `${market.currency}${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `${market.currency}${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6)  return `${market.currency}${(n / 1e6).toFixed(2)}M`;
    return formatPrice(n, 0);
  };

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes ping  { 0%{transform:scale(1);opacity:.75} 100%{transform:scale(2);opacity:0} }
        .order-tab { flex:1; padding:8px; border:none; cursor:pointer; font-size:13px; font-weight:600; border-radius:6px; transition:all .15s; }
      `}</style>

      <button onClick={() => router.back()} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"var(--color-muted)",fontSize:13,marginBottom:20,padding:0 }}>
        <ArrowLeft size={14}/> Back
      </button>

      {error ? (
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,gap:12,color:"var(--color-bear)" }}>
          <AlertCircle size={32}/>
          <p style={{ margin:0,fontSize:16 }}>{error}</p>
          <button onClick={load} style={{ padding:"8px 20px",borderRadius:8,background:"var(--color-primary)",color:"#000",border:"none",cursor:"pointer",fontWeight:600 }}>Retry</button>
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"1fr 300px",gap:20,alignItems:"start" }}>

          {/* LEFT */}
          <div>
            {/* Hero */}
            <div style={{ background:"var(--color-card)",border:"1px solid var(--color-line)",borderRadius:12,padding:"20px 24px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <div>
                {loading ? (
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    <Skeleton w={120} h={28}/><Skeleton w={200}/><Skeleton w={80}/>
                  </div>
                ) : (
                  <>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <h1 style={{ margin:0,fontSize:26,fontWeight:800 }}>{symbol}</h1>
                      <span style={{ padding:"2px 8px",borderRadius:6,fontSize:11,background:"var(--color-line)",color:"var(--color-muted)" }}>{overview?.exchange}</span>
                    </div>
                    <p style={{ margin:"4px 0",color:"var(--color-muted)",fontSize:14 }}>{overview?.name}</p>
                    <p style={{ margin:0,fontSize:12,color:"var(--color-muted)" }}>{overview?.sector} · {overview?.industry}</p>
                  </>
                )}
              </div>
              <div style={{ textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8 }}>
                {loading ? (
                  <><Skeleton w={100} h={32}/><Skeleton w={70}/></>
                ) : price !== null ? (
                  <>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      {isLive && (
                        <span style={{ position:"relative",display:"inline-flex",width:8,height:8 }}>
                          <span style={{ position:"absolute",inset:0,borderRadius:"50%",background:ACCENT,opacity:0.75,animation:"ping 1s cubic-bezier(0,0,0.2,1) infinite" }}/>
                          <span style={{ position:"relative",borderRadius:"50%",width:8,height:8,background:ACCENT,display:"inline-flex" }}/>
                        </span>
                      )}
                      <span style={{ fontSize:28,fontWeight:800 }}>{formatPrice(price)}</span>
                    </div>
                    <span style={{ display:"flex",alignItems:"center",gap:4,fontSize:14,fontWeight:600,color:isUp?"var(--color-bull)":"var(--color-bear)" }}>
                      {isUp?<TrendingUp size={14}/>:<TrendingDown size={14}/>}
                      {isUp?"+":""}{changePct?.toFixed(2)}%
                      {!isLive&&<span style={{ fontSize:10,color:"var(--color-muted)",fontWeight:400,marginLeft:4 }}>delayed</span>}
                    </span>
                  </>
                ) : (
                  <span style={{ color:"var(--color-muted)",fontSize:14 }}>Price unavailable</span>
                )}
                <button onClick={toggleWatchlist} style={{ display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:12,background:watchlisted?"color-mix(in srgb,var(--color-primary) 15%,transparent)":"transparent",border:`1px solid ${watchlisted?"var(--color-primary)":"var(--color-line)"}`,color:watchlisted?"var(--color-primary)":"var(--color-muted)",fontWeight:600 }}>
                  {watchlisted?<Star size={12} fill="currentColor"/>:<StarOff size={12}/>}
                  {watchlisted?"Watchlisted":"Add to Watchlist"}
                </button>
              </div>
            </div>

            {/* Chart */}
            <StockChart key={`${symbol}-${market.id}`} symbol={symbol} currency={market.currency||"$"} marketId={market.id}/>

            {/* Stats */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20 }}>
              {loading ? Array.from({length:8}).map((_,i)=>(
                <div key={i} style={{ background:"var(--color-card)",border:"1px solid var(--color-line)",borderRadius:10,padding:"12px 16px" }}>
                  <Skeleton w="60%" h={11}/><div style={{marginTop:6}}><Skeleton w="80%" h={18}/></div>
                </div>
              )) : overview ? (
                <>
                  <StatCard label="Market Cap" value={fmtCap(overview.marketCap)}/>
                  <StatCard label="P/E Ratio"  value={overview.peRatio?.toFixed(2)??"N/A"}/>
                  <StatCard label="EPS"        value={formatPrice(overview.eps??0)}/>
                  <StatCard label="Div. Yield" value={overview.dividendYield?`${(overview.dividendYield*100).toFixed(2)}%`:"N/A"}/>
                  <StatCard label="52W High"   value={formatPrice(overview.week52High??0)}/>
                  <StatCard label="52W Low"    value={formatPrice(overview.week52Low??0)}/>
                  <StatCard label="Sector"     value={overview.sector??"—"}/>
                  <StatCard label="Exchange"   value={overview.exchange??"—"}/>
                </>
              ) : null}
            </div>

            {/* About */}
            {!loading && overview?.description && (
              <div style={{ background:"var(--color-card)",border:"1px solid var(--color-line)",borderRadius:12,padding:"18px 20px",marginBottom:20 }}>
                <h3 style={{ margin:"0 0 10px",fontSize:14,fontWeight:700 }}>About</h3>
                <p style={{ margin:0,fontSize:13,color:"var(--color-muted)",lineHeight:1.7 }}>{overview.description}</p>
              </div>
            )}

            {/* Analyst Ratings */}
            <div style={{ background:"var(--color-card)",border:"1px solid var(--color-line)",borderRadius:12,padding:"18px 20px",marginBottom:20 }}>
              <h3 style={{ margin:"0 0 14px",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:6 }}>
                <BarChart2 size={15}/> Analyst Ratings
              </h3>
              {loading ? (
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {Array.from({length:5}).map((_,i)=><Skeleton key={i} w="100%" h={10}/>)}
                </div>
              ) : ratings ? (
                <>
                  <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
                    <AnalystBar label="Strong Buy"  count={ratings.strongBuy}  total={totalRatings} color="#22c55e"/>
                    <AnalystBar label="Buy"         count={ratings.buy}        total={totalRatings} color="#86efac"/>
                    <AnalystBar label="Hold"        count={ratings.hold}       total={totalRatings} color="#f59e0b"/>
                    <AnalystBar label="Sell"        count={ratings.sell}       total={totalRatings} color="#fca5a5"/>
                    <AnalystBar label="Strong Sell" count={ratings.strongSell} total={totalRatings} color="#ef4444"/>
                  </div>
                  <p style={{ margin:0,fontSize:13,color:"var(--color-muted)" }}>
                    Consensus target:{" "}
                    <strong style={{ color:"var(--color-primary)" }}>{formatPrice(ratings.targetPrice)}</strong>
                    {price!==null&&<span> ({((ratings.targetPrice-price)/price*100).toFixed(1)}% upside)</span>}
                  </p>
                </>
              ) : (
                <p style={{ margin:0,color:"var(--color-muted)",fontSize:13 }}>No analyst data available</p>
              )}
            </div>

            {/* AI Insights */}
            <div style={{ background:"var(--color-card)",border:"1px solid var(--color-line)",borderRadius:12,padding:"18px 20px" }}>
              <h3 style={{ margin:"0 0 14px",fontSize:14,fontWeight:700 }}>AI Insights</h3>
              {loading ? (
                <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                  {Array.from({length:3}).map((_,i)=>(
                    <div key={i} style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      <Skeleton w="40%" h={12}/><Skeleton w="100%"/><Skeleton w="80%"/>
                    </div>
                  ))}
                </div>
              ) : insights.length===0 ? (
                <p style={{ margin:0,color:"var(--color-muted)",fontSize:13 }}>No insights available</p>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                  {insights.map(ins=>(
                    <div key={ins.id} style={{ padding:"12px 14px",borderRadius:8,border:"1px solid var(--color-line)",borderLeft:`3px solid ${ins.type==="BULLISH"?"#22c55e":ins.type==="BEARISH"?"#ef4444":"#f59e0b"}` }}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                        <span style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",color:ins.type==="BULLISH"?"#22c55e":ins.type==="BEARISH"?"#ef4444":"#f59e0b" }}>{ins.type}</span>
                        <span style={{ fontSize:11,color:"var(--color-muted)" }}>{new Date(ins.publishedAt).toLocaleDateString()}</span>
                      </div>
                      <p style={{ margin:"0 0 4px",fontSize:13,fontWeight:600 }}>{ins.title}</p>
                      <p style={{ margin:0,fontSize:12,color:"var(--color-muted)",lineHeight:1.6 }}>{ins.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Order Panel */}
          <div style={{ position:"sticky",top:80 }}>
            <div style={{ background:"var(--color-card)",border:"1px solid var(--color-line)",borderRadius:12,padding:"20px" }}>
              <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700 }}>Place Order</h3>
              <div style={{ display:"flex",gap:4,background:"var(--color-line)",borderRadius:8,padding:3,marginBottom:16 }}>
                {(["BUY","SELL"] as const).map(t=>(
                  <button key={t} className="order-tab" onClick={()=>setOrderForm(f=>({...f,type:t}))}
                    style={{ background:orderForm.type===t?(t==="BUY"?"var(--color-bull)":"var(--color-bear)"):"transparent",color:orderForm.type===t?"#fff":"var(--color-muted)" }}>
                    {t}
                  </button>
                ))}
              </div>
              <div style={{ padding:"10px 12px",borderRadius:8,marginBottom:14,background:"var(--color-page)",border:"1px solid var(--color-line)",display:"flex",justifyContent:"space-between",fontSize:13 }}>
                <span style={{ color:"var(--color-muted)" }}>Market Price</span>
                <strong>{price!==null?formatPrice(price):"—"}</strong>
              </div>
              <label style={{ fontSize:12,color:"var(--color-muted)",display:"block",marginBottom:6 }}>Quantity (shares)</label>
              <input type="number" min={1} placeholder="0" value={orderForm.qty}
                onChange={e=>setOrderForm(f=>({...f,qty:e.target.value}))}
                style={{ width:"100%",padding:"10px 12px",borderRadius:8,fontSize:14,background:"var(--color-page)",border:"1px solid var(--color-line)",color:"inherit",boxSizing:"border-box",outline:"none",marginBottom:8 }}/>
              {price!==null&&orderForm.qty&&!isNaN(Number(orderForm.qty))&&(
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:14,color:"var(--color-muted)" }}>
                  <span>Estimated Total</span>
                  <strong style={{ color:"inherit" }}>{formatPrice(price*Number(orderForm.qty))}</strong>
                </div>
              )}
              <button onClick={placeOrder} disabled={orderStatus==="loading"} style={{ width:"100%",padding:"11px",borderRadius:8,cursor:"pointer",border:"none",fontWeight:700,fontSize:14,background:orderForm.type==="BUY"?"var(--color-bull)":"var(--color-bear)",color:"#fff",opacity:orderStatus==="loading"?0.6:1 }}>
                {orderStatus==="loading"?"Placing…":`${orderForm.type} ${symbol}`}
              </button>
              {orderMsg&&(
                <p style={{ margin:"10px 0 0",fontSize:12,textAlign:"center",color:orderStatus==="success"?"var(--color-bull)":"var(--color-bear)" }}>{orderMsg}</p>
              )}
              <p style={{ margin:"14px 0 0",fontSize:11,color:"var(--color-muted)",textAlign:"center",lineHeight:1.5 }}>
                Orders execute at market price. Not financial advice.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}