
"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { fetchWithAuth } from "@/lib/auth";
import { useLivePrices } from "@/lib/websocket";
import { useMarket } from "@/lib/MarketContext";
import { MLInsightsPanel } from "@/components/MLInsightsPanel";
import { useToast } from "@/components/ToastContext";
import {
  TrendingUp, TrendingDown, ArrowLeft, Star, StarOff,
  BarChart2, AlertCircle, CandlestickChart, LineChart as LineIcon,
  Newspaper, ExternalLink, Activity,
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
interface NewsArticle {
  title: string; description: string; url: string;
  source: string; publishedAt: string; urlToImage: string;
}
interface Candle {
  time: number; open: number; high: number; low: number;
  close: number; volume: number;
}
interface OrderForm {
  type: "BUY" | "SELL";
  kind: "MARKET" | "LIMIT" | "STOP_LOSS";
  qty: string;
  limitPrice?: string;
}

type ChartType = "candle" | "area";
type Range     = "1D" | "1W" | "1M" | "1Y" | "ALL";
const RANGES: Range[] = ["1D", "1W", "1M", "1Y", "ALL"];

const BULL   = "#22c55e";
const BEAR   = "#ef4444";
const ACCENT = "#8FFFD6";
const APPLE  = [0.22, 1, 0.36, 1] as const;

// ── Technical indicator calculations ─────────────────────────────────────────

function calcRSI(closes: number[], period = 14): (number | null)[] {
  if (closes.length < period + 1) return closes.map(() => null);
  const result: (number | null)[] = new Array(period).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) result.push(NaN);
  result.push(ema);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

interface MACDPoint { macd: number | null; signal: number | null; histogram: number | null; }

function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9): MACDPoint[] {
  if (closes.length < slow + signal) return closes.map(() => ({ macd: null, signal: null, histogram: null }));
  const emaFast   = calcEMA(closes, fast);
  const emaSlow   = calcEMA(closes, slow);
  const macdLine  = emaFast.map((f, i) => isNaN(f) || isNaN(emaSlow[i]) ? NaN : f - emaSlow[i]);
  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalEma = calcEMA(validMacd, signal);
  const result: MACDPoint[] = [];
  let sigIdx = 0;
  let validCount = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) {
      result.push({ macd: null, signal: null, histogram: null });
    } else {
      const sigVal = validCount < signal - 1 ? NaN : signalEma[sigIdx++];
      validCount++;
      const m = macdLine[i];
      const s = isNaN(sigVal) ? null : sigVal;
      result.push({ macd: m, signal: s, histogram: s !== null ? m - s : null });
    }
  }
  return result;
}

// ── Indicator chart components ────────────────────────────────────────────────

function RSIChart({ candles, isDark }: { candles: Candle[]; isDark: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const closes = candles.map(c => c.close);
  const rsiValues = calcRSI(closes);
  const valid = rsiValues.filter((v): v is number => v !== null);
  if (valid.length < 2) return (
    <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "var(--color-muted)", fontSize: 11 }}>Not enough data for RSI</span>
    </div>
  );

  const W = 800, H = 80;
  const pad = { l: 48, r: 8, t: 8, b: 18 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const firstValid = rsiValues.findIndex(v => v !== null);
  const plotData = rsiValues.slice(firstValid).filter((v): v is number => v !== null);
  const xStep = innerW / (plotData.length - 1);

  const points = plotData.map((v, i) => {
    const x = pad.l + i * xStep;
    const y = pad.t + innerH - (v / 100) * innerH;
    return `${x},${y}`;
  }).join(" ");

  const ob70y = pad.t + innerH - (70 / 100) * innerH;
  const os30y = pad.t + innerH - (30 / 100) * innerH;
  const mid50y = pad.t + innerH - (50 / 100) * innerH;
  const lastRSI = plotData[plotData.length - 1];
  const rsiColor = lastRSI > 70 ? BEAR : lastRSI < 30 ? BULL : ACCENT;
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#555" : "#9ca3af";

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 80, display: "block" }}>
      {/* Zone fills */}
      <rect x={pad.l} y={pad.t} width={innerW} height={ob70y - pad.t}
        fill={BEAR} fillOpacity={0.04}/>
      <rect x={pad.l} y={os30y} width={innerW} height={pad.t + innerH - os30y}
        fill={BULL} fillOpacity={0.04}/>
      {/* Grid lines */}
      {[30, 50, 70].map(level => {
        const y = pad.t + innerH - (level / 100) * innerH;
        return (
          <g key={level}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y}
              stroke={level === 50 ? gridColor : (level === 70 ? `${BEAR}44` : `${BULL}44`)}
              strokeWidth={level === 50 ? 0.5 : 0.8} strokeDasharray={level === 50 ? "3 3" : "none"}/>
            <text x={pad.l - 4} y={y + 4} fill={textColor} fontSize={9} textAnchor="end">{level}</text>
          </g>
        );
      })}
      {/* RSI line */}
      <polyline points={points} fill="none" stroke={rsiColor} strokeWidth={1.5} strokeLinejoin="round"/>
      {/* Current value label */}
      <text x={W - pad.r - 2} y={pad.t + 10} fill={rsiColor} fontSize={10} textAnchor="end" fontWeight={700}>
        {lastRSI.toFixed(1)}
      </text>
    </svg>
  );
}

