"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Globe, User, Wallet, ChevronRight,
  Check, ArrowRight, Sparkles, BarChart2, Zap,
} from "lucide-react";
import { fetchWithAuth, getToken } from "@/lib/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#8FFFD6";
const ONBOARDED_KEY = "ss_onboarded";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "welcome" | "market" | "profile" | "deposit";

interface Market {
  id: string;
  label: string;
  flag: string;
  currency: string;
  description: string;
  examples: string[];
}

// ─── Markets ──────────────────────────────────────────────────────────────────

const MARKETS: Market[] = [
  {
    id: "US",
    label: "US Stocks",
    flag: "🇺🇸",
    currency: "$",
    description: "NYSE & NASDAQ — Apple, Tesla, NVIDIA",
    examples: ["AAPL", "TSLA", "NVDA"],
  },
  {
    id: "IN",
    label: "Indian Stocks",
    flag: "🇮🇳",
    currency: "₹",
    description: "NSE & BSE — Reliance, TCS, HDFC",
    examples: ["RELIANCE", "TCS", "INFY"],
  },
  {
    id: "CRYPTO",
    label: "Crypto",
    flag: "₿",
    currency: "$",
    description: "Bitcoin, Ethereum, Solana & more",
    examples: ["BTC", "ETH", "SOL"],
  },
  {
    id: "FX",
    label: "Forex",
    flag: "💱",
    currency: "",
    description: "Major currency pairs 24/5",
    examples: ["EUR/USD", "GBP/USD", "USD/JPY"],
  },
];

