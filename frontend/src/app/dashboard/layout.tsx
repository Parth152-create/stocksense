"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Briefcase, BookMarked, BarChart3,
  Settings, Bell, LogOut, ChevronRight, TrendingUp, Sparkles, Wallet,
  Sun, Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { MarketProvider } from "@/lib/MarketContext";
import MarketSwitcher from "@/components/MarketSwitcher";
import NotificationsDrawer, { AppNotification } from "@/components/NotificationsDrawer";
import { getAuthHeaders, getToken, logout } from "@/lib/auth";
import { TooltipProvider } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/dashboard",                    label: "Dashboard",      icon: LayoutDashboard },
  { href: "/dashboard/wallet",             label: "Wallet",         icon: Wallet },
  { href: "/dashboard/portfolio",          label: "Portfolio",      icon: Briefcase },
  { href: "/dashboard/watchlist",          label: "Watchlist",      icon: BookMarked },
  { href: "/dashboard/analytics",          label: "Analytics",      icon: BarChart3 },
  { href: "/dashboard/insights",           label: "Insights",       icon: Sparkles },
  { href: "/dashboard/orders",             label: "Orders",         icon: BarChart3 },
  { href: "/dashboard/notifications",      label: "Notifications",  icon: Bell },
  { href: "/dashboard/settings",           label: "Settings",       icon: Settings },
];

