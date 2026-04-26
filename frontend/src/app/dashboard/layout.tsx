"use client";

import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface text-text-primary">

      {/* Sidebar */}
      <aside className="w-64 bg-surface-card border-r border-border p-6 hidden md:flex flex-col">
        <h2 className="text-xl font-semibold mb-8">StockSense</h2>

        <nav className="flex flex-col gap-4 text-text-secondary">
          <Link href="/dashboard" className="hover:text-text-primary">
            Dashboard
          </Link>
          <Link href="/dashboard/portfolio" className="hover:text-text-primary">
            Portfolio
          </Link>
          <Link href="/dashboard/watchlist" className="hover:text-text-primary">
            Watchlist
          </Link>
          <Link href="/dashboard/analytics" className="hover:text-text-primary">
            Analytics
          </Link>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1">{children}</main>
    </div>
  );
}