// ─── Noise texture ────────────────────────────────────────────────────────────

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: { id: Step; label: string }[] = [
  { id: "welcome", label: "Welcome"  },
  { id: "market",  label: "Market"   },
  { id: "profile", label: "Profile"  },
  { id: "deposit", label: "Deposit"  },
];

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginBottom: 32 }}>
      {STEPS.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width:        active ? 24 : done ? 20 : 8,
              height:       8,
              borderRadius: 99,
              background:   active ? ACCENT : done ? `${ACCENT}66` : "rgba(255,255,255,0.1)",
              transition:   "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            }} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Slide animation ──────────────────────────────────────────────────────────

const SLIDE = {
  initial: { opacity: 0, x: 40  },
  animate: { opacity: 1, x: 0   },
  exit:    { opacity: 0, x: -40 },
};

const TRANSITION = { type: "tween" as const, duration: 0.28 };

// ─── Step: Welcome ────────────────────────────────────────────────────────────

function WelcomeStep({ name, onNext }: { name: string; onNext: () => void }) {
  const features = [
    { icon: <BarChart2 size={15} />, label: "Real-time charts",    sub: "Candlestick, RSI, MACD" },
    { icon: <Sparkles  size={15} />, label: "AI-powered insights", sub: "ML signals on every stock" },
    { icon: <Zap       size={15} />, label: "Instant execution",   sub: "Market, limit & stop orders" },
    { icon: <Globe     size={15} />, label: "4 global markets",    sub: "US, India, Crypto, Forex" },
  ];

  return (
    <motion.div {...SLIDE} transition={TRANSITION} key="welcome">
      {/* Hero */}
      <div style={{
        position: "relative", borderRadius: 16, padding: "28px 24px", marginBottom: 24,
        background: "linear-gradient(135deg, rgba(143,255,214,0.08) 0%, rgba(0,200,150,0.04) 100%)",
        border: "1px solid rgba(143,255,214,0.2)", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: NOISE, backgroundSize: "160px" }} />
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${ACCENT}20, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#8FFFD6,#00c896)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, boxShadow: "0 0 24px rgba(143,255,214,0.3)" }}>
            <TrendingUp size={22} color="#0a0a0a" strokeWidth={2.5} />
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--color-primary)" }}>
            Welcome{name ? `, ${name.split(" ")[0]}` : ""}! 👋
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-muted)", lineHeight: 1.6 }}>
            You're all set. Let's get your StockSense account configured in under a minute.
          </p>
        </div>
      </div>

      {/* Features grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
        {features.map((f, i) => (
          <motion.div key={f.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
            style={{
              padding: "14px 16px", borderRadius: 12,
              background: "var(--color-card)", border: "1px solid var(--color-line)",
            }}
          >
            <div style={{ color: ACCENT, marginBottom: 8 }}>{f.icon}</div>
            <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>{f.label}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)" }}>{f.sub}</p>
          </motion.div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        onClick={onNext}
        style={{
          width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
          background: ACCENT, color: "#0a0a0a", fontWeight: 700, fontSize: 15,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
          boxShadow: "0 4px 20px rgba(143,255,214,0.25)",
        }}
      >
        Get started <ArrowRight size={16} />
      </motion.button>
    </motion.div>
  );
}

// ─── Step: Market ─────────────────────────────────────────────────────────────

function MarketStep({
  selected, onSelect, onNext, onBack,
}: {
  selected: string; onSelect: (id: string) => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <motion.div {...SLIDE} transition={TRANSITION} key="market">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(143,255,214,0.1)", border: "1px solid rgba(143,255,214,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Globe size={20} color={ACCENT} />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--color-primary)" }}>
          Choose your market
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>
          You can switch markets anytime from the sidebar.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {MARKETS.map((m, i) => {
          const isSelected = selected === m.id;
          return (
            <motion.button key={m.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
              whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(m.id)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 12, width: "100%",
                background: isSelected ? "rgba(143,255,214,0.07)" : "var(--color-card)",
                border: `1.5px solid ${isSelected ? ACCENT + "66" : "var(--color-line)"}`,
                cursor: "pointer", textAlign: "left",
                transition: "all 0.15s",
                fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{m.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>{m.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)" }}>{m.description}</p>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  {m.examples.map(ex => (
                    <span key={ex} style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: isSelected ? `${ACCENT}15` : "rgba(255,255,255,0.05)",
                      color: isSelected ? ACCENT : "var(--color-muted)",
                      border: `1px solid ${isSelected ? ACCENT + "22" : "transparent"}`,
                    }}>
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                background: isSelected ? ACCENT : "transparent",
                border: `2px solid ${isSelected ? ACCENT : "var(--color-line)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                {isSelected && <Check size={11} color="#0a0a0a" strokeWidth={3} />}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{
          flex: "0 0 auto", padding: "12px 20px", borderRadius: 12,
          border: "1px solid var(--color-line)", background: "transparent",
          color: "var(--color-muted)", cursor: "pointer", fontSize: 13, fontWeight: 600,
          fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
        }}>
          Back
        </button>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onNext} disabled={!selected}
          style={{
            flex: 1, padding: "12px 0", borderRadius: 12, border: "none",
            background: selected ? ACCENT : "rgba(143,255,214,0.2)",
            color: selected ? "#0a0a0a" : "rgba(143,255,214,0.4)",
            fontWeight: 700, fontSize: 14, cursor: selected ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            transition: "all 0.15s",
          }}
        >
          Continue <ChevronRight size={16} />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Step: Profile ────────────────────────────────────────────────────────────

function ProfileStep({
  name, onChangeName, onNext, onBack, saving,
}: {
  name: string; onChangeName: (v: string) => void;
  onNext: () => void; onBack: () => void; saving: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <motion.div {...SLIDE} transition={TRANSITION} key="profile">
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(143,255,214,0.1)", border: "1px solid rgba(143,255,214,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <User size={20} color={ACCENT} />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--color-primary)" }}>
          What should we call you?
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>
          This appears on your profile and leaderboard.
        </p>
      </div>

      {/* Avatar preview */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg,#8FFFD6,#00c896)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 800, color: "#0a0a0a",
          boxShadow: "0 0 24px rgba(143,255,214,0.25)",
        }}>
          {name ? name.trim().charAt(0).toUpperCase() : "?"}
        </div>
      </div>

      {/* Input */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-primary)", marginBottom: 8, letterSpacing: "0.01em" }}>
          Display Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => onChangeName(e.target.value)}
          placeholder="e.g. Parth Patel"
          autoFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 15,
            fontWeight: 500, boxSizing: "border-box" as const,
            background: "var(--color-card)",
            border: `1.5px solid ${focused ? ACCENT : "var(--color-line)"}`,
            boxShadow: focused ? "0 0 0 3px rgba(143,255,214,0.1)" : "none",
            color: "var(--color-primary)", outline: "none",
            fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--color-muted)" }}>
          You can change this later in Settings.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{
          flex: "0 0 auto", padding: "12px 20px", borderRadius: 12,
          border: "1px solid var(--color-line)", background: "transparent",
          color: "var(--color-muted)", cursor: "pointer", fontSize: 13, fontWeight: 600,
          fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
        }}>
          Back
        </button>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onNext} disabled={saving}
          style={{
            flex: 1, padding: "12px 0", borderRadius: 12, border: "none",
            background: ACCENT, color: "#0a0a0a", fontWeight: 700, fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            boxShadow: "0 4px 16px rgba(143,255,214,0.2)",
          }}
        >
          {saving ? "Saving…" : <><span>Continue</span><ChevronRight size={16} /></>}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Step: Deposit ────────────────────────────────────────────────────────────

