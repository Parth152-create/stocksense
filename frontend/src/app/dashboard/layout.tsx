"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Briefcase, BookMarked, BarChart3,
  Settings, Bell, LogOut, ChevronRight, TrendingUp, Sparkles, Wallet,
  Sun, Moon, Menu, X, SlidersHorizontal, FileText, Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { MarketProvider } from "@/lib/MarketContext";
import MarketSwitcher from "@/components/MarketSwitcher";
import NotificationsDrawer, { AppNotification } from "@/components/NotificationsDrawer";
import { CommandPaletteTrigger } from "@/components/CommandPalette";
import { fetchWithAuth, getToken, logout } from "@/lib/auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ToastContext";

const NAV_ITEMS = [
  { href: "/dashboard",               label: "Dashboard",     icon: LayoutDashboard   },
  { href: "/dashboard/wallet",        label: "Wallet",        icon: Wallet            },
  { href: "/dashboard/portfolio",     label: "Portfolio",     icon: Briefcase         },
  { href: "/dashboard/watchlist",     label: "Watchlist",     icon: BookMarked        },
  { href: "/dashboard/analytics",     label: "Analytics",     icon: BarChart3         },
  { href: "/dashboard/insights",      label: "Insights",      icon: Sparkles          },
  { href: "/dashboard/orders",        label: "Orders",        icon: BarChart3         },
  { href: "/dashboard/screener",      label: "Screener",      icon: SlidersHorizontal },
  { href: "/dashboard/tax",           label: "Tax & Lots",    icon: FileText          },
  { href: "/dashboard/community",    label: "Community",  icon: Users          },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell              },
  { href: "/dashboard/settings",      label: "Settings",      icon: Settings          },
];

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
      aria-label="Toggle theme"
      style={{
        position: "relative", width: 52, height: 28, borderRadius: 99,
        background: isDark ? "rgba(143,255,214,0.15)" : "#e5e7eb",
        border: isDark ? "1px solid rgba(143,255,214,0.3)" : "1px solid #d1d5db",
        cursor: "pointer", flexShrink: 0,
        transition: "background 0.2s, border-color 0.2s",
        display: "flex", alignItems: "center", padding: "0 3px",
      }}>
      <Sun  size={11} style={{ position: "absolute", left: 6,  color: isDark ? "transparent" : "#f59e0b", transition: "color 0.2s" }} />
      <Moon size={11} style={{ position: "absolute", right: 6, color: isDark ? "#8FFFD6" : "transparent", transition: "color 0.2s" }} />
      <span style={{
        position: "relative", zIndex: 1, width: 22, height: 22, borderRadius: "50%",
        background: isDark ? "#8FFFD6" : "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transform: isDark ? "translateX(24px)" : "translateX(0px)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.2s",
      }}>
        {isDark
          ? <Moon size={11} style={{ color: "#0a0a0a" }} strokeWidth={2.5} />
          : <Sun  size={11} style={{ color: "#f59e0b" }} strokeWidth={2.5} />}
      </span>
    </button>
  );
}

function PageTransition({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionKey,   setTransitionKey]   = useState(pathname);
  const [animating,       setAnimating]       = useState(false);

  useEffect(() => {
    if (pathname !== transitionKey) {
      setAnimating(true);
      const t = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionKey(pathname);
        setAnimating(false);
      }, 120);
      return () => clearTimeout(t);
    } else {
      setDisplayChildren(children);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, children]);

  return (
    <div style={{
      flex: 1,
      opacity:   animating ? 0 : 1,
      transform: animating ? "translateY(6px)" : "translateY(0)",
      transition: "opacity 0.15s ease, transform 0.15s ease",
    }}>
      {displayChildren}
    </div>
  );
}

