/**
 * lib/symbols.ts
 * Single source of truth for symbol resolution across the app.
 */

export function resolveSymbol(symbol: string, marketId: string): string {
  if (marketId === "IN" && !symbol.includes(".") && !symbol.includes("/"))
    return `${symbol}.NS`;
  return symbol;
}