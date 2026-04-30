"use client";

import { useState, useEffect } from "react";

export type MarketId = "IN" | "US" | "CRYPTO" | "FX";

export interface Market {
  id: MarketId;
  label: string;
  currency: string;
  flag: string;
}

export const MARKETS: Market[] = [
  { id: "IN",     label: "India",  currency: "₹", flag: "🇮🇳" },
  { id: "US",     label: "USA",    currency: "$", flag: "🇺🇸" },
  { id: "CRYPTO", label: "Crypto", currency: "$", flag: "₿"  },
  { id: "FX",     label: "Forex",  currency: "$", flag: "💱" },
];

const STORAGE_KEY = "stocksense-market";

/**
 * useMarket — reads and writes the selected market from localStorage
 * so it persists across pages and page reloads.
 *
 * Usage:
 *   const { market, setMarket } = useMarket();
 *   market.currency  // "₹" or "$"
 *   market.id        // "IN" | "US" | "CRYPTO" | "FX"
 *   setMarket("IN")  // switches market everywhere
 */
export function useMarket() {
  const [marketId, setMarketId] = useState<MarketId>("US");

  // On mount: read saved market from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as MarketId | null;
      if (saved && MARKETS.find((m) => m.id === saved)) {
        setMarketId(saved);
      }
    } catch {
      // localStorage not available (SSR)
    }
  }, []);

  // Listen for market changes from other components on the same page
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setMarketId(e.newValue as MarketId);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setMarket = (id: MarketId) => {
    setMarketId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
      // Dispatch storage event so other useMarket instances on the page update
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: id }));
    } catch {}
  };

  const market = MARKETS.find((m) => m.id === marketId) ?? MARKETS[0];

  return { market, setMarket, marketId };
}