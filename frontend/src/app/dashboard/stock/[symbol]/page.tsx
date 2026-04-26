"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Stock = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
};

export default function StockPage() {
  const params = useParams();
  const symbol = params.symbol as string;

  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res = await fetch(
          `http://localhost:8081/api/stocks/${symbol}`
        );

        const data = await res.json();
        setStock(data);
      } catch (err) {
        console.error("Error fetching stock:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStock();
  }, [symbol]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-text-secondary">
        Loading...
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-red-500">
        Failed to load stock data
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text-primary p-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{stock.symbol}</h1>
        <p className="text-text-secondary mt-1">
          Real-time stock analysis
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Price */}
        <div className="bg-surface-card p-6 rounded-2xl border border-border">
          <p className="text-text-secondary text-sm">Current Price</p>
          <h2 className="text-4xl font-bold mt-2">
            ${stock.price.toFixed(2)}
          </h2>
        </div>

        {/* Change */}
        <div className="bg-surface-card p-6 rounded-2xl border border-border">
          <p className="text-text-secondary text-sm">Change</p>

          <h2
            className={`text-3xl font-bold mt-2 ${
              stock.change >= 0 ? "text-bull" : "text-bear"
            }`}
          >
            {stock.change >= 0 ? "+" : ""}
            {stock.change.toFixed(2)}
          </h2>

          <p className="text-text-secondary mt-2">
            {stock.changePercent.toFixed(2)}%
          </p>
        </div>

        {/* Signal (temporary logic) */}
        <div className="bg-surface-card p-6 rounded-2xl border border-border">
          <p className="text-text-secondary text-sm">AI Signal</p>

          <h2
            className={`text-3xl font-bold mt-2 ${
              stock.change >= 0 ? "text-bull" : "text-bear"
            }`}
          >
            {stock.change >= 0 ? "BUY" : "SELL"}
          </h2>

          <p className="text-text-secondary mt-2">
            Confidence: {Math.min(95, Math.abs(stock.changePercent) * 10).toFixed(0)}%
          </p>
        </div>

      </div>

    </div>
  );
}