// ── Sidebar content — shared between desktop aside and mobile drawer ──────────
function SidebarContent({
  pathname, primaryColor, mutedColor, sectionLabel, sidebarBorder,
  activeNavBg, hoverNavBg, accountBg, emailColor, planColor,
  avatarLetter, displayLabel, onNavClick,
}: {
  pathname: string;
  primaryColor: string; mutedColor: string; sectionLabel: string; sidebarBorder: string;
  activeNavBg: string; hoverNavBg: string; accountBg: string;
  emailColor: string; planColor: string;
  avatarLetter: string; displayLabel: string;
  onNavClick?: () => void;
}) {
  const [hoveredNav,    setHoveredNav]    = useState<string | null>(null);
  const [hoveredLogout, setHoveredLogout] = useState(false);

  return (
    <>
      {/* Logo */}
      <div style={{
        padding: "22px 20px 18px",
        borderBottom: `1px solid ${sidebarBorder}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32,
          background: "linear-gradient(135deg,#8FFFD6,#00c896)",
          borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 16px rgba(143,255,214,0.3)",
        }}>
          <TrendingUp size={16} color="#0a0a0a" strokeWidth={2.5} />
        </div>
        <span style={{ color: primaryColor, fontWeight: 800, fontSize: 16, letterSpacing: -0.5 }}>
          StockSense
        </span>
      </div>

      {/* Market Switcher */}
      <div style={{ padding: "14px 12px 10px" }}>
        <p style={{ color: sectionLabel, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>Market</p>
        <MarketSwitcher />
      </div>

      {/* Nav */}
      <nav style={{ padding: "10px 12px", flex: 1 }}>
        <p style={{ color: sectionLabel, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, paddingLeft: 6 }}>Main Menu</p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }, idx) => {
          const isActive = href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              onClick={onNavClick}
              className={`nav-link${isActive ? " active" : ""}`}
              style={{
                background:      isActive ? activeNavBg : "transparent",
                borderLeftColor: isActive ? "#8FFFD6"   : "transparent",
                color:           isActive ? "#8FFFD6"   : mutedColor,
                animation: `slideInLeft 0.3s ease ${0.05 + idx * 0.04}s both`,
              }}
              onMouseEnter={e => {
                setHoveredNav(href);
                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = hoverNavBg;
              }}
              onMouseLeave={e => {
                setHoveredNav(null);
                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
              }}>
              <Icon size={15} strokeWidth={isActive ? 2 : 1.5}
                style={{ transition: "transform 0.15s", transform: hoveredNav === href && !isActive ? "scale(1.1)" : "scale(1)" }} />
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{label}</span>
              {isActive && <ChevronRight size={12} style={{ marginLeft: "auto", animation: "fadeInUp 0.2s ease" }} strokeWidth={2} />}
            </Link>
          );
        })}
      </nav>

      {/* Account */}
      <div style={{
        padding: "16px 12px 0",
        borderTop: `1px solid ${sidebarBorder}`,
        animation: "fadeInUp 0.4s ease 0.5s both",
      }}>
        <p style={{ color: sectionLabel, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, paddingLeft: 6 }}>Account</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, marginBottom: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg,#8FFFD6,#00c896)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#0a0a0a", flexShrink: 0,
            boxShadow: "0 0 10px rgba(143,255,214,0.25)",
          }}>
            {avatarLetter}
          </div>
          <div style={{ overflow: "hidden" }}>
            <p style={{ color: emailColor, fontSize: 12, fontWeight: 500, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
              {displayLabel}
            </p>
            <p style={{ color: planColor, fontSize: 10, margin: 0 }}>Free plan</p>
          </div>
        </div>
        <button
          onMouseEnter={() => setHoveredLogout(true)}
          onMouseLeave={() => setHoveredLogout(false)}
          onClick={() => logout()}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "9px 10px", borderRadius: 9,
            background: hoveredLogout ? accountBg : "transparent",
            border: "none", cursor: "pointer",
            color: hoveredLogout ? "#ef4444" : mutedColor,
            transition: "all 0.15s",
          }}>
          <LogOut size={14} style={{ transition: "transform 0.15s", transform: hoveredLogout ? "translateX(2px)" : "translateX(0)" }} />
          <span style={{ fontSize: 13 }}>Sign out</span>
        </button>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted,        setMounted]        = useState(false);
  const [authChecked,    setAuthChecked]    = useState(false);
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
  useEffect(() => setMounted(true), []);

  // Close mobile nav on route change
  useEffect(() => { setMobileNavOpen(false); }, [pathname]);

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(`/login?redirect=${pathname}`);
    } else {
      setAuthChecked(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDark = !mounted || resolvedTheme === "dark";

  // ── Color tokens ─────────────────────────────────────────────────────────
  const primaryColor = isDark ? "#ffffff"  : "#18181A";
  const mutedColor   = isDark ? "#666666"  : "#6b7280";
  const sectionLabel = isDark ? "#3a3a3a"  : "#9ca3af";
  const pageBg       = isDark ? "#0a0a0a"  : "#F3F2F2";

  const sidebarBg     = isDark ? "rgba(13,13,13,0.75)"    : "rgba(255,255,255,0.70)";
  const sidebarBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const sidebarBlur   = "blur(20px)";

  const headerBg     = isDark ? "rgba(10,10,10,0.80)"    : "rgba(255,255,255,0.75)";
  const headerBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";

  const activeNavBg  = isDark ? "rgba(143,255,214,0.08)" : "rgba(143,255,214,0.14)";
  const hoverNavBg   = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const accountBg    = isDark ? "rgba(239,68,68,0.08)"   : "rgba(239,68,68,0.06)";

  const bellBg           = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const bellBorder       = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const bellActiveBg     = isDark ? "rgba(143,255,214,0.10)" : "rgba(143,255,214,0.12)";
  const bellActiveBorder = isDark ? "rgba(143,255,214,0.3)"  : "rgba(143,255,214,0.4)";

  const dateColor        = isDark ? "#444444" : "#9ca3af";
  const breadcrumbActive = isDark ? "#ffffff"  : "#18181A";
  const breadcrumbMuted  = isDark ? "#555555"  : "#6b7280";
  const chevronColor     = isDark ? "#333333"  : "#d1d5db";
  const emailColor       = isDark ? "#cccccc"  : "#374151";
  const planColor        = isDark ? "#444444"  : "#9ca3af";

  const [userName,  setUserName]  = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (!authChecked) return;
    fetchWithAuth("/api/users/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUserName(data.name  || "");
          setUserEmail(data.email || "");
        }
      })
      .catch(() => {});
  }, [authChecked]);

  const displayLabel = userName || userEmail || "…";
  const avatarLetter = displayLabel !== "…" ? displayLabel[0].toUpperCase() : "U";

  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/notifications");
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
    const iv = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(iv);
  }, [authChecked, fetchNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await fetchWithAuth(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetchWithAuth("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }, []);

  const breadcrumb = pathname.split("/").filter(Boolean).map((seg, i, arr) => ({
    label:  seg.charAt(0).toUpperCase() + seg.slice(1),
    href:   "/" + arr.slice(0, i + 1).join("/"),
    isLast: i === arr.length - 1,
  }));

  // Shared sidebar props
  const sidebarProps = {
    pathname, primaryColor, mutedColor, sectionLabel, sidebarBorder,
    activeNavBg, hoverNavBg, accountBg, emailColor, planColor,
    avatarLetter, displayLabel,
  };

  if (!authChecked) return null;

  return (
    <MarketProvider>
      <ToastProvider>
        <TooltipProvider>
          <style>{`
            @keyframes slideInLeft {
              from { opacity: 0; transform: translateX(-10px); }
              to   { opacity: 1; transform: translateX(0); }
            }
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes ping {
              0%   { transform: scale(1);   opacity: 0.75; }
              100% { transform: scale(2.2); opacity: 0; }
            }
            .nav-link {
              display: flex; align-items: center; gap: 10px;
              padding: 9px 10px; border-radius: 9px; margin-bottom: 2px;
              text-decoration: none;
              border-left: 2px solid transparent;
              transition: background 0.15s, color 0.15s, border-color 0.15s, padding-left 0.18s;
            }
            .nav-link:hover { padding-left: 14px !important; }
            .nav-link.active { padding-left: 10px; }

            .sidebar-glass {
              background: ${sidebarBg};
              backdrop-filter: ${sidebarBlur};
              -webkit-backdrop-filter: ${sidebarBlur};
              border-right: 1px solid ${sidebarBorder};
              box-shadow: inset -1px 0 0 ${isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"};
            }
            .header-glass {
              background: ${headerBg};
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              border-bottom: 1px solid ${headerBorder};
              box-shadow: 0 1px 0 ${isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"},
                          0 4px 16px ${isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.06)"};
            }

            /* Hide desktop sidebar on mobile, show hamburger */
            .desktop-sidebar { display: flex; }
            .hamburger-btn   { display: none; }

            @media (max-width: 768px) {
              .desktop-sidebar { display: none !important; }
              .hamburger-btn   { display: flex !important; }
              .header-date     { display: none !important; }
            }
          `}</style>

          <div style={{
            display: "flex", minHeight: "100vh",
            background: pageBg, color: primaryColor,
            fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
            transition: "background 0.2s, color 0.2s",
          }}>

            {/* ── Desktop Sidebar ── */}
            <aside className="sidebar-glass desktop-sidebar" style={{
              width: 220, minHeight: "100vh",
              flexDirection: "column", padding: "0 0 24px",
              flexShrink: 0, position: "sticky", top: 0, height: "100vh",
              animation: "slideInLeft 0.3s ease both",
            }}>
              <SidebarContent {...sidebarProps} />
            </aside>

            {/* ── Mobile Overlay + Drawer ── */}
            <AnimatePresence>
              {mobileNavOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    key="mobile-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setMobileNavOpen(false)}
                    style={{
                      position: "fixed", inset: 0, zIndex: 49,
                      background: isDark
                        ? "rgba(0,0,0,0.65)"
                        : "rgba(0,0,0,0.35)",
                      backdropFilter: "blur(2px)",
                      WebkitBackdropFilter: "blur(2px)",
                    }}
                  />

                  {/* Drawer panel */}
                  <motion.div
                    key="mobile-drawer"
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
                    style={{
                      position: "fixed", left: 0, top: 0, bottom: 0,
                      width: 260, zIndex: 50,
                      display: "flex", flexDirection: "column",
                      padding: "0 0 24px",
                      background: isDark ? "rgba(10,10,10,0.97)" : "rgba(255,255,255,0.97)",
                      backdropFilter: "blur(24px)",
                      WebkitBackdropFilter: "blur(24px)",
                      borderRight: `1px solid ${sidebarBorder}`,
                      boxShadow: isDark
                        ? "4px 0 32px rgba(0,0,0,0.6)"
                        : "4px 0 32px rgba(0,0,0,0.12)",
                      overflowY: "auto",
                    }}
                  >
                    {/* Close button inside drawer */}
                    <button
                      onClick={() => setMobileNavOpen(false)}
                      style={{
                        position: "absolute", top: 16, right: 16, zIndex: 10,
                        width: 32, height: 32, borderRadius: 8,
                        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        border: `1px solid ${sidebarBorder}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", color: mutedColor,
                      }}>
                      <X size={15} />
                    </button>

                    <SidebarContent
                      {...sidebarProps}
                      onNavClick={() => setMobileNavOpen(false)}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* ── Main ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

              {/* Header */}
              <header className="header-glass" style={{
                height: 60,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 20px 0 16px",
                position: "sticky", top: 0, zIndex: 30, flexShrink: 0,
                animation: "fadeInUp 0.25s ease both",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Hamburger — mobile only */}
                  <button
                    className="hamburger-btn"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open menu"
                    style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${sidebarBorder}`,
                      alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: primaryColor,
                      flexShrink: 0,
                    }}>
                    <Menu size={17} />
                  </button>

                  {/* Breadcrumb */}
                  <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {breadcrumb.map(({ label, href, isLast }) => (
                      <span key={href} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isLast
                          ? <span style={{ color: breadcrumbActive, fontSize: 13, fontWeight: 600 }}>{label}</span>
                          : <Link href={href} style={{ color: breadcrumbMuted, fontSize: 13, textDecoration: "none" }}>{label}</Link>}
                        {!isLast && <ChevronRight size={12} color={chevronColor} />}
                      </span>
                    ))}
                  </nav>

                  <CommandPaletteTrigger isDark={isDark} />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="header-date" style={{ color: dateColor, fontSize: 12 }}>
                    {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <ThemeToggle />
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setDrawerOpen(v => !v)}
                      style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: drawerOpen ? bellActiveBg  : bellBg,
                        border:     drawerOpen ? `1px solid ${bellActiveBorder}` : `1px solid ${bellBorder}`,
                        backdropFilter: "blur(8px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                        color: drawerOpen ? "#8FFFD6" : mutedColor,
                        transition: "all 0.15s",
                        boxShadow: drawerOpen ? "0 0 16px rgba(143,255,214,0.15)" : "none",
                      }}>
                      <Bell size={15} />
                    </button>
                    {unreadCount > 0 && (
                      <span style={{
                        position: "absolute", top: -2, right: -2,
                        minWidth: 16, height: 16, padding: "0 4px",
                        background: "#8FFFD6", borderRadius: 99,
                        fontSize: 9, fontWeight: 700, color: "#0a0a0a",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: `2px solid ${isDark ? "#0a0a0a" : "#F3F2F2"}`,
                        boxShadow: "0 0 8px rgba(143,255,214,0.4)",
                      }}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </header>

              {/* Page content */}
              <PageTransition pathname={pathname}>
                <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
              </PageTransition>
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
      </ToastProvider>
    </MarketProvider>
  );
}