function MACDChart({ candles, isDark }: { candles: Candle[]; isDark: boolean }) {
  const closes = candles.map(c => c.close);
  const macdData = calcMACD(closes);
  const valid = macdData.filter(d => d.macd !== null && d.histogram !== null);
  if (valid.length < 2) return (
    <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "var(--color-muted)", fontSize: 11 }}>Not enough data for MACD</span>
    </div>
  );

  const W = 800, H = 80;
  const pad = { l: 48, r: 8, t: 8, b: 18 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const firstValid = macdData.findIndex(d => d.macd !== null);
  const plotData = macdData.slice(firstValid);
  const histValues = plotData.map(d => d.histogram ?? 0);
  const macdValues = plotData.map(d => d.macd ?? 0);
  const sigValues  = plotData.map(d => d.signal ?? 0);
  const allVals = [...histValues, ...macdValues, ...sigValues];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const toY = (v: number) => pad.t + innerH - ((v - minV) / range) * innerH;
  const zero = toY(0);
  const xStep = innerW / (plotData.length - 1);
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#555" : "#9ca3af";

  const macdPoints = plotData.map((d, i) =>
    d.macd !== null ? `${pad.l + i * xStep},${toY(d.macd)}` : null
  ).filter(Boolean).join(" ");

  const sigPoints = plotData.map((d, i) =>
    d.signal !== null ? `${pad.l + i * xStep},${toY(d.signal)}` : null
  ).filter(Boolean).join(" ");

  const lastMacd = plotData[plotData.length - 1];
  const crossover = lastMacd.macd !== null && lastMacd.signal !== null
    ? lastMacd.macd > lastMacd.signal : false;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 80, display: "block" }}>
      {/* Zero line */}
      <line x1={pad.l} y1={zero} x2={W - pad.r} y2={zero}
        stroke={gridColor} strokeWidth={0.8} strokeDasharray="3 3"/>
      <text x={pad.l - 4} y={zero + 4} fill={textColor} fontSize={9} textAnchor="end">0</text>

      {/* Histogram bars */}
      {plotData.map((d, i) => {
        if (d.histogram === null) return null;
        const x    = pad.l + i * xStep;
        const barW = Math.max(xStep * 0.6, 1);
        const y    = d.histogram >= 0 ? toY(d.histogram) : zero;
        const h    = Math.abs(toY(d.histogram) - zero);
        return (
          <rect key={i} x={x - barW / 2} y={y} width={barW} height={Math.max(h, 0.5)}
            fill={d.histogram >= 0 ? `${BULL}88` : `${BEAR}88`}/>
        );
      })}

      {/* MACD line */}
      {macdPoints && <polyline points={macdPoints} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeLinejoin="round"/>}
      {/* Signal line */}
      {sigPoints  && <polyline points={sigPoints}  fill="none" stroke="#f59e0b" strokeWidth={1.2} strokeLinejoin="round" strokeDasharray="4 2"/>}

      {/* Legend */}
      <g>
        <circle cx={W - pad.r - 80} cy={pad.t + 8} r={3} fill={ACCENT}/>
        <text x={W - pad.r - 74} y={pad.t + 12} fill={textColor} fontSize={9}>MACD</text>
        <circle cx={W - pad.r - 38} cy={pad.t + 8} r={3} fill="#f59e0b"/>
        <text x={W - pad.r - 32} y={pad.t + 12} fill={textColor} fontSize={9}>Signal</text>
      </g>

      {/* Crossover badge */}
      {lastMacd.macd !== null && (
        <text x={W - pad.r - 2} y={pad.t + 10}
          fill={crossover ? BULL : BEAR} fontSize={10} textAnchor="end" fontWeight={700}>
          {crossover ? "▲ Bullish" : "▼ Bearish"}
        </text>
      )}
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanSymbol(raw: string): string {
  return raw
    .replace(/\.NS$/i, "").replace(/\.BO$/i, "")
    .replace(/\.BSE$/i, "").replace(/\.NSE$/i, "")
    .replace(/=X$/i, "").trim().toUpperCase();
}

