"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8081/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Invalid email or password.");
        return;
      }

      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen flex bg-[#0a0a0a] text-white">
      {/* Left Panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#111111] border-r border-[#1f1f1f] p-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#8FFFD6] flex items-center justify-center">
            <TrendingUp size={16} className="text-black" />
          </div>
          <span className="font-semibold text-lg tracking-tight">StockSense</span>
        </div>

        <div>
          <p className="text-[#8FFFD6] text-sm font-medium mb-4 tracking-widest uppercase">
            Portfolio Intelligence
          </p>
          <h1 className="text-5xl font-bold leading-tight text-white mb-6">
            Track. Analyze.<br />Outperform.
          </h1>
          <p className="text-[#888888] text-base leading-relaxed max-w-sm">
            Real-time portfolio tracking with AI-powered insights. Know exactly where your money stands, every moment.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-4">
            {[
              { label: "Total Buy Volume", value: "$1.18M" },
              { label: "Trading Points", value: "6,280" },
              { label: "Active Positions", value: "12" },
              { label: "Win Rate", value: "74%" },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f]">
                <p className="text-[#888888] text-xs mb-1">{stat.label}</p>
                <p className="text-white font-semibold text-lg">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[#444444] text-sm">© 2025 StockSense. All rights reserved.</p>
      </div>

      {/* Right Panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-[#8FFFD6] flex items-center justify-center">
              <TrendingUp size={16} className="text-black" />
            </div>
            <span className="font-semibold text-lg">StockSense</span>
          </div>

          <h2 className="text-3xl font-bold mb-2">Welcome back</h2>
          <p className="text-[#888888] mb-8 text-sm">
            Don't have an account?{" "}
            <Link href="/register" className="text-[#8FFFD6] hover:underline">
              Sign up
            </Link>
          </p>

          {error && (
            <div className="mb-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#888888] mb-2">Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-[#1f1f1f] text-white placeholder-[#444444] focus:outline-none focus:border-[#8FFFD6] transition-colors text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm text-[#888888]">Password</label>
                <button className="text-sm text-[#8FFFD6] hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-[#1f1f1f] text-white placeholder-[#444444] focus:outline-none focus:border-[#8FFFD6] transition-colors text-sm pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444444] hover:text-[#888888] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full mt-6 py-3 rounded-xl bg-[#8FFFD6] hover:bg-[#6ee8bc] text-black font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <Zap size={15} />
                Sign In
              </>
            )}
          </button>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-[#1f1f1f]" />
            <span className="text-[#444444] text-xs">or</span>
            <div className="flex-1 h-px bg-[#1f1f1f]" />
          </div>

          <button className="w-full mt-4 py-3 rounded-xl border border-[#1f1f1f] bg-[#111111] hover:border-[#333333] text-white text-sm font-medium transition-colors flex items-center justify-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}