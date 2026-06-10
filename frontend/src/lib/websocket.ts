/**
 * lib/websocket.ts
 *
 * WebSocket client for live price updates.
 * Connects to WS_PRICES_URL (see lib/config.ts)
 *
 * ACTUAL backend protocol:
 *   Client → Server (subscribe):
 *     { "action": "subscribe", "symbols": ["AAPL", "TSLA"] }
 *
 *   Client → Server (unsubscribe):
 *     { "action": "unsubscribe", "symbols": ["AAPL"] }
 *
 *   Server → Client (one object per symbol, NOT an array):
 *     { "symbol": "AAPL", "price": 189.42, "change": 1.23,
 *       "changePct": 0.65, "timestamp": 1714900000000 }
 *
 *   Server → Client (on error):
 *     { "type": "error", "symbol": "X", "message": "Price unavailable" }
 */

import { useEffect, useState, useRef } from "react";
import { WS_PRICES_URL } from "./config";

export interface PriceUpdate {
  symbol:    string;
  price:     number;
  changePct: number;
  change:    number;
  live:      boolean;
}

type PriceMap = Record<string, PriceUpdate>;

const WS_URL          = WS_PRICES_URL;
const MAX_RECONNECT   = 5;
const RECONNECT_DELAY = 3000;

// ── Strip exchange suffix — backend only knows raw symbols ────────────────────
function stripSuffix(symbol: string): string {
  return symbol.replace(/\.(BSE|NSE|NYSE|NASDAQ)$/i, "");
}

// ── Singleton WebSocket manager ───────────────────────────────────────────────

class StockWebSocket {
  private ws:              WebSocket | null = null;
  private reconnects       = 0;
  private reconnectTimer:  ReturnType<typeof setTimeout> | null = null;
  private listeners        = new Set<(prices: PriceMap) => void>();
  private prices:          PriceMap = {};
  private closed           = false;
  private subscribedSymbols = new Set<string>(); // raw symbols only

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
      console.log("[WS] Connected to", WS_URL);
      this.reconnects = 0;
      this.closed     = false;
      this.clearReconnectTimer();
      // Re-subscribe to all known symbols after reconnect
      if (this.subscribedSymbols.size > 0) {
        this.sendSubscribe([...this.subscribedSymbols]);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Backend sends one object at a time — not an array
        // Skip error messages
        if (data.type === "error" || !data.symbol || typeof data.price !== "number") {
          return;
        }

        const raw = stripSuffix(data.symbol); // normalise just in case

        const update: PriceUpdate = {
          symbol:    raw,
          price:     data.price,
          changePct: data.changePct ?? 0,
          change:    data.change    ?? 0,
          live:      true, // if we received it, it's live
        };

        // Store under raw + both exchange suffixes so any lookup hits
        this.prices[raw]           = update;
        this.prices[`${raw}.BSE`] = update;
        this.prices[`${raw}.NSE`] = update;

        const snapshot = { ...this.prices };
        this.listeners.forEach(fn => fn(snapshot));

      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = (e) => {
      console.warn("[WS] Error:", e);
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.closed) return;
      console.warn("[WS] Disconnected — scheduling reconnect");
      this.scheduleReconnect();
    };
  }

  subscribe(fn: (prices: PriceMap) => void) {
    this.listeners.add(fn);
    // Immediately emit current prices so UI doesn't wait for next 15s push
    if (Object.keys(this.prices).length > 0) fn({ ...this.prices });
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.disconnect();
    };
  }

  /** Add new symbols — skips already-subscribed ones */
  addSymbols(symbols: string[]) {
    const raw        = symbols.map(stripSuffix).filter(Boolean);
    const newSymbols = raw.filter(s => !this.subscribedSymbols.has(s));
    if (newSymbols.length === 0) return;
    newSymbols.forEach(s => this.subscribedSymbols.add(s));
    this.sendSubscribe(newSymbols);
  }

  /** Force-resubscribe — used on market switch even if symbols already tracked */
  resubscribe(symbols: string[]) {
    const raw = symbols.map(stripSuffix).filter(Boolean);
    if (raw.length === 0) return;
    raw.forEach(s => this.subscribedSymbols.add(s));
    this.sendSubscribe(raw);
  }

  unsubscribe(symbols: string[]) {
    const raw = symbols.map(stripSuffix).filter(Boolean);
    raw.forEach(s => this.subscribedSymbols.delete(s));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "unsubscribe", symbols: raw }));
    }
  }

  /**
   * Send subscription using the CORRECT backend format:
   * { "action": "subscribe", "symbols": [...] }
   */
  private sendSubscribe(symbols: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({ action: "subscribe", symbols });
      console.log("[WS] Subscribing:", msg);
      this.ws.send(msg);
    }
    // If not open yet, onopen will resubscribe all subscribedSymbols on connect
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

  getPrices(): PriceMap { return { ...this.prices }; }
}

// Single shared instance across the whole app
const wsManager = new StockWebSocket();

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * useLivePrices(symbols)
 *
 * Pass ANY symbol format (raw or with suffix).
 * Internally strips suffixes before subscribing since backend uses raw symbols.
 * Returns a PriceMap keyed by the ORIGINAL symbols you passed in.
 */
export function useLivePrices(symbols: string[]): PriceMap {
  const [prices, setPrices] = useState<PriceMap>(() => wsManager.getPrices());

  // Stable key using raw symbols — order-independent
  const symbolsKey = symbols
    .map(stripSuffix)
    .filter(Boolean)
    .sort()
    .join(",");

  const prevKeyRef = useRef<string>("");

  useEffect(() => {
    const rawList = symbolsKey ? symbolsKey.split(",") : [];
    if (rawList.length === 0) return;

    wsManager.connect();

    const isNewSymbols = symbolsKey !== prevKeyRef.current;
    prevKeyRef.current = symbolsKey;

    if (isNewSymbols) {
      // Market switched or first load — force resubscribe
      wsManager.resubscribe(rawList);
    } else {
      wsManager.addSymbols(rawList);
    }

    const unsub = wsManager.subscribe((all) => {
      const relevant: PriceMap = {};
      let changed = false;

      for (const sym of symbols) {
        const raw    = stripSuffix(sym);
        // Try original, then raw, then with suffixes
        const update =
          all[sym] ??
          all[raw] ??
          all[`${raw}.BSE`] ??
          all[`${raw}.NSE`] ??
          null;

        if (update) {
          relevant[sym] = { ...update, symbol: sym };
          changed = true;
        }
      }

      if (changed) setPrices(prev => ({ ...prev, ...relevant }));
    });

    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  return prices;
}

export { wsManager as StockWebSocket };