const VALID_MARKETS = ["US", "IN", "CRYPTO", "FX"] as const;
type MarketId = typeof VALID_MARKETS[number];
function isValidMarket(m: string): m is MarketId {
  return (VALID_MARKETS as readonly string[]).includes(m);
}

function Skeleton({ w, h = 16 }: { w: string | number; h?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 4, background: "var(--color-line)",
      animation: "pulse 1.5s ease-in-out infinite" }}/>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <motion.div whileHover={{ y: -2, transition: { duration: 0.15 } }}
      style={{ background: "var(--color-card)", border: "1px solid var(--color-line)",
        borderRadius: 10, padding: "12px 16px" }}>
      <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700 }}>{value}</p>
    </motion.div>
  );
}

function AnalystBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 72, color: "var(--color-muted)", fontSize: 12 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "var(--color-line)", borderRadius: 3, overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: APPLE, delay: 0.1 }}
          style={{ height: "100%", background: color, borderRadius: 3 }}/>
      </div>
      <span style={{ width: 20, textAlign: "right", fontWeight: 600, fontSize: 13 }}>{count}</span>
    </div>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  const timeAgo = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const h = Math.floor(diff / 3600000);
      if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
      if (h < 24) return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    } catch { return ""; }
  };
  return (
    <a href={article.url !== "#" ? article.url : undefined}
      target="_blank" rel="noopener noreferrer"
      style={{ display: "block", textDecoration: "none", color: "inherit",
        padding: "14px 16px", borderRadius: 10, border: "1px solid var(--color-line)",
        background: "var(--color-page)", transition: "border-color 0.2s, background 0.2s",
        cursor: article.url !== "#" ? "pointer" : "default" }}
      onMouseEnter={e => { if (article.url !== "#") {
        (e.currentTarget as HTMLElement).style.borderColor = ACCENT + "66";
        (e.currentTarget as HTMLElement).style.background  = "var(--color-surface-hover)";
      }}}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)";
        (e.currentTarget as HTMLElement).style.background  = "var(--color-page)";
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: "var(--color-primary)" }}>{article.title}</p>
          {article.description && (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--color-muted)", lineHeight: 1.5,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{article.description}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>{article.source}</span>
            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>·</span>
            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{timeAgo(article.publishedAt)}</span>
          </div>
        </div>
        {article.urlToImage && (
          <img src={article.urlToImage} alt=""
            style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 7, flexShrink: 0 }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}/>
        )}
      </div>
      {article.url !== "#" && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, color: "var(--color-muted)", fontSize: 11 }}>
          <ExternalLink size={10}/> Read full article
        </div>
      )}
    </a>
  );
}

// ── Indicator toggle button ───────────────────────────────────────────────────

function IndicatorBtn({ label, active, color, onClick }: {
  label: string; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
        fontSize: 11, fontWeight: 600, transition: "all 0.15s",
        background: active ? `${color}18` : "var(--color-page)",
        color:      active ? color : "var(--color-muted)",
        outline:    active ? `1px solid ${color}44` : "1px solid var(--color-line)",
      }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? color : "var(--color-muted)", flexShrink: 0 }}/>
      {label}
    </motion.button>
  );
}

// ── StockChart ────────────────────────────────────────────────────────────────

