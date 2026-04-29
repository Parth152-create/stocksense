"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  BookMarked,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { MarketProvider } from "@/lib/MarketContext";
import MarketSwitcher from "@/components/MarketSwitcher";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/dashboard",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/portfolio", label: "Portfolio",  icon: Briefcase },
  { href: "/dashboard/watchlist", label: "Watchlist",  icon: BookMarked },
  { href: "/dashboard/analytics", label: "Analytics",  icon: BarChart3 },
  { href: "/dashboard/settings",  label: "Settings",   icon: Settings },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [hoveredLogout, setHoveredLogout] = useState(false);
  const [notifications] = useState(3); // replace with real count later

  // ── Load user email ──────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.email) setUserEmail(data.email);
      })
      .catch(() => {});
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────

  const handleLogout = () => {
    localStorage.removeItem("token");
    // Clear cookie so middleware knows the session ended
    document.cookie = "token=; path=/; Max-Age=0";
    router.push("/login");
  };

  // ── Breadcrumb ───────────────────────────────────────────────────────────

  const breadcrumb = (() => {
    const segments = pathname.split("/").filter(Boolean); // ["dashboard", "portfolio"]
    return segments.map((seg, i) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1),
      href: "/" + segments.slice(0, i + 1).join("/"),
      isLast: i === segments.length - 1,
    }));
  })();

  return (
    <MarketProvider>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "var(--surface, #0a0a0a)",
          color: "var(--text-primary, #fff)",
          fontFamily: "var(--font-geist-sans, 'Geist', sans-serif)",
        }}
      >
        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside
          style={{
            width: 220,
            minHeight: "100vh",
            background: "#0d0d0d",
            borderRight: "1px solid var(--border, #1f1f1f)",
            display: "flex",
            flexDirection: "column",
            padding: "0 0 24px",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            height: "100vh",
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: "22px 20px 18px",
              borderBottom: "1px solid #1a1a1a",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: "linear-gradient(135deg, #8FFFD6, #00c896)",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingUp size={16} color="#0a0a0a" strokeWidth={2.5} />
            </div>
            <span
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: -0.3,
              }}
            >
              StockSense
            </span>
          </div>

          {/* ── Market Switcher ──────────────────────────────────────── */}
          <div style={{ padding: "14px 12px 10px" }}>
            <p
              style={{
                color: "#3a3a3a",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
                paddingLeft: 2,
              }}
            >
              Market
            </p>
            <MarketSwitcher />
          </div>

          {/* ── Nav links ────────────────────────────────────────────── */}
          <nav style={{ padding: "10px 12px", flex: 1 }}>
            <p
              style={{
                color: "#3a3a3a",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
                paddingLeft: 6,
              }}
            >
              Main Menu
            </p>

            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              // Exact match for dashboard root, prefix match for sub-pages
              const isActive =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 9,
                    marginBottom: 2,
                    textDecoration: "none",
                    background: isActive
                      ? "rgba(143,255,214,0.07)"
                      : "transparent",
                    borderLeft: isActive
                      ? "2px solid #8FFFD6"
                      : "2px solid transparent",
                    transition: "all 0.15s",
                    color: isActive ? "#8FFFD6" : "#666",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        "#141414";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        "transparent";
                  }}
                >
                  <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <ChevronRight
                      size={12}
                      style={{ marginLeft: "auto" }}
                      strokeWidth={2}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Account section ──────────────────────────────────────── */}
          <div
            style={{
              padding: "0 12px",
              borderTop: "1px solid #1a1a1a",
              paddingTop: 16,
            }}
          >
            <p
              style={{
                color: "#3a3a3a",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
                paddingLeft: 6,
              }}
            >
              Account
            </p>

            {/* User email */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 9,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #8FFFD6, #00c896)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#0a0a0a",
                  flexShrink: 0,
                }}
              >
                {userEmail ? userEmail[0].toUpperCase() : "U"}
              </div>
              <div style={{ overflow: "hidden" }}>
                <p
                  style={{
                    color: "#ccc",
                    fontSize: 12,
                    fontWeight: 500,
                    margin: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 120,
                  }}
                >
                  {userEmail || "Loading…"}
                </p>
                <p style={{ color: "#444", fontSize: 10, margin: 0 }}>
                  Free plan
                </p>
              </div>
            </div>

            {/* Logout */}
            <button
              onMouseEnter={() => setHoveredLogout(true)}
              onMouseLeave={() => setHoveredLogout(false)}
              onClick={handleLogout}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 9,
                background: hoveredLogout
                  ? "rgba(239,68,68,0.07)"
                  : "transparent",
                border: "none",
                cursor: "pointer",
                color: hoveredLogout ? "#ef4444" : "#555",
                transition: "all 0.15s",
              }}
            >
              <LogOut size={14} />
              <span style={{ fontSize: 13 }}>Sign out</span>
            </button>
          </div>
        </aside>

        {/* ── Main area ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Topbar */}
          <header
            style={{
              height: 60,
              borderBottom: "1px solid var(--border, #1f1f1f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 32px",
              background: "#0d0d0d",
              position: "sticky",
              top: 0,
              zIndex: 30,
              flexShrink: 0,
            }}
          >
            {/* Breadcrumb */}
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {breadcrumb.map(({ label, href, isLast }) => (
                <span
                  key={href}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  {isLast ? (
                    <span
                      style={{
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </span>
                  ) : (
                    <Link
                      href={href}
                      style={{
                        color: "#555",
                        fontSize: 13,
                        textDecoration: "none",
                      }}
                    >
                      {label}
                    </Link>
                  )}
                  {!isLast && (
                    <ChevronRight size={12} color="#333" />
                  )}
                </span>
              ))}
            </nav>

            {/* Right: date + bell */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ color: "#444", fontSize: 12 }}>
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>

              <div style={{ position: "relative" }}>
                <button
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#141414",
                    border: "1px solid #1f1f1f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#888",
                  }}
                >
                  <Bell size={15} />
                </button>
                {notifications > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 16,
                      height: 16,
                      background: "#8FFFD6",
                      borderRadius: "50%",
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#0a0a0a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid #0d0d0d",
                    }}
                  >
                    {notifications}
                  </span>
                )}
              </div>
            </div>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
        </div>
      </div>
    </MarketProvider>
  );
}