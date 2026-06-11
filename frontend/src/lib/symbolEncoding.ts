/** Encode a symbol for use in a URL path segment. EUR/USD → EUR-USD */
export function encodeSymbolForUrl(symbol: string): string {
  return symbol.replace(/\//g, "-");
}

/** Decode a URL path segment back to a symbol. EUR-USD → EUR/USD */
export function decodeSymbolFromUrl(segment: string): string {
  // Only convert hyphens that look like FX separators (3 letters - 3 letters)
  return segment.replace(/^([A-Z]{2,4})-([A-Z]{2,4})$/, "$1/$2");
}