"use client";

import { useEffect, useRef, useCallback } from "react";

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  candles: Candle[];
  type: "area" | "candlestick";
}

export default function TradingViewChart({ candles, type }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);

  const buildChart = useCallback(async () => {
    if (!containerRef.current || candles.length === 0) return;

    const LW = await import("lightweight-charts");

    // Destroy previous instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const el = containerRef.current;

    const chart = LW.createChart(el, {
      width:  el.clientWidth,
      height: 340,
      layout: {
        background: { type: LW.ColorType.Solid, color: "#111111" },
        textColor:  "#555",
        fontSize:   11,
        fontFamily: "'Geist', 'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      crosshair: {
        mode: LW.CrosshairMode.Normal,
        vertLine: { color: "#333", labelBackgroundColor: "#1f1f1f" },
        horzLine: { color: "#333", labelBackgroundColor: "#1f1f1f" },
      },
      rightPriceScale: {
        borderColor:  "#1f1f1f",
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor:    "#1f1f1f",
        timeVisible:    true,
        secondsVisible: false,
        fixLeftEdge:    true,
        fixRightEdge:   true,
      },
    });

    chartRef.current = chart;

    // ── Volume histogram ─────────────────────────────────────────────────────
    const volSeries = chart.addSeries(LW.HistogramSeries, {
      priceFormat:  { type: "volume" },
      priceScaleId: "vol",
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volSeries.setData(
      candles.map(c => ({
        time:  c.date as any,
        value: c.volume,
        color: c.close >= c.open ? "rgba(143,255,214,0.25)" : "rgba(239,68,68,0.2)",
      }))
    );

    // ── Price series ─────────────────────────────────────────────────────────
    if (type === "candlestick") {
      const cs = chart.addSeries(LW.CandlestickSeries, {
        upColor:         "#8FFFD6",
        downColor:       "#ef4444",
        borderUpColor:   "#8FFFD6",
        borderDownColor: "#ef4444",
        wickUpColor:     "#8FFFD6",
        wickDownColor:   "#ef4444",
      });
      cs.setData(
        candles.map(c => ({
          time:  c.date as any,
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        }))
      );
    } else {
      const area = chart.addSeries(LW.AreaSeries, {
        lineColor:   "#8FFFD6",
        topColor:    "rgba(143,255,214,0.18)",
        bottomColor: "rgba(143,255,214,0.01)",
        lineWidth:   2,
        crosshairMarkerVisible:         true,
        crosshairMarkerRadius:          4,
        crosshairMarkerBackgroundColor: "#8FFFD6",
      });
      area.setData(
        candles.map(c => ({ time: c.date as any, value: c.close }))
      );
    }

    chart.timeScale().fitContent();

    // Responsive resize
    const ro = new ResizeObserver(entries => {
      if (chartRef.current && entries[0]) {
        chartRef.current.applyOptions({ width: entries[0].contentRect.width });
      }
    });
    ro.observe(el);
    (chart as any)._ro = ro;
  }, [candles, type]);

  useEffect(() => {
    buildChart();
    return () => {
      if (chartRef.current) {
        (chartRef.current as any)._ro?.disconnect();
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 340, borderRadius: 8, overflow: "hidden" }}
    />
  );
}