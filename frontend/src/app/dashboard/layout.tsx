"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  PieChart,
  Star,
  BarChart2,
  Settings,
  Bell,
  TrendingUp,
  LogOut,
  ChevronRight,
  User,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/dashboard/watchlist", label: "Watchlist", icon: Star },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
];

const bottomItems = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [notifications] = useState(3);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    // Fetch user info
    fetch("http://127.0.0.1:8081/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.email) setUserEmail(data.email);
      })
      .catch(() => {});
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const userInitial = userEmail ? userEmail[0].toUpperCase() : "U";

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 bg-[#111111] border-r border-[#1f1f1f] hidden md:flex flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="p-5 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8FFFD6] flex items-center justify-center shrink-0">
              <TrendingUp size={15} className="text-black" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-base tracking-tight">StockSense</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[#444444] text-[10px] font-medium tracking-widest uppercase px-3 mb-3">
            Main Menu
          </p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                  active
                    ? "bg-[#8FFFD6]/10 text-[#8FFFD6]"
                    : "text-[#888888] hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#8FFFD6] rounded-r-full" />
                )}
                <Icon
                  size={16}
                  className={active ? "text-[#8FFFD6]" : "text-[#555555] group-hover:text-white transition-colors"}
                />
                {label}
                {active && (
                  <ChevronRight size={12} className="ml-auto text-[#8FFFD6] opacity-60" />
                )}
              </Link>
            );
          })}

          <div className="pt-4">
            <p className="text-[#444444] text-[10px] font-medium tracking-widest uppercase px-3 mb-3">
              Account
            </p>
            {bottomItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#888888] hover:text-white hover:bg-[#1a1a1a] transition-all duration-150"
              >
                <Icon size={16} className="text-[#555555]" />
                {label}
              </Link>
            ))}
          </div>
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-[#1f1f1f]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#1a1a1a] transition-colors cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-[#8FFFD6]/20 border border-[#8FFFD6]/30 flex items-center justify-center shrink-0">
              <span className="text-[#8FFFD6] text-xs font-semibold">{userInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {userEmail || "Loading..."}
              </p>
              <p className="text-[#555555] text-[10px]">Free plan</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-[#555555] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-[#1f1f1f]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-[#8FFFD6] flex items-center justify-center">
              <TrendingUp size={13} className="text-black" />
            </div>
            <span className="font-semibold text-sm">StockSense</span>
          </div>

          {/* Page title area — desktop */}
          <div className="hidden md:block">
            <nav className="flex items-center gap-2 text-sm text-[#555555]">
              <span>StockSense</span>
              <ChevronRight size={12} />
              <span className="text-white capitalize">
                {pathname === "/dashboard"
                  ? "Dashboard"
                  : pathname.split("/").pop() || "Dashboard"}
              </span>
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-xl bg-[#111111] border border-[#1f1f1f] flex items-center justify-center hover:border-[#333333] transition-colors">
              <Bell size={15} className="text-[#888888]" />
              {notifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#8FFFD6] rounded-full" />
              )}
            </button>

            <div className="w-9 h-9 rounded-xl bg-[#8FFFD6]/20 border border-[#8FFFD6]/30 flex items-center justify-center cursor-pointer hover:bg-[#8FFFD6]/30 transition-colors">
              <span className="text-[#8FFFD6] text-xs font-semibold">{userInitial}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}