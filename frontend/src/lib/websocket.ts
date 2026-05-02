/**
 * lib/websocket.ts
 *
 * Singleton WebSocket client + React hook for live price updates.
 *
 * Usage:
 *   const { price, change, changePct } = useLivePrice("AAPL");
 */

import { useEffect, useState, useRef } from "react";

const WS_URL = "ws://localhost:8081/ws/prices";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PriceTick {
  symbol:    string;
  price:     number;
  change:    number;
  changePct: number;
  timestamp: number;
}

type Listener = (tick: PriceTick) => void;

// ── Singleton WebSocket manager ──────────────────────────────────────────────

class PriceSocketManager {
  private ws:          WebSocket | null = null;
  private listeners:   Map<string, Set<Listener>> = new Map();
  private subscribed:  Set<string> = new Set();
  private reconnectMs: number = 2000;
  private destroyed:   boolean = false;
  private queue:       string[] = []; // messages to send once connected

  connect() {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    if (typeof window === "undefined") return;

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.reconnectMs = 2000;
      // Re-subscribe to all symbols after reconnect
      if (this.subscribed.size > 0) {
        this.send({ action: "subscribe", symbols: [...this.subscribed] });
      }
      // Flush queued messages
      this.queue.forEach(m => this.ws?.send(m));
      this.queue = [];
    };

    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "error") return; // ignore per-symbol errors silently
        const tick = data as PriceTick;
        const cbs  = this.listeners.get(tick.symbol.toUpperCase());
        cbs?.forEach(cb => cb(tick));
      } catch { /* malformed message */ }
    };

    this.ws.onclose = () => {
      if (this.destroyed) return;
      // Exponential backoff reconnect (max 30s)
      setTimeout(() => this.connect(), this.reconnectMs);
      this.reconnectMs = Math.min(this.reconnectMs * 1.5, 30_000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private send(payload: object) {
    const msg = JSON.stringify(payload);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.queue.push(msg);
    }
  }

  subscribe(symbol: string, listener: Listener) {
    const sym = symbol.toUpperCase();
    if (!this.listeners.has(sym)) this.listeners.set(sym, new Set());
    this.listeners.get(sym)!.add(listener);

    if (!this.subscribed.has(sym)) {
      this.subscribed.add(sym);
      this.send({ action: "subscribe", symbols: [sym] });
    }
  }

  unsubscribe(symbol: string, listener: Listener) {
    const sym = symbol.toUpperCase();
    const cbs = this.listeners.get(sym);
    if (!cbs) return;
    cbs.delete(listener);
    if (cbs.size === 0) {
      this.listeners.delete(sym);
      this.subscribed.delete(sym);
      this.send({ action: "unsubscribe", symbols: [sym] });
    }
  }

  destroy() {
    this.destroyed = true;
    this.ws?.close();
  }
}

// Single shared instance
let manager: PriceSocketManager | null = null;

function getManager(): PriceSocketManager {
  if (!manager) {
    manager = new PriceSocketManager();
    manager.connect();
  }
  return manager;
}

// ── React hook ───────────────────────────────────────────────────────────────

export interface LivePrice {
  price:     number | null;
  change:    number | null;
  changePct: number | null;
  live:      boolean; // false until first tick arrives
}

export function useLivePrice(symbol: string | null | undefined): LivePrice {
  const [state, setState] = useState<LivePrice>({
    price: null, change: null, changePct: null, live: false,
  });

  // Keep a stable ref to the listener so we can unsubscribe correctly
  const listenerRef = useRef<Listener | null>(null);

  useEffect(() => {
    if (!symbol) return;

    const mgr = getManager();

    const listener: Listener = (tick) => {
      setState({
        price:     tick.price,
        change:    tick.change,
        changePct: tick.changePct,
        live:      true,
      });
    };

    listenerRef.current = listener;
    mgr.subscribe(symbol, listener);

    return () => {
      if (listenerRef.current) {
        mgr.unsubscribe(symbol, listenerRef.current);
      }
    };
  }, [symbol]);

  return state;
}

/**
 * useLivePrices — subscribe to multiple symbols at once.
 * Returns a map of symbol → LivePrice.
 */
export function useLivePrices(symbols: string[]): Record<string, LivePrice> {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const listenersRef = useRef<Map<string, Listener>>(new Map());

  useEffect(() => {
    if (!symbols || symbols.length === 0) return;
    const mgr = getManager();

    symbols.forEach((symbol) => {
      if (listenersRef.current.has(symbol)) return; // already subscribed

      const listener: Listener = (tick) => {
        setPrices(prev => ({
          ...prev,
          [symbol]: {
            price:     tick.price,
            change:    tick.change,
            changePct: tick.changePct,
            live:      true,
          },
        }));
      };

      listenersRef.current.set(symbol, listener);
      mgr.subscribe(symbol, listener);
    });

    return () => {
      listenersRef.current.forEach((listener, symbol) => {
        mgr.unsubscribe(symbol, listener);
      });
      listenersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  return prices;
}