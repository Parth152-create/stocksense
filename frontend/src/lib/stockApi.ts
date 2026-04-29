import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimeRange = "1d" | "5d" | "1mo" | "1y" | "5y";

export interface Candle {
  timestamp: string;
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  exchange: string;
  currency: string;
  source?: string;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  marketCap?: number;
}

// ─── API Base URL ─────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useStockQuote(symbol: string) {
  const [data, setData] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);
      return;
    }

    const fetchQuote = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/stocks/${symbol}`);
        if (!response.ok) {
          throw new Error("Failed to fetch stock quote");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [symbol]);

  return { data, loading, error };
}

export function useHistory(symbol: string, timeRange: TimeRange) {
  const [data, setData] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol || !timeRange) {
      setData([]);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/stocks/${symbol}/history`);
        if (!response.ok) {
          throw new Error("Failed to fetch stock history");
        }
        const result = await response.json();
        
        // Transform the API response to Candle format
        // Assuming the API returns an array of candle data or a nested structure
        const candles = Array.isArray(result) 
          ? result 
          : result.timeSeries || result.candles || [];
        
        setData(candles);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [symbol, timeRange]);

  return { data, loading, error };
}
