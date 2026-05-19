/**
 * lib/websocket.ts
 *
 * Raw WebSocket client for live price updates.
 * Connects to ws://localhost:8081/ws/prices
 *
 * Backend sends array of price updates every 15s:
 * [
 *   { "symbol": "RELIANCE", "price": 2940.50, "changePct": 0.42, "live": true },
 *   { "symbol": "TCS",      "price": 3921.00, "changePct": -0.18, "live": true }
 * ]
 */

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

export interface PriceUpdate {
  symbol:    string;
  price:     number;
  changePct: number;
  live:      boolean;
  // aliases used by different parts of the app
  changePct_?: number;
}

type PriceMap = Record<string, PriceUpdate>;

const WS_URL         = "ws://localhost:8081/ws/prices";
const MAX_RECONNECT  = 5;
const RECONNECT_DELAY = 3000;

// ── Singleton WebSocket manager ───────────────────────────────────────────────

class StockWebSocket {
  private ws:              WebSocket | null = null;
  private reconnects       = 0;
  private reconnectTimer:  ReturnType<typeof setTimeout> | null = null;
  private listeners        = new Set<(prices: PriceMap) => void>();
  private prices:          PriceMap = {};
  private closed           = false;
  private subscribedSymbols = new Set<string>();

  connect() {
    if (typeof window === "undefined") return;
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) return;

    this.closed = false;

    try {
      this.ws = new WebSocket(WS_URL);
    } catch (e) {
      console.warn("[WS] Failed to create WebSocket:", e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this.reconnects = 0;
      this.closed     = false;
      this.clearReconnectTimer();

      // Re-subscribe to all symbols after reconnect
      if (this.subscribedSymbols.size > 0) {
        this.sendSubscribe([...this.subscribedSymbols]);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle array format: [{ symbol, price, changePct, live }, ...]
        const updates: Array<{ symbol: string; price: number; changePct: number; live: boolean }> =
          Array.isArray(data) ? data : [data];

        let changed = false;

        for (const item of updates) {
          if (!item.symbol || typeof item.price !== "number") continue;

          const update: PriceUpdate = {
            symbol:    item.symbol,
            price:     item.price,
            changePct: item.changePct ?? 0,
            live:      item.live ?? false,
          };

          // Store under plain symbol and exchange-suffixed variants
          this.prices[item.symbol]           = update;
          this.prices[`${item.symbol}.BSE`] = update;
          this.prices[`${item.symbol}.NSE`] = update;
          changed = true;
        }

        if (changed) {
          const snapshot = { ...this.prices };
          this.listeners.forEach(fn => fn(snapshot));
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      // error fires before close — let onclose handle reconnect
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.closed) return;
      console.warn("[WS] Disconnected");
      this.scheduleReconnect();
    };
  }

  subscribe(fn: (prices: PriceMap) => void) {
    this.listeners.add(fn);
    // Immediately emit current prices
    if (Object.keys(this.prices).length > 0) fn({ ...this.prices });
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.disconnect();
    };
  }

  addSymbols(symbols: string[]) {
    const newSymbols = symbols.filter(s => !this.subscribedSymbols.has(s));
    if (newSymbols.length === 0) return;
    newSymbols.forEach(s => this.subscribedSymbols.add(s));
    this.sendSubscribe(newSymbols);
  }

  private sendSubscribe(symbols: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ subscribe: symbols }));
    }
  }

  private scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return;
    if (this.reconnects >= MAX_RECONNECT) {
      console.warn("[WS] Max reconnect attempts reached.");
      return;
    }
    const nextAttempt = this.reconnects + 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnects     = nextAttempt;
      console.log(`[WS] Reconnecting... (${nextAttempt}/${MAX_RECONNECT})`);
      this.connect();
    }, RECONNECT_DELAY * nextAttempt);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  disconnect() {
    this.closed = true;
    this.clearReconnectTimer();
    this.ws?.close();
    this.ws = null;
  }

  getPrices(): PriceMap { return this.prices; }
}

// Single shared instance
const wsManager = new StockWebSocket();

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * useLivePrices(symbols)
 * Returns a map of symbol → PriceUpdate for the given symbols.
 */
export function useLivePrices(symbols: string[]): PriceMap {
  const [prices, setPrices] = useState<PriceMap>({});
  const symbolsKey = symbols.slice().sort().join(",");

  useEffect(() => {
    const symbolList = symbolsKey ? symbolsKey.split(",") : [];
    if (symbolList.length === 0) return;

    // Connect and subscribe
    wsManager.connect();
    wsManager.addSymbols(symbolList);

    const unsub = wsManager.subscribe((all) => {
      const relevant: PriceMap = {};
      let changed = false;

      for (const sym of symbolList) {
        const update = all[sym]
          ?? all[sym.replace(".BSE", "").replace(".NSE", "")]
          ?? null;
        if (update) {
          relevant[sym] = update;
          changed = true;
        }
      }

      if (changed) setPrices(prev => ({ ...prev, ...relevant }));
    });

    return unsub;
  }, [symbolsKey]);

  return prices;
}

export { wsManager as StockWebSocket };