function DepositStep({
  onDeposit, onSkip,
}: {
  onDeposit: () => void; onSkip: () => void;
}) {
  const amounts = ["₹1,000", "₹5,000", "₹10,000", "₹25,000"];
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <motion.div {...SLIDE} transition={TRANSITION} key="deposit">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(143,255,214,0.1)", border: "1px solid rgba(143,255,214,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Wallet size={20} color={ACCENT} />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--color-primary)" }}>
          Fund your account
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>
          Add funds to start trading. You can always do this later.
        </p>
      </div>

      {/* Quick amounts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {amounts.map(amt => (
          <motion.button key={amt}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setSelected(amt)}
            style={{
              padding: "14px 0", borderRadius: 10, border: `1.5px solid ${selected === amt ? ACCENT + "66" : "var(--color-line)"}`,
              background: selected === amt ? "rgba(143,255,214,0.07)" : "var(--color-card)",
              color: selected === amt ? ACCENT : "var(--color-primary)",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
              transition: "all 0.15s",
            }}
          >
            {amt}
          </motion.button>
        ))}
      </div>

      {/* Custom amount */}
      <div style={{ marginBottom: 24 }}>
        <input
          type="number" placeholder="Custom amount…"
          onChange={e => setSelected(e.target.value)}
          style={{
            width: "100%", padding: "11px 16px", borderRadius: 10, fontSize: 14,
            background: "var(--color-card)", border: "1.5px solid var(--color-line)",
            color: "var(--color-primary)", outline: "none", boxSizing: "border-box" as const,
            fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
          }}
        />
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(143,255,214,0.05)", border: "1px solid rgba(143,255,214,0.12)", marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)", lineHeight: 1.6 }}>
          💡 This is a demo trading platform. No real money is transferred. Deposits are simulated for practice.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onDeposit} disabled={!selected}
          style={{
            padding: "13px 0", borderRadius: 12, border: "none",
            background: selected ? ACCENT : "rgba(143,255,214,0.2)",
            color: selected ? "#0a0a0a" : "rgba(143,255,214,0.4)",
            fontWeight: 700, fontSize: 14,
            cursor: selected ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            transition: "all 0.15s",
          }}
        >
          <Wallet size={15} /> Add funds & go to dashboard
        </motion.button>
        <button onClick={onSkip} style={{
          padding: "11px 0", borderRadius: 12,
          border: "1px solid var(--color-line)", background: "transparent",
          color: "var(--color-muted)", cursor: "pointer", fontSize: 13, fontWeight: 600,
          fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
        }}>
          Skip for now → Go to dashboard
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main onboarding page ─────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const [step,         setStep]         = useState<Step>("welcome");
  const [selectedMkt,  setSelectedMkt]  = useState("US");
  const [displayName,  setDisplayName]  = useState("");
  const [saving,       setSaving]       = useState(false);
  const [userEmail,    setUserEmail]    = useState("");

  // Guard: redirect if not logged in or already onboarded
  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    const done = localStorage.getItem(ONBOARDED_KEY);
    if (done) { router.replace("/dashboard"); return; }

    // Prefill name from API
    fetchWithAuth("/api/users/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.name)  setDisplayName(data.name);
        if (data?.email) setUserEmail(data.email);
      })
      .catch(() => {});
  }, [router]);

  // Persist market choice to localStorage (MarketContext reads from "ss_market")
  const applyMarket = (id: string) => {
    localStorage.setItem("ss_market", id);
  };

  const handleFinish = () => {
    localStorage.setItem(ONBOARDED_KEY, "1");
    router.push("/dashboard");
  };

  const saveProfile = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await fetchWithAuth("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName.trim() }),
      });
    } catch { /* non-fatal */ }
    finally { setSaving(false); }
  };

  // Step handlers
  const goToMarket  = () => setStep("market");
  const goToProfile = () => { applyMarket(selectedMkt); setStep("profile"); };
  const goToDeposit = async () => { await saveProfile(); setStep("deposit"); };
  const goToWallet  = () => { handleFinish(); setTimeout(() => router.push("/dashboard/wallet"), 100); };
  const goToDash    = () => handleFinish();
  const backToWelcome  = () => setStep("welcome");
  const backToMarket   = () => setStep("market");
  const backToProfile  = () => setStep("profile");

  const cardBg = isDark ? "rgba(14,14,14,0.97)" : "rgba(252,252,252,0.98)";
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";

  return (
    <div style={{
      minHeight: "100vh",
      background: isDark ? "#0a0a0a" : "#F3F2F2",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
    }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
      `}</style>

      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Card */}
        <div style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 20, padding: "36px 32px",
          boxShadow: isDark
            ? "0 0 0 1px rgba(143,255,214,0.04), 0 32px 80px rgba(0,0,0,0.6)"
            : "0 8px 40px rgba(0,0,0,0.10)",
          animation: "fadeIn 0.3s ease both",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#8FFFD6,#00c896)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={14} color="#0a0a0a" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.02em" }}>StockSense</span>
          </div>

          <StepDots current={step} />

          <AnimatePresence mode="wait">
            {step === "welcome" && (
              <WelcomeStep
                name={displayName || userEmail.split("@")[0]}
                onNext={goToMarket}
              />
            )}
            {step === "market" && (
              <MarketStep
                selected={selectedMkt}
                onSelect={setSelectedMkt}
                onNext={goToProfile}
                onBack={backToWelcome}
              />
            )}
            {step === "profile" && (
              <ProfileStep
                name={displayName}
                onChangeName={setDisplayName}
                onNext={goToDeposit}
                onBack={backToMarket}
                saving={saving}
              />
            )}
            {step === "deposit" && (
              <DepositStep
                onDeposit={goToWallet}
                onSkip={goToDash}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", color: isDark ? "#333" : "#bbb", fontSize: 11, marginTop: 16 }}>
          StockSense · Demo trading platform · Not financial advice
        </p>
      </div>
    </div>
  );
}