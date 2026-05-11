/**
 * lib/csv-export.ts
 *
 * Pure frontend CSV export — no backend needed.
 * Uses Blob + URL.createObjectURL to trigger a browser download.
 */

type CsvRow = Record<string, string | number | null | undefined>;

/**
 * Convert an array of objects to a CSV string.
 * Keys of the first object are used as headers.
 */
function toCsv(rows: CsvRow[], headers?: string[]): string {
  if (rows.length === 0) return "";

  const keys = headers ?? Object.keys(rows[0]);

  const escape = (val: string | number | null | undefined): string => {
    const str = val == null ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = keys.map(escape).join(",");
  const dataRows = rows.map((row) => keys.map((k) => escape(row[k])).join(","));

  return [headerRow, ...dataRows].join("\r\n");
}

/**
 * Trigger a browser file download.
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Portfolio export ─────────────────────────────────────────────────────────

export interface HoldingRow {
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
}

// Synchronous — no await needed at call site
export function exportPortfolioCsv(holdings: HoldingRow[]): void {
  const rows: CsvRow[] = holdings.map((h) => ({
    Symbol: h.symbol,
    Name: h.name,
    Quantity: h.qty,
    "Avg Price": h.avgPrice.toFixed(2),
    "Current Price": h.currentPrice.toFixed(2),
    "Market Value": h.marketValue.toFixed(2),
    "P&L": h.pnl.toFixed(2),
    "P&L %": `${h.pnlPct.toFixed(2)}%`,
  }));

  const timestamp = new Date().toISOString().slice(0, 10);
  downloadCsv(toCsv(rows), `stocksense-portfolio-${timestamp}.csv`);
}

// ─── Orders export ────────────────────────────────────────────────────────────

/**
 * Matches the Order interface used in /dashboard/orders/page.tsx.
 * `createdAt` is an ISO datetime string (e.g. "2024-03-15T10:30:00Z").
 */
export interface OrderRow {
  createdAt: string;   // ← was `date: string` — aligned with Order type from orders page
  symbol: string;
  type: "BUY" | "SELL" | string;
  qty: number;
  price: number;
  total: number;
  status: string;
}

// Synchronous — no await needed at call site
export function exportOrdersCsv(orders: OrderRow[]): void {
  const rows: CsvRow[] = orders.map((o) => ({
    // Format ISO datetime → readable date for the CSV column
    Date: new Date(o.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    Symbol: o.symbol,
    Type: o.type,
    Quantity: o.qty,
    Price: o.price.toFixed(2),
    Total: o.total.toFixed(2),
    Status: o.status,
  }));

  const timestamp = new Date().toISOString().slice(0, 10);
  downloadCsv(toCsv(rows), `stocksense-orders-${timestamp}.csv`);
}