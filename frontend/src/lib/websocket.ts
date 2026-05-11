/**
 * lib/websocket.ts
 *
 * Raw WebSocket client for live price updates.
 * Connects to ws://localhost:8081/ws/prices?token=<jwt>
 * Backend sends: {"symbol":"AAPL","price":182.50,"changePct":1.23}
 */

import { useEffect, useState } from "react";
import { getWebSocketUrl } from "@/lib/auth";

export interface PriceUpdate {
  symbol:    string;
  price:     number;
  changePct: number;
  // aliases used by different parts of the app
  live?:     number;
  changePct_?: number;
}

type PriceMap = Record<string, PriceUpdate>;

const MAX_RECONNECT  = 5;
const RECONNECT_DELAY = 3000;

// ── Singleton WebSocket manager ───────────────────────────────────────────────

class StockWebSocket {
  private ws:           WebSocket | null = null;
  private reconnects    = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners     = new Set<(prices: PriceMap) => void>();
  private prices:       PriceMap = {};
  private closed        = false;

  connect() {
    if (typeof window === "undefined") return;
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) return;

    this.closed = false;

    try {
      this.ws = new WebSocket(getWebSocketUrl());
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
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          symbol: string;
          price: number;
          changePct: number;
        };

        if (!data.symbol) return;

        const update: PriceUpdate = {
          symbol:    data.symbol,
          price:     data.price,
          changePct: data.changePct,
          live:      data.price,       // alias for components using .live
        };

        // Store under both plain symbol and .BSE/.NSE variants
        this.prices[data.symbol]              = update;
        this.prices[`${data.symbol}.BSE`]    = update;
        this.prices[`${data.symbol}.NSE`]    = update;

        // Notify all subscribers with a new object reference to trigger re-render
        const snapshot = { ...this.prices };
        this.listeners.forEach(fn => fn(snapshot));
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      // error event fires before close — let onclose handle reconnect
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.closed) return;
      console.warn("[WS] Disconnected");
      this.scheduleReconnect();
    };
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
      this.reconnects = nextAttempt;
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

  subscribe(fn: (prices: PriceMap) => void) {
    this.listeners.add(fn);
    // Immediately emit current prices so component doesn't wait for next message
    if (Object.keys(this.prices).length > 0) fn({ ...this.prices });
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.disconnect();
    };
  }

  getPrices(): PriceMap {
    return this.prices;
  }
}

// Single shared instance
const wsManager = new StockWebSocket();

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * useLivePrices(symbols)
 * Returns a map of symbol → PriceUpdate for the given symbols.
 * Connects the shared WebSocket on first use, disconnects when all unmount.
 */
export function useLivePrices(symbols: string[]): PriceMap {
  const [prices, setPrices] = useState<PriceMap>({});
  const symbolsKey = JSON.stringify(symbols);

  useEffect(() => {
    const symbolList = JSON.parse(symbolsKey) as string[];

    // Connect (no-op if already connected)
    wsManager.connect();

    // Subscribe to updates
    const unsub = wsManager.subscribe((all) => {
      const relevant: PriceMap = {};
      let changed = false;

      for (const sym of symbolList) {
        // Try exact match, then without suffix, then with suffix
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

// Export manager for direct use
export { wsManager as StockWebSocket };