// ── iOS pill toggle ──────────────────────────────────────────────────────────
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return (
    <div style={{ width: 52, height: 28, borderRadius: 99, background: "var(--color-line)" }} />
  );

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        position: "relative", width: 52, height: 28, borderRadius: 99,
        background: isDark ? "rgba(143,255,214,0.15)" : "#e5e7eb",
        border: isDark ? "1px solid rgba(143,255,214,0.3)" : "1px solid #d1d5db",
        cursor: "pointer", flexShrink: 0,
        transition: "background 0.2s, border-color 0.2s",
        display: "flex", alignItems: "center", padding: "0 3px",
      }}
    >
      <Sun  size={11} style={{ position: "absolute", left: 6,  color: isDark ? "transparent" : "#f59e0b", transition: "color 0.2s" }}/>
      <Moon size={11} style={{ position: "absolute", right: 6, color: isDark ? "#8FFFD6" : "transparent", transition: "color 0.2s" }}/>
      <span style={{
        position: "relative", zIndex: 1, width: 22, height: 22, borderRadius: "50%",
        background: isDark ? "#8FFFD6" : "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transform: isDark ? "translateX(24px)" : "translateX(0px)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.2s",
      }}>
        {isDark
          ? <Moon size={11} style={{ color: "#0a0a0a" }} strokeWidth={2.5}/>
          : <Sun  size={11} style={{ color: "#f59e0b" }} strokeWidth={2.5}/>
        }
      </span>
    </button>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted]       = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  // CRITICAL: Run only ONCE on mount, not on every pathname change.
  // Re-running on pathname causes authChecked to reset to false mid-navigation,
  // which makes the layout return null and triggers the /login redirect.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(`/login?redirect=${pathname}`);
    } else {
      setAuthChecked(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty deps: check auth once on mount only

  const isDark = !mounted || resolvedTheme === "dark";

  const sidebarBg       = isDark ? "#0d0d0d"  : "#ffffff";
  const sidebarBorder   = isDark ? "#1f1f1f"  : "#e5e7eb";
  const headerBg        = isDark ? "#0d0d0d"  : "#ffffff";
  const headerBorder    = isDark ? "#1f1f1f"  : "#e5e7eb";
  const pageBg          = isDark ? "#0a0a0a"  : "#F3F2F2";
  const primaryColor    = isDark ? "#ffffff"  : "#18181A";
  const mutedColor      = isDark ? "#666666"  : "#6b7280";
  const sectionLabel    = isDark ? "#3a3a3a"  : "#9ca3af";
  const activeNavBg     = isDark ? "rgba(143,255,214,0.07)" : "rgba(143,255,214,0.12)";
  const hoverNavBg      = isDark ? "#141414"  : "#f3f4f6";
  const accountBg       = isDark ? "rgba(239,68,68,0.07)" : "rgba(239,68,68,0.06)";
  const bellActiveBg    = isDark ? "#8FFFD611" : "rgba(143,255,214,0.1)";
  const bellBg          = isDark ? "#141414"  : "#f5f5f5";
  const bellBorder      = isDark ? "#1f1f1f"  : "#e5e7eb";
  const bellActiveBorder= isDark ? "#8FFFD633" : "rgba(143,255,214,0.3)";
  const dateColor       = isDark ? "#444444"  : "#9ca3af";
  const breadcrumbActive= isDark ? "#ffffff"  : "#18181A";
  const breadcrumbMuted = isDark ? "#555555"  : "#6b7280";
  const chevronColor    = isDark ? "#333333"  : "#d1d5db";
  const avatarBg        = "linear-gradient(135deg,#8FFFD6,#00c896)";
  const emailColor      = isDark ? "#cccccc"  : "#374151";
  const planColor       = isDark ? "#444444"  : "#9ca3af";

  const [userEmail, setUserEmail]         = useState("");
  const [hoveredLogout, setHoveredLogout] = useState(false);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);

  useEffect(() => {
    if (!authChecked) return;
    fetch("http://localhost:8081/api/users/me", { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.email) setUserEmail(data.email); })
      .catch(() => {});
  }, [authChecked]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8081/api/notifications", { headers: getAuthHeaders() });
      if (res.ok) {
        const data: AppNotification[] = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      }
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [authChecked, fetchNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await fetch(`http://localhost:8081/api/notifications/${id}/read`, {
      method: "POST", headers: getAuthHeaders(),
    }).catch(() => {});
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("http://localhost:8081/api/notifications/read-all", {
      method: "POST", headers: getAuthHeaders(),
    }).catch(() => {});
  }, []);

  const handleLogout = () => logout();

  const breadcrumb = (() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((seg, i) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1),
      href:  "/" + segments.slice(0, i + 1).join("/"),
      isLast: i === segments.length - 1,
    }));
  })();

  // Hold render until auth is confirmed — prevents flash of dashboard before redirect
  if (!authChecked) return null;

  return (
    <MarketProvider>
      <TooltipProvider>
        <div style={{ display: "flex", minHeight: "100vh", background: pageBg, color: primaryColor, fontFamily: "var(--font-geist-sans,'Geist',sans-serif)", transition: "background 0.2s, color 0.2s" }}>

          {/* ── Sidebar ── */}
          <aside style={{ width: 220, minHeight: "100vh", background: sidebarBg, borderRight: `1px solid ${sidebarBorder}`, display: "flex", flexDirection: "column", padding: "0 0 24px", flexShrink: 0, position: "sticky", top: 0, height: "100vh", transition: "background 0.2s, border-color 0.2s" }}>

            {/* Logo */}
            <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${sidebarBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#8FFFD6,#00c896)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={16} color="#0a0a0a" strokeWidth={2.5}/>
              </div>
              <span style={{ color: primaryColor, fontWeight: 700, fontSize: 16, letterSpacing: -0.3 }}>StockSense</span>
            </div>

            {/* Market Switcher */}
            <div style={{ padding: "14px 12px 10px" }}>
              <p style={{ color: sectionLabel, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>Market</p>
              <MarketSwitcher/>
            </div>

            {/* Nav */}
            <nav style={{ padding: "10px 12px", flex: 1 }}>
              <p style={{ color: sectionLabel, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, paddingLeft: 6 }}>Main Menu</p>
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);
                return (
                  <Link key={href} href={href} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px", borderRadius: 9, marginBottom: 2,
                    textDecoration: "none",
                    background: isActive ? activeNavBg : "transparent",
                    borderLeft: isActive ? "2px solid #8FFFD6" : "2px solid transparent",
                    transition: "all 0.15s",
                    color: isActive ? "#8FFFD6" : mutedColor,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = hoverNavBg; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                  >
                    <Icon size={15} strokeWidth={isActive ? 2 : 1.5}/>
                    <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{label}</span>
                    {isActive && <ChevronRight size={12} style={{ marginLeft: "auto" }} strokeWidth={2}/>}
                  </Link>
                );
              })}
            </nav>

            {/* Account */}
            <div style={{ padding: "0 12px", borderTop: `1px solid ${sidebarBorder}`, paddingTop: 16 }}>
              <p style={{ color: sectionLabel, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, paddingLeft: 6 }}>Account</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, marginBottom: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#0a0a0a", flexShrink: 0 }}>
                  {userEmail ? userEmail[0].toUpperCase() : "U"}
                </div>
                <div style={{ overflow: "hidden" }}>
                  <p style={{ color: emailColor, fontSize: 12, fontWeight: 500, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
                    {userEmail || "Loading…"}
                  </p>
                  <p style={{ color: planColor, fontSize: 10, margin: 0 }}>Free plan</p>
                </div>
              </div>
              <button
                onMouseEnter={() => setHoveredLogout(true)}
                onMouseLeave={() => setHoveredLogout(false)}
                onClick={handleLogout}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, background: hoveredLogout ? accountBg : "transparent", border: "none", cursor: "pointer", color: hoveredLogout ? "#ef4444" : mutedColor, transition: "all 0.15s" }}
              >
                <LogOut size={14}/>
                <span style={{ fontSize: 13 }}>Sign out</span>
              </button>
            </div>
          </aside>

          {/* ── Main area ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

            {/* Topbar */}
            <header style={{ height: 60, borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", background: headerBg, position: "sticky", top: 0, zIndex: 30, flexShrink: 0, transition: "background 0.2s, border-color 0.2s" }}>

              {/* Breadcrumb */}
              <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {breadcrumb.map(({ label, href, isLast }) => (
                  <span key={href} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isLast
                      ? <span style={{ color: breadcrumbActive, fontSize: 13, fontWeight: 600 }}>{label}</span>
                      : <Link href={href} style={{ color: breadcrumbMuted, fontSize: 13, textDecoration: "none" }}>{label}</Link>
                    }
                    {!isLast && <ChevronRight size={12} color={chevronColor}/>}
                  </span>
                ))}
              </nav>

              {/* Right: date + toggle + bell */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: dateColor, fontSize: 12 }}>
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>

                <ThemeToggle/>

                {/* Bell */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setDrawerOpen(v => !v)}
                    style={{ width: 36, height: 36, borderRadius: "50%", background: drawerOpen ? bellActiveBg : bellBg, border: drawerOpen ? `1px solid ${bellActiveBorder}` : `1px solid ${bellBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: drawerOpen ? "#8FFFD6" : mutedColor, transition: "all 0.15s" }}
                  >
                    <Bell size={15}/>
                  </button>
                  {unreadCount > 0 && (
                    <span style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, padding: "0 4px", background: "#8FFFD6", borderRadius: 99, fontSize: 9, fontWeight: 700, color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${headerBg}` }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </header>

            <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
          </div>
        </div>

        <NotificationsDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
        />
      </TooltipProvider>
    </MarketProvider>
  );
}