function StockChart({ symbol, currency, marketId }: {
  symbol: string; currency: string; marketId: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);

  const [chartType,  setChartType]  = useState<ChartType>("candle");
  const [range,      setRange]      = useState<Range>("1M");
  const [candles,    setCandles]    = useState<Candle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [hoverInfo,  setHoverInfo]  = useState<{ price: string; change: string; time: string; isUp: boolean } | null>(null);

  // ── Indicator toggles ──────────────────────────────────────────────────────
  const [showRSI,  setShowRSI]  = useState(false);
  const [showMACD, setShowMACD] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/stocks/${symbol}/history?range=${range}&market=${marketId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Candle[]) => setCandles(Array.isArray(data) ? data : []))
      .catch(() => setCandles([]))
      .finally(() => setLoading(false));
  }, [symbol, range, marketId]);

  useEffect(() => {
    if (!containerRef.current || loading) return;

    const build = () => {
      const LWC = (window as any).LightweightCharts;
      if (!LWC) return;

      const bgColor    = isDark ? "#0d0d0d" : "#ffffff";
      const gridColor  = isDark ? "#1c1c1c" : "#f3f4f6";
      const textColor  = isDark ? "#6b7280" : "#9ca3af";
      const borderCol  = isDark ? "#222222" : "#e5e7eb";
      const crossColor = isDark ? "#333333" : "#d1d5db";

      if (chartRef.current) {
        try { chartRef.current.remove(); } catch { }
        chartRef.current = null;
      }

      const chart = LWC.createChart(containerRef.current, {
        width:  containerRef.current!.clientWidth,
        height: 340,
        layout: { background: { type: "solid", color: bgColor }, textColor,
          fontFamily: "var(--font-gantari,'Gantari','Inter',sans-serif)", fontSize: 11 },
        grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
        crosshair: { mode: 1,
          vertLine: { color: crossColor, width: 1, style: 2 },
          horzLine: { color: crossColor, width: 1, style: 2 } },
        rightPriceScale: { borderColor: borderCol, scaleMargins: { top: 0.1, bottom: 0.22 } },
        timeScale: { borderColor: borderCol, timeVisible: range === "1D",
          secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale:  { mouseWheel: true, pinch: true },
      });

      chartRef.current = chart;
      let priceSeries: any;

      if (chartType === "candle" && candles.length > 0) {
        priceSeries = chart.addCandlestickSeries({
          upColor: BULL, downColor: BEAR, borderUpColor: BULL, borderDownColor: BEAR,
          wickUpColor: BULL, wickDownColor: BEAR,
        });
        priceSeries.setData(candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
      } else {
        const first = candles[0]?.close ?? 0, last = candles[candles.length - 1]?.close ?? 0;
        const lineColor = last >= first ? ACCENT : BEAR;
        priceSeries = chart.addAreaSeries({
          lineColor, topColor: lineColor + "33", bottomColor: lineColor + "05",
          lineWidth: 2, crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
        });
        priceSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
      }

      if (candles.length > 0) {
        const volSeries = chart.addHistogramSeries({
          priceFormat: { type: "volume" }, priceScaleId: "vol",
          scaleMargins: { top: 0.82, bottom: 0 },
        });
        volSeries.setData(candles.map(c => ({
          time: c.time, value: c.volume,
          color: c.close >= c.open ? BULL + "55" : BEAR + "55",
        })));
      }

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
          time:   timeStr, isUp,
        });
      });

      const ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current)
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      });
      if (containerRef.current) ro.observe(containerRef.current);
      chart.timeScale().fitContent();
      return () => ro.disconnect();
    };

    if ((window as any).LightweightCharts) {
      build();
    } else {
      const existing = document.querySelector('script[data-lwc="1"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js";
        script.setAttribute("data-lwc", "1");
        script.onload = () => build();
        document.head.appendChild(script);
      } else {
        const poll = setInterval(() => {
          if ((window as any).LightweightCharts) { clearInterval(poll); build(); }
        }, 50);
      }
    }

    return () => {
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch { }
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
    <div style={{ background: isDark ? "#0d0d0d" : "#ffffff",
      border: "1px solid var(--color-line)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>

      {/* Chart toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderBottom: "1px solid var(--color-line)",
        background: "var(--color-card)", flexWrap: "wrap", gap: 8 }}>
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
          {/* Indicator toggles */}
          <div style={{ display: "flex", gap: 4 }}>
            <IndicatorBtn label="RSI" active={showRSI} color="#a855f7" onClick={() => setShowRSI(v => !v)}/>
            <IndicatorBtn label="MACD" active={showMACD} color="#f59e0b" onClick={() => setShowMACD(v => !v)}/>
          </div>
          {/* Chart type */}
          <div style={{ display: "flex", background: "var(--color-page)",
            border: "1px solid var(--color-line)", borderRadius: 8, padding: 3, gap: 2 }}>
            {([
              { type: "candle" as ChartType, icon: <CandlestickChart size={13}/> },
              { type: "area"   as ChartType, icon: <LineIcon size={13}/> },
            ]).map(({ type, icon }) => (
              <button key={type} onClick={() => setChartType(type)} style={{
                display: "flex", alignItems: "center", padding: "5px 10px",
                borderRadius: 6, border: "none", cursor: "pointer",
                background: chartType === type ? "var(--color-card)" : "transparent",
                color:      chartType === type ? ACCENT : "var(--color-muted)", transition: "all 0.15s" }}>
                {icon}
              </button>
            ))}
          </div>
          {/* Range */}
          <div style={{ display: "flex", background: "var(--color-page)",
            border: "1px solid var(--color-line)", borderRadius: 8, padding: 3, gap: 2 }}>
            {RANGES.map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600,
                background: range === r ? "var(--color-card)" : "transparent",
                color:      range === r ? ACCENT : "var(--color-muted)", transition: "all 0.15s" }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Price chart */}
      <div style={{ position: "relative" }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10,
            background: isDark ? "#0d0d0d" : "#ffffff",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%",
              border: "2px solid var(--color-line)", borderTop: `2px solid ${ACCENT}`,
              animation: "spin 0.8s linear infinite" }}/>
            <span style={{ color: "var(--color-muted)", fontSize: 12 }}>Loading chart…</span>
          </div>
        )}
        <div ref={containerRef} style={{ height: 340, width: "100%", background: isDark ? "#0d0d0d" : "#ffffff" }}/>
      </div>

      {/* ── RSI panel ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showRSI && candles.length > 0 && (
          <motion.div
            key="rsi"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}>
            <div style={{ borderTop: `1px solid var(--color-line)`,
              background: isDark ? "#0a0a0a" : "#fafafa" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 18px 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={11} color="#a855f7"/>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#a855f7", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    RSI (14)
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 9, color: "var(--color-muted)" }}>
                  <span style={{ color: `${BEAR}99` }}>Overbought ≥ 70</span>
                  <span style={{ color: `${BULL}99` }}>Oversold ≤ 30</span>
                </div>
              </div>
              <div style={{ padding: "0 0 4px" }}>
                <RSIChart candles={candles} isDark={isDark}/>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MACD panel ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showMACD && candles.length > 0 && (
          <motion.div
            key="macd"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}>
            <div style={{ overflow: "hidden", borderTop: `1px solid var(--color-line)`,
              background: isDark ? "#0a0a0a" : "#fafafa" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 18px 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={11} color="#f59e0b"/>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    MACD (12, 26, 9)
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 9, color: "var(--color-muted)" }}>
                  <span>
                    <span style={{ color: ACCENT }}>━</span> MACD &nbsp;
                    <span style={{ color: "#f59e0b" }}>╌</span> Signal &nbsp;
                    <span style={{ color: BULL }}>▌</span>/<span style={{ color: BEAR }}>▌</span> Histogram
                  </span>
                </div>
              </div>
              <div style={{ padding: "0 0 4px" }}>
                <MACDChart candles={candles} isDark={isDark}/>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div style={{ padding: "8px 18px", borderTop: "1px solid var(--color-line)",
        background: "var(--color-card)", display: "flex", justifyContent: "space-between" }}>
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

// ── Inner page ────────────────────────────────────────────────────────────────

function StockPageInner() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const symbol = cleanSymbol((params?.symbol as string) ?? "");
  const { market, formatPrice } = useMarket();
  const searchParams      = useSearchParams();
  const marketFromUrl     = (searchParams.get("market") ?? "").toUpperCase();
  const effectiveMarketId = isValidMarket(marketFromUrl) ? marketFromUrl : market.id;

  const [overview,       setOverview]       = useState<StockOverview | null>(null);
  const [ratings,        setRatings]        = useState<AnalystRating | null>(null);
  const [insights,       setInsights]       = useState<Insight[]>([]);
  const [news,           setNews]           = useState<NewsArticle[]>([]);
  const [newsLoading,    setNewsLoading]    = useState(true);
  const [watchlisted,    setWatchlisted]    = useState(false);
  const [fallbackPrice,  setFallbackPrice]  = useState<number | null>(null);
  const [fallbackChange, setFallbackChange] = useState<number | null>(null);
  const [orderForm,      setOrderForm]      = useState<OrderForm>({ type: "BUY", kind: "MARKET", qty: "" });
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const prices = useLivePrices([symbol]);
  const live   = prices[symbol];

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [ovRes, ratRes, insRes, wlRes, quoteRes] = await Promise.all([
        fetchWithAuth(`/api/stocks/${symbol}/overview?market=${effectiveMarketId}`),
        fetchWithAuth(`/api/stocks/${symbol}/ratings?market=${effectiveMarketId}`),
        fetchWithAuth(`/api/stocks/${symbol}/insights?market=${effectiveMarketId}`),
        fetchWithAuth(`/api/watchlist`),
        fetchWithAuth(`/api/stocks/${symbol}?market=${effectiveMarketId}`),
      ]);
      if (!ovRes.ok) throw new Error(`Symbol not found: ${symbol}`);
      setOverview(await ovRes.json());
      if (ratRes.ok)   setRatings(await ratRes.json());
      if (insRes.ok)   setInsights(await insRes.json());
      if (quoteRes.ok) {
        const q = await quoteRes.json();
        if (q.price > 0)               setFallbackPrice(q.price);
        if (q.changePct !== undefined)  setFallbackChange(q.changePct);
        if (q.changePercent !== undefined) setFallbackChange(q.changePercent);
      }
      if (wlRes.ok) {
        const wl: { symbol: string }[] = await wlRes.json();
        setWatchlisted(wl.some(w => w.symbol === symbol || cleanSymbol(w.symbol) === symbol));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, [symbol, effectiveMarketId]);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetchWithAuth(`/api/stocks/${symbol}/news`);
      if (res.ok) { const data: NewsArticle[] = await res.json(); setNews(Array.isArray(data) ? data : []); }
    } catch { } finally { setNewsLoading(false); }
  }, [symbol]);

  useEffect(() => { void load(); void loadNews(); }, [load, loadNews]);

  const toggleWatchlist = async () => {
    const method = watchlisted ? "DELETE" : "POST";
    const res    = await fetchWithAuth(`/api/watchlist/${symbol}`, { method });
    if (res.ok) {
      setWatchlisted(w => !w);
      toast(watchlisted ? `${symbol} removed from watchlist` : `${symbol} added to watchlist`,
            watchlisted ? "info" : "success");
    }
  };

  const placeOrder = async () => {
    if (!orderForm.qty || isNaN(Number(orderForm.qty)) || Number(orderForm.qty) <= 0) {
      toast("Enter a valid quantity", "error"); return;
    }
    if (orderForm.kind !== "MARKET") {
      if (!orderForm.limitPrice || isNaN(Number(orderForm.limitPrice)) || Number(orderForm.limitPrice) <= 0) {
        toast("Enter a valid limit price", "error"); return;
      }
    }
    setIsPlacingOrder(true);
    try {
      const res = await fetchWithAuth("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol, market: effectiveMarketId, type: orderForm.type, kind: orderForm.kind,
          qty: Number(orderForm.qty), price: price ?? 0,
          ...(orderForm.kind !== "MARKET" && orderForm.limitPrice
            ? { limitPrice: Number(orderForm.limitPrice) } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Order failed");
      }
      const msg = orderForm.kind === "MARKET"
        ? `${orderForm.type} order placed — ${orderForm.qty} shares of ${symbol}`
        : `${orderForm.kind === "STOP_LOSS" ? "Stop" : "Limit"} ${orderForm.type} set at ${formatPrice(Number(orderForm.limitPrice))}`;
      toast(msg, "success");
      setOrderForm(f => ({ ...f, qty: "", limitPrice: "" }));
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Order failed — try again", "error");
    } finally { setIsPlacingOrder(false); }
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

  const cardStyle: React.CSSProperties = {
    background: "var(--color-card)", border: "1px solid var(--color-line)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    borderRadius: 12, padding: "18px 20px", marginBottom: 20,
  };

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes ping     { 0%{transform:scale(1);opacity:.75} 100%{transform:scale(2);opacity:0} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .order-tab { flex:1; padding:8px; border:none; cursor:pointer; font-size:13px; font-weight:600; border-radius:6px; transition:all .15s; }
        .kind-tab  { flex:1; padding:6px 4px; border:none; cursor:pointer; font-size:11px; font-weight:600; border-radius:6px; transition:all .15s; }
      `}</style>

      <motion.button onClick={() => router.back()} whileHover={{ x: -2 }}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
          cursor: "pointer", color: "var(--color-muted)", fontSize: 13, marginBottom: 20, padding: 0 }}>
        <ArrowLeft size={14}/> Back
      </motion.button>

      {error ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12, color: "var(--color-bear)" }}>
          <AlertCircle size={32}/>
          <p style={{ margin: 0, fontSize: 16 }}>{error}</p>
          <button onClick={load} style={{ padding: "8px 20px", borderRadius: 8, background: "var(--color-primary)", color: "#000", border: "none", cursor: "pointer", fontWeight: 600 }}>Retry</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

          {/* ── LEFT ── */}
          <div>
            {/* Hero */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: APPLE }}
              style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                {loading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Skeleton w={120} h={28}/><Skeleton w={200}/><Skeleton w={80}/>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{symbol}</h1>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11,
                        background: "var(--color-line)", color: "var(--color-muted)" }}>{overview?.exchange}</span>
                    </div>
                    <p style={{ margin: "4px 0", color: "var(--color-muted)", fontSize: 14 }}>{overview?.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-muted)" }}>{overview?.sector} · {overview?.industry}</p>
                  </>
                )}
              </div>
              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                {loading ? (
                  <><Skeleton w={100} h={32}/><Skeleton w={70}/></>
                ) : price !== null ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isLive && (
                        <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
                          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ACCENT, opacity: 0.75, animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite" }}/>
                          <span style={{ position: "relative", borderRadius: "50%", width: 8, height: 8, background: ACCENT, display: "inline-flex" }}/>
                        </span>
                      )}
                      <span style={{ fontSize: 28, fontWeight: 800 }}>{formatPrice(price)}</span>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 600, color: isUp ? BULL : BEAR }}>
                      {isUp ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                      {isUp ? "+" : ""}{changePct?.toFixed(2)}%
                      {!isLive && <span style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 400, marginLeft: 4 }}>delayed</span>}
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--color-muted)", fontSize: 14 }}>Price unavailable</span>
                )}
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={toggleWatchlist}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
                    cursor: "pointer", fontSize: 12,
                    background: watchlisted ? "color-mix(in srgb,var(--color-primary) 15%,transparent)" : "transparent",
                    border: `1px solid ${watchlisted ? "var(--color-primary)" : "var(--color-line)"}`,
                    color: watchlisted ? "var(--color-primary)" : "var(--color-muted)", fontWeight: 600 }}>
                  {watchlisted ? <Star size={12} fill="currentColor"/> : <StarOff size={12}/>}
                  {watchlisted ? "Watchlisted" : "Add to Watchlist"}
                </motion.button>
              </div>
            </motion.div>

            {/* Chart with indicators */}
            <StockChart
              key={`${symbol}-${effectiveMarketId}`}
              symbol={symbol}
              currency={market.currency || "$"}
              marketId={effectiveMarketId}
            />

            {/* Stats */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4, ease: APPLE }}
              style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
              {loading ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 10, padding: "12px 16px" }}>
                  <Skeleton w="60%" h={11}/><div style={{ marginTop: 6 }}><Skeleton w="80%" h={18}/></div>
                </div>
              )) : overview ? (
                <>
                  <StatCard label="Market Cap"  value={fmtCap(overview.marketCap)}/>
                  <StatCard label="P/E Ratio"   value={overview.peRatio?.toFixed(2) ?? "N/A"}/>
                  <StatCard label="EPS"         value={formatPrice(overview.eps ?? 0)}/>
                  <StatCard label="Div. Yield"  value={overview.dividendYield ? `${(overview.dividendYield * 100).toFixed(2)}%` : "N/A"}/>
                  <StatCard label="52W High"    value={formatPrice(overview.week52High ?? 0)}/>
                  <StatCard label="52W Low"     value={formatPrice(overview.week52Low ?? 0)}/>
                  <StatCard label="Sector"      value={overview.sector ?? "—"}/>
                  <StatCard label="Exchange"    value={overview.exchange ?? "—"}/>
                </>
              ) : null}
            </motion.div>

            {/* About */}
            {!loading && overview?.description && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease: APPLE }} whileHover={{ y: -1 }}
                style={cardStyle}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>About</h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)", lineHeight: 1.7 }}>{overview.description}</p>
              </motion.div>
            )}

            {/* Analyst Ratings */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4, ease: APPLE }} whileHover={{ y: -1 }}
              style={cardStyle}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <BarChart2 size={15}/> Analyst Ratings
              </h3>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} w="100%" h={10}/>)}
                </div>
              ) : ratings ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    <AnalystBar label="Strong Buy"  count={ratings.strongBuy}  total={totalRatings} color="#22c55e"/>
                    <AnalystBar label="Buy"         count={ratings.buy}        total={totalRatings} color="#86efac"/>
                    <AnalystBar label="Hold"        count={ratings.hold}       total={totalRatings} color="#f59e0b"/>
                    <AnalystBar label="Sell"        count={ratings.sell}       total={totalRatings} color="#fca5a5"/>
                    <AnalystBar label="Strong Sell" count={ratings.strongSell} total={totalRatings} color="#ef4444"/>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>
                    Consensus target:{" "}
                    <strong style={{ color: "var(--color-primary)" }}>{formatPrice(ratings.targetPrice)}</strong>
                    {price !== null && <span> ({((ratings.targetPrice - price) / price * 100).toFixed(1)}% upside)</span>}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>No analyst data available</p>
              )}
            </motion.div>

            {/* AI Insights */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4, ease: APPLE }} whileHover={{ y: -1 }}
              style={cardStyle}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>AI Insights</h3>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Skeleton w="40%" h={12}/><Skeleton w="100%"/><Skeleton w="80%"/>
                    </div>
                  ))}
                </div>
              ) : insights.length === 0 ? (
                <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>No insights available</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {insights.map(ins => (
                    <motion.div key={ins.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, ease: APPLE }}
                      style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-line)",
                        borderLeft: `3px solid ${ins.type === "BULLISH" ? "#22c55e" : ins.type === "BEARISH" ? "#ef4444" : "#f59e0b"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                          color: ins.type === "BULLISH" ? "#22c55e" : ins.type === "BEARISH" ? "#ef4444" : "#f59e0b" }}>{ins.type}</span>
                        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{new Date(ins.publishedAt).toLocaleDateString()}</span>
                      </div>
                      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>{ins.title}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6 }}>{ins.body}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* News */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4, ease: APPLE }} whileHover={{ y: -1 }}
              style={cardStyle}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <Newspaper size={15} color={ACCENT}/> Latest News
              </h3>
              {newsLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid var(--color-line)" }}>
                      <Skeleton w="80%" h={13}/><div style={{ marginTop: 8 }}><Skeleton w="100%" h={11}/></div>
                      <div style={{ marginTop: 6 }}><Skeleton w="40%" h={11}/></div>
                    </div>
                  ))}
                </div>
              ) : news.length === 0 ? (
                <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>No recent news found.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {news.map((article, i) => (
                    <div key={i} style={{ animation: `fadeInUp 0.3s ease ${i * 0.05}s both` }}>
                      <NewsCard article={article}/>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── RIGHT ── */}
          <div style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 12 }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4, ease: APPLE }} whileHover={{ y: -1 }}
              style={{ ...cardStyle, marginBottom: 0 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Place Order</h3>

              <div style={{ display: "flex", gap: 4, background: "var(--color-line)", borderRadius: 8, padding: 3, marginBottom: 10 }}>
                {(["BUY", "SELL"] as const).map(t => (
                  <button key={t} className="order-tab" onClick={() => setOrderForm(f => ({ ...f, type: t }))}
                    style={{ background: orderForm.type === t ? (t === "BUY" ? BULL : BEAR) : "transparent",
                      color: orderForm.type === t ? "#fff" : "var(--color-muted)" }}>
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 4, background: "var(--color-line)", borderRadius: 8, padding: 3, marginBottom: 14 }}>
                {(["MARKET", "LIMIT", "STOP_LOSS"] as const).map(k => (
                  <button key={k} className="kind-tab" onClick={() => setOrderForm(f => ({ ...f, kind: k, limitPrice: "" }))}
                    style={{ background: orderForm.kind === k ? "var(--color-card)" : "transparent",
                      color: orderForm.kind === k ? ACCENT : "var(--color-muted)" }}>
                    {k === "STOP_LOSS" ? "STOP" : k}
                  </button>
                ))}
              </div>

              <div style={{ padding: "10px 12px", borderRadius: 8, marginBottom: 14,
                background: "var(--color-page)", border: "1px solid var(--color-line)",
                display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--color-muted)" }}>Market Price</span>
                <strong>{price !== null ? formatPrice(price) : "—"}</strong>
              </div>

              {orderForm.kind !== "MARKET" && (
                <>
                  <label style={{ fontSize: 12, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                    {orderForm.kind === "LIMIT" ? "Limit Price" : "Stop Price"}
                  </label>
                  <input type="number" min={0} step="0.01"
                    placeholder={price ? price.toFixed(2) : "0.00"}
                    value={orderForm.limitPrice ?? ""}
                    onChange={e => setOrderForm(f => ({ ...f, limitPrice: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
                      background: "var(--color-page)", border: `1px solid ${ACCENT}55`,
                      color: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 6, fontFamily: "inherit" }}/>
                  <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--color-muted)", lineHeight: 1.5 }}>
                    {orderForm.kind === "LIMIT"
                      ? orderForm.type === "BUY" ? "Executes when price drops to or below this value." : "Executes when price rises to or above this value."
                      : orderForm.type === "BUY" ? "Executes when price rises to or above this value." : "Executes when price drops to or below this value."}
                  </p>
                </>
              )}

              <label style={{ fontSize: 12, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>Quantity (shares)</label>
              <input type="number" min={1} placeholder="0" value={orderForm.qty}
                onChange={e => setOrderForm(f => ({ ...f, qty: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
                  background: "var(--color-page)", border: "1px solid var(--color-line)",
                  color: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 8, fontFamily: "inherit" }}/>

              {price !== null && orderForm.qty && !isNaN(Number(orderForm.qty)) && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 14, color: "var(--color-muted)" }}>
                  <span>Estimated Total</span>
                  <strong style={{ color: "inherit" }}>{formatPrice(price * Number(orderForm.qty))}</strong>
                </div>
              )}

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={placeOrder} disabled={isPlacingOrder}
                style={{ width: "100%", padding: "11px", borderRadius: 8, cursor: "pointer",
                  border: "none", fontWeight: 700, fontSize: 14,
                  background: orderForm.type === "BUY" ? BULL : BEAR, color: "#fff",
                  opacity: isPlacingOrder ? 0.6 : 1, fontFamily: "inherit" }}>
                {isPlacingOrder
                  ? "Placing…"
                  : orderForm.kind === "MARKET"
                    ? `${orderForm.type} ${symbol}`
                    : `Place ${orderForm.kind === "STOP_LOSS" ? "Stop" : "Limit"} ${orderForm.type}`}
              </motion.button>

              <p style={{ margin: "14px 0 0", fontSize: 11, color: "var(--color-muted)", textAlign: "center", lineHeight: 1.5 }}>
                {orderForm.kind === "MARKET"
                  ? "Orders execute at market price. Not financial advice."
                  : "Pending orders are checked every minute against live prices."}
              </p>
            </motion.div>

            <MLInsightsPanel symbol={symbol}/>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: "32px 28px", display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #1f1f1f", borderTop: "2px solid #8FFFD6", animation: "spin 0.8s linear infinite" }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <StockPageInner/>
    </Suspense>
  );
}
