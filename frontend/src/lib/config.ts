/**
 * lib/config.ts
 *
 * Single source of truth for backend URLs.
 * Override per-environment via NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL.
 */

// REST / HTTP base (no trailing slash)
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://stocksense-4a8j.onrender.com";

// WebSocket base (no trailing slash)
export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "wss://stocksense-4a8j.onrender.com";

// Full WebSocket endpoint for live prices
export const WS_PRICES_URL = `${WS_BASE_URL}/ws/prices`;
