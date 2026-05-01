"use client";

/**
 * lib/MarketContext.tsx
 * ─────────────────────
 * Single source of truth is hooks/useMarket.ts (localStorage, 4 markets).
 * This file is a compatibility shim so layout.tsx and any other file
 * importing from "@/lib/MarketContext" keeps working without changes.
 */

import { createContext, useContext, ReactNode } from "react";
import { useMarket as useMarketHook, MARKETS, type Market, type MarketId } from "@/hooks/useMarket";

export type { Market, MarketId };
export { MARKETS };

interface MarketContextValue {
  market: Market;
  setMarketId: (id: MarketId) => void;
  resolveSymbol: (ticker: string) => string;
  formatPrice: (n: number, decimals?: number) => string;
}

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const { market, setMarket } = useMarketHook();

  const resolveSymbol = (ticker: string) => {
    const upper = ticker.toUpperCase();
    if (market.id === "IN") return upper.endsWith(".BSE") ? upper : `${upper}.BSE`;
    if (market.id === "FX") return upper.startsWith("FX_") ? upper : `FX_${upper}`;
    return upper; // US + CRYPTO
  };

  const formatPrice = (n: number, decimals = 2) => {
    if (market.id === "FX" || market.id === "CRYPTO") {
      const d = n < 1 ? 6 : decimals;
      return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    }
    const locale = market.id === "IN" ? "en-IN" : "en-US";
    return market.currency + n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  return (
    <MarketContext.Provider value={{ market, setMarketId: setMarket, resolveSymbol, formatPrice }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used inside <MarketProvider>");
  return ctx;
}