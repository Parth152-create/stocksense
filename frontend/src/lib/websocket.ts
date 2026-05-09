/**
 * lib/websocket.ts
 */

import { useEffect, useState } from "react";
import { getWebSocketUrl } from "./auth";

export type PriceUpdate = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  live: boolean;
};

type MessageHandler = (update: PriceUpdate) => void;
type StatusHandler = (status: "connected" | "disconnected" | "error") => void;

class StockWebSocket {
  private ws: WebSocket | null = null;
  private subscribers = new Map<string, Set<MessageHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private intentionallyClosed = false;

  connect(): void {
    this.intentionallyClosed = false;
    this._openSocket();
  }

  private _openSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const url = getWebSocketUrl();
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._notifyStatus("connected");

      this.subscribers.forEach((_, symbol) => {
        this._sendSubscribe(symbol);
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const update: PriceUpdate = { ...JSON.parse(event.data), live: true };
        const handlers = this.subscribers.get(update.symbol);
        handlers?.forEach((h) => h(update));
        this.subscribers.get("*")?.forEach((h) => h(update));
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      this._notifyStatus("error");
    };

    this.ws.onclose = () => {
      this._notifyStatus("disconnected");
      if (!this.intentionallyClosed) {
        this._scheduleReconnect();
      }
    };
  }

  subscribe(symbol: string, handler: MessageHandler): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
      if (this.ws?.readyState === WebSocket.OPEN) {
        this._sendSubscribe(symbol);
      }
    }
    this.subscribers.get(symbol)!.add(handler);

    return () => this.unsubscribe(symbol, handler);
  }

  unsubscribe(symbol: string, handler: MessageHandler): void {
    const handlers = this.subscribers.get(symbol);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.subscribers.delete(symbol);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this._sendUnsubscribe(symbol);
      }
    }
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private _sendSubscribe(symbol: string): void {
    this.ws?.send(JSON.stringify({ action: "subscribe", symbol }));
  }

  private _sendUnsubscribe(symbol: string): void {
    this.ws?.send(JSON.stringify({ action: "unsubscribe", symbol }));
  }

  private _notifyStatus(status: "connected" | "disconnected" | "error"): void {
    this.statusHandlers.forEach((h) => h(status));
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[WS] Max reconnect attempts reached.");
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this._openSocket();
    }, delay);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const stockWS = new StockWebSocket();

export function useLivePrices(symbols: string[]): Record<string, PriceUpdate> {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});

  useEffect(() => {
    if (symbols.length === 0) return;

    stockWS.connect();

    const unsubscribers = symbols.map((symbol) =>
      stockWS.subscribe(symbol, (update) => {
        setPrices((prev) => ({ ...prev, [symbol]: update }));
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  return prices;
}