"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketId = "IN" | "US" | "FX";

export interface Market {
  id: MarketId;
  label: string;
  flag: string;
  currency: string;       // display symbol: ₹ $ ₿
  currencyCode: string;   // ISO: INR USD
  suffix: string;         // appended to Alpha Vantage symbol: ".BSE" "" ""
  exchangeLabel: string;  // shown in UI badges
  placeholder: string;    // search placeholder
}

export const MARKETS: Record<MarketId, Market> = {
  IN: {
    id: "IN",
    label: "India",
    flag: "🇮🇳",
    currency: "₹",
    currencyCode: "INR",
    suffix: ".BSE",
    exchangeLabel: "BSE",
    placeholder: "Search BSE stocks… e.g. RELIANCE",
  },
  US: {
    id: "US",
    label: "United States",
    flag: "🇺🇸",
    currency: "$",
    currencyCode: "USD",
    suffix: "",
    exchangeLabel: "NASDAQ / NYSE",
    placeholder: "Search US stocks… e.g. AAPL",
  },
  FX: {
    id: "FX",
    label: "Forex / Crypto",
    flag: "💱",
    currency: "",            // varies per instrument
    currencyCode: "",
    suffix: "",
    exchangeLabel: "FX / Crypto",
    placeholder: "Search pairs… e.g. EURUSD or BTC",
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface MarketContextValue {
  market: Market;
  setMarketId: (id: MarketId) => void;
  /** Resolves a bare ticker to the Alpha Vantage symbol for this market */
  resolveSymbol: (ticker: string) => string;
  /** Formats a number as currency for this market */
  formatPrice: (n: number, decimals?: number) => string;
}

const MarketContext = createContext<MarketContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MarketProvider({ children }: { children: ReactNode }) {
  const [marketId, setMarketId] = useState<MarketId>("IN");
  const market = MARKETS[marketId];

  const resolveSymbol = useCallback(
    (ticker: string) => {
      const upper = ticker.toUpperCase();
      if (marketId === "IN") {
        // Already has suffix → leave it; otherwise append
        return upper.endsWith(".BSE") ? upper : `${upper}.BSE`;
      }
      if (marketId === "FX") {
        // Alpha Vantage FX pairs: EURUSD → FX_EURUSD
        // Crypto: BTC → BTCUSD (caller responsible for pairing)
        return upper.startsWith("FX_") ? upper : `FX_${upper}`;
      }
      // US — no suffix
      return upper;
    },
    [marketId]
  );

  const formatPrice = useCallback(
    (n: number, decimals = 2) => {
      if (marketId === "FX") {
        // Crypto can have many decimals; Forex typically 4
        const d = n < 1 ? 6 : decimals;
        return n.toLocaleString("en-US", {
          minimumFractionDigits: d,
          maximumFractionDigits: d,
        });
      }
      const locale = marketId === "IN" ? "en-IN" : "en-US";
      return (
        market.currency +
        n.toLocaleString(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      );
    },
    [marketId, market.currency]
  );

  return (
    <MarketContext.Provider
      value={{ market, setMarketId, resolveSymbol, formatPrice }}
    >
      {children}
    </MarketContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used inside <MarketProvider>");
  return ctx;
}