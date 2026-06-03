"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithAuth } from "@/lib/auth";
import { useMarket } from "@/hooks/useMarket";
import {
  Trophy, Users, TrendingUp, TrendingDown, Search,
  Globe, Lock, Edit3, X, RefreshCw, Copy, CheckCircle,
  AlertCircle, Loader,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number; userId: string; username: string; name: string; bio: string;
  totalValue: number; totalPnl: number; returnPct: number; positions: number;
  allocation?: { label: string; pct: number }[];
}
interface PublicProfile {
  userId: string; username: string; name: string; bio: string;
  totalValue: number; totalPnlPct: number; positions: number;
  allocation?: { label: string; pct: number }[];
}
interface MyProfile {
  username: string; name: string; bio: string; publicProfile: boolean;
}
interface CopyResult {
  success: boolean;
  message: string;
  placed?: number;
  skipped?: number;
  totalSpent?: number;
  orders?: { symbol: string; quantity: number; price: number; total: number }[];
}

const APPLE = [0.22, 1, 0.36, 1] as const;
const C = {
  page: "var(--color-page)", card: "var(--color-card)",
  line: "var(--color-line)", primary: "var(--color-primary)",
  muted: "var(--color-muted)", hover: "var(--color-surface-hover)",
};
const SECTOR_COLORS = ["#8FFFD6", "#6366f1", "#f59e0b", "#ef4444", "#a855f7", "#0ea5e9"];
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: APPLE } } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const letter = name ? name[0].toUpperCase() : "?";
  const hue    = (name.charCodeAt(0) * 37) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue},60%,35%)`, border: `1px solid hsl(${hue},60%,50%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: `hsl(${hue},80%,80%)` }}>
      {letter}
    </div>
  );
}

// ── Rank badge ────────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  const medals: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: "rgba(255,215,0,0.15)",   color: "#FFD700", label: "🥇" },
    2: { bg: "rgba(192,192,192,0.15)", color: "#C0C0C0", label: "🥈" },
    3: { bg: "rgba(205,127,50,0.15)",  color: "#CD7F32", label: "🥉" },
  };
  const m = medals[rank];
  if (m) return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.bg, border: `1px solid ${m.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
      {m.label}
    </div>
  );
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.hover, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.muted, flexShrink: 0 }}>
      {rank}
    </div>
  );
}

// ── Mini allocation bar ───────────────────────────────────────────────────────
function AllocationBar({ allocation }: { allocation?: { label: string; pct: number }[] }) {
  if (!allocation?.length) return null;
  return (
    <div style={{ display: "flex", height: 4, borderRadius: 99, overflow: "hidden", gap: 1, marginTop: 6 }}>
      {allocation.map((a, i) => (
        <div key={a.label} style={{ width: `${a.pct}%`, background: SECTOR_COLORS[i % SECTOR_COLORS.length], borderRadius: 99 }} />
      ))}
    </div>
  );
}

// ── Copy Confirm Modal ────────────────────────────────────────────────────────
function CopyConfirmModal({ entry, currency, onClose, onSuccess }: {
  entry: LeaderboardEntry;
  currency: string;
  onClose: () => void;
  onSuccess: (result: CopyResult) => void;
}) {
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<CopyResult | null>(null);

  const execute = async () => {
    setLoading(true);
    try {
      const res  = await fetchWithAuth(`/api/community/copy/${entry.username}`, { method: "POST" });
      const data = await res.json();
      const r: CopyResult = res.ok
        ? { success: true, ...data }
        : { success: false, message: data.error || "Copy failed" };
      setResult(r);
      if (r.success) onSuccess(r);
    } catch {
      setResult({ success: false, message: "Network error — please try again" });
    } finally {
      setLoading(false);
    }
  };

  const up = entry.returnPct >= 0;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={!loading ? onClose : undefined}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease: APPLE }}
        style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16,
          padding: "28px 32px", width: 460, maxWidth: "calc(100vw - 32px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Copy size={16} color="#8FFFD6" />
            <h3 style={{ color: "#8FFFD6", fontWeight: 700, fontSize: 16, margin: 0 }}>Copy Portfolio</h3>
          </div>
          {!loading && (
            <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* ── Pre-confirm state ── */}
        {!result && (
          <>
            {/* Trader card */}
            <div style={{ background: C.page, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={entry.name || entry.username} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <p style={{ color: C.primary, fontWeight: 700, fontSize: 14, margin: 0 }}>{entry.name || "Anonymous"}</p>
                  {entry.username && <span style={{ color: C.muted, fontSize: 12 }}>@{entry.username}</span>}
                  <RankBadge rank={entry.rank} />
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    {currency}{entry.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                  <span style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 600 }}>
                    {up ? "+" : ""}{entry.returnPct.toFixed(2)}%
                  </span>
                  <span style={{ color: "#8FFFD6", fontSize: 12 }}>{entry.positions} positions</span>
                </div>
              </div>
            </div>

            {/* What will happen */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: C.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>What happens</p>
              {[
                "Each of their holdings is weighted by its share of the portfolio",
                "Those weights are applied to your current wallet balance",
                "MARKET BUY orders are placed for each position",
                "Your existing positions are not sold or changed",
              ].map((text, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 7, alignItems: "flex-start" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(143,255,214,0.12)", border: "1px solid rgba(143,255,214,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ color: "#8FFFD6", fontSize: 9, fontWeight: 700 }}>{i + 1}</span>
                  </div>
                  <p style={{ color: C.muted, fontSize: 12, margin: 0, lineHeight: 1.5 }}>{text}</p>
                </div>
              ))}
            </div>

            {/* Warning */}
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: "#f59e0b", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Copy trading involves risk. Past performance is not a guarantee of future results. Only invest what you can afford to lose.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={execute}
                disabled={loading}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: "#8FFFD6", color: "#0a0a0a", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <><Loader size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Placing orders…</> : <><Copy size={14} /> Copy @{entry.username}</>}
              </button>
            </div>
          </>
        )}

        {/* ── Result state ── */}
        {result && (
          <div style={{ textAlign: "center" }}>
            {result.success ? (
              <>
                <CheckCircle size={44} color="#22c55e" style={{ margin: "0 auto 16px" }} />
                <p style={{ color: C.primary, fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>Portfolio Copied!</p>
                <p style={{ color: C.muted, fontSize: 13, margin: "0 0 20px" }}>{result.message}</p>
                <div style={{ display: "flex", gap: 0, background: C.page, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 20 }}>
                  {[
                    { label: "Orders placed", value: String(result.placed ?? 0), color: "#22c55e" },
                    { label: "Skipped",        value: String(result.skipped ?? 0), color: C.muted },
                    { label: "Total spent",    value: `${currency}${Number(result.totalSpent ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, color: "#8FFFD6" },
                  ].map(({ label, value, color }, i) => (
                    <div key={label} style={{ flex: 1, padding: "12px 0", textAlign: "center", borderRight: i < 2 ? `1px solid ${C.line}` : "none" }}>
                      <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px" }}>{label}</p>
                      <p style={{ color, fontSize: 15, fontWeight: 700, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
                {result.orders && result.orders.length > 0 && (
                  <div style={{ background: C.page, border: `1px solid ${C.line}`, borderRadius: 10, padding: "4px 0", marginBottom: 20, maxHeight: 180, overflowY: "auto" }}>
                    {result.orders.map(o => (
                      <div key={o.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: `1px solid ${C.line}` }}>
                        <span style={{ color: "#8FFFD6", fontSize: 12, fontWeight: 700 }}>{o.symbol}</span>
                        <span style={{ color: C.muted, fontSize: 12 }}>{o.quantity} × {currency}{Number(o.price).toFixed(2)}</span>
                        <span style={{ color: C.primary, fontSize: 12, fontWeight: 600 }}>{currency}{Number(o.total).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <AlertCircle size={44} color="#ef4444" style={{ margin: "0 auto 16px" }} />
                <p style={{ color: C.primary, fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>Copy Failed</p>
                <p style={{ color: C.muted, fontSize: 13, margin: "0 0 20px" }}>{result.message}</p>
              </>
            )}
            <button
              onClick={onClose}
              style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
            >
              Close
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Profile Edit Modal ────────────────────────────────────────────────────────
function ProfileEditModal({ profile, onClose, onSave }: {
  profile: MyProfile; onClose: () => void;
  onSave: (updated: MyProfile) => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [bio,      setBio]      = useState(profile.bio);
  const [name,     setName]     = useState(profile.name);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const save = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetchWithAuth("/api/community/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, bio, name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      onSave({ ...profile, username: data.username, bio: data.bio, name: data.name });
      onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease: APPLE }}
        style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 32px", width: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ color: C.primary, fontWeight: 700, fontSize: 16, margin: 0 }}>Edit Public Profile</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={16} /></button>
        </div>
        {[
          { label: "Display Name", value: name, set: setName, placeholder: "Your name" },
          { label: "Username (@handle)", value: username, set: setUsername, placeholder: "e.g. parth_trades" },
        ].map(({ label, value, set, placeholder }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>{label}</label>
            <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
              style={{ width: "100%", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, color: C.primary, fontSize: 13, padding: "10px 14px", outline: "none", boxSizing: "border-box" }} />
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Bio (max 200 chars)</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell the community about your strategy…" rows={3}
            style={{ width: "100%", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, color: C.primary, fontSize: 13, padding: "10px 14px", outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit" }} />
          <p style={{ color: C.muted, fontSize: 10, margin: "4px 0 0", textAlign: "right" }}>{bio.length}/200</p>
        </div>
        {error && <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={save} disabled={loading} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#8FFFD6", color: "#0a0a0a", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { market } = useMarket();
  const currency   = market.currency || "$";

  const [tab,          setTab]          = useState<"leaderboard" | "profiles">("leaderboard");
  const [sortBy,       setSortBy]       = useState<"returnPct" | "totalValue" | "positions">("returnPct");
  const [leaderboard,  setLeaderboard]  = useState<LeaderboardEntry[]>([]);
  const [profiles,     setProfiles]     = useState<PublicProfile[]>([]);
  const [myProfile,    setMyProfile]    = useState<MyProfile | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [editOpen,     setEditOpen]     = useState(false);
  const [togglingVis,  setTogglingVis]  = useState(false);
  const [copyTarget,   setCopyTarget]   = useState<LeaderboardEntry | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lbRes, pfRes, meRes] = await Promise.all([
        fetchWithAuth(`/api/community/leaderboard?sort=${sortBy}&limit=50`),
        fetchWithAuth("/api/community/profiles"),
        fetchWithAuth("/api/community/me"),
      ]);
      if (lbRes.ok) { const d = await lbRes.json(); setLeaderboard(d.leaderboard ?? []); }
      if (pfRes.ok) setProfiles(await pfRes.json());
      if (meRes.ok) setMyProfile(await meRes.json());
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [sortBy]);

  const toggleVisibility = async () => {
    if (!myProfile) return;
    setTogglingVis(true);
    try {
      const res = await fetchWithAuth("/api/community/profile/visibility", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: !myProfile.publicProfile }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyProfile(p => p ? { ...p, publicProfile: data.publicProfile } : p);
        loadData();
      }
    } catch { /* non-fatal */ }
    finally { setTogglingVis(false); }
  };

  const filteredLeaderboard = leaderboard.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.username.toLowerCase().includes(search.toLowerCase())
  );
  const filteredProfiles = profiles.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  // Is this leaderboard entry the current user?
  const isMe = (entry: LeaderboardEntry) =>
    myProfile?.username && entry.username === myProfile.username;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)", background: C.page, minHeight: "100vh" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: APPLE }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Users size={20} color="#8FFFD6" />
            <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Community</h1>
          </div>
          <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>Discover top traders · compare strategies · get inspired</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} onClick={loadData}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </motion.button>
          {myProfile && (
            <>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setEditOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                <Edit3 size={13} /> Edit Profile
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={toggleVisibility} disabled={togglingVis}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: `1px solid ${myProfile.publicProfile ? "rgba(34,197,94,0.4)" : C.line}`, background: myProfile.publicProfile ? "rgba(34,197,94,0.08)" : "transparent", color: myProfile.publicProfile ? "#22c55e" : C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                {myProfile.publicProfile ? <Globe size={13} /> : <Lock size={13} />}
                {myProfile.publicProfile ? "Public" : "Private"}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      {/* My profile banner */}
      {myProfile && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: APPLE }}
          style={{ background: C.card, border: `1px solid ${myProfile.publicProfile ? "rgba(34,197,94,0.3)" : C.line}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={myProfile.name || myProfile.username || "?"} size={44} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ color: C.primary, fontWeight: 700, fontSize: 14, margin: 0 }}>{myProfile.name || "Set your name"}</p>
              {myProfile.username && <span style={{ color: C.muted, fontSize: 12 }}>@{myProfile.username}</span>}
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: myProfile.publicProfile ? "rgba(34,197,94,0.12)" : "rgba(99,102,241,0.12)", color: myProfile.publicProfile ? "#22c55e" : "#6366f1", border: `1px solid ${myProfile.publicProfile ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.3)"}` }}>
                {myProfile.publicProfile ? "Public" : "Private"}
              </span>
            </div>
            <p style={{ color: C.muted, fontSize: 12, margin: "3px 0 0" }}>
              {myProfile.bio || "Add a bio to tell the community about your trading strategy"}
            </p>
          </div>
          {!myProfile.publicProfile && (
            <p style={{ color: C.muted, fontSize: 11, maxWidth: 180, textAlign: "right" }}>
              Make your portfolio public to appear in the community
            </p>
          )}
        </motion.div>
      )}

      {/* Search + tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={14} color="var(--color-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search traders…"
            style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, color: C.primary, fontSize: 13, padding: "10px 14px 10px 36px", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 2, background: C.line, borderRadius: 10, padding: 3 }}>
          {(["leaderboard", "profiles"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, background: tab === t ? C.card : "transparent", color: tab === t ? "#8FFFD6" : C.muted, textTransform: "capitalize" }}>
              {t === "leaderboard" ? "🏆 Leaderboard" : "👥 All Profiles"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Leaderboard Tab ── */}
      {tab === "leaderboard" && (
        <>
          {/* Sort controls */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <span style={{ color: C.muted, fontSize: 12, alignSelf: "center" }}>Sort by:</span>
            {[
              { key: "returnPct",   label: "Return %" },
              { key: "totalValue",  label: "Portfolio Value" },
              { key: "positions",   label: "Positions" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setSortBy(key as typeof sortBy)}
                style={{ padding: "5px 14px", borderRadius: 8, border: `1px solid ${sortBy === key ? "#8FFFD6" : C.line}`, background: sortBy === key ? "#8FFFD618" : "transparent", color: sortBy === key ? "#8FFFD6" : C.muted, cursor: "pointer", fontSize: 12, fontWeight: sortBy === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ color: C.muted, fontSize: 13 }}>Loading leaderboard…</p>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div style={{ padding: 52, textAlign: "center", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14 }}>
              <p style={{ fontSize: 32, margin: "0 0 12px" }}>🏆</p>
              <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No public portfolios yet</p>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Be the first! Make your portfolio public to appear here.</p>
            </div>
          ) : (
            <motion.div initial="hidden" animate="visible" variants={stagger}>
              {filteredLeaderboard.map((entry) => {
                const up   = entry.returnPct >= 0;
                const mine = isMe(entry);
                return (
                  <motion.div key={entry.userId} variants={fadeUp}
                    style={{ background: C.card, border: `1px solid ${entry.rank <= 3 ? "rgba(255,215,0,0.2)" : C.line}`, borderRadius: 14, padding: "16px 20px", marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
                    <RankBadge rank={entry.rank} />
                    <Avatar name={entry.name || entry.username} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ color: C.primary, fontWeight: 700, fontSize: 14, margin: 0 }}>{entry.name || "Anonymous"}</p>
                        {entry.username && <span style={{ color: C.muted, fontSize: 11 }}>@{entry.username}</span>}
                        {mine && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)" }}>You</span>
                        )}
                      </div>
                      {entry.bio && <p style={{ color: C.muted, fontSize: 11, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.bio}</p>}
                      <AllocationBar allocation={entry.allocation} />
                    </div>
                    <div style={{ display: "flex", gap: 20, flexShrink: 0, alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: C.muted, fontSize: 10, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 0.5 }}>Value</p>
                        <p style={{ color: C.primary, fontSize: 14, fontWeight: 700, margin: 0 }}>{currency}{entry.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: C.muted, fontSize: 10, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 0.5 }}>Return</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {up ? <TrendingUp size={13} color="#22c55e" /> : <TrendingDown size={13} color="#ef4444" />}
                          <p style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 14, fontWeight: 700, margin: 0 }}>
                            {up ? "+" : ""}{entry.returnPct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: C.muted, fontSize: 10, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 0.5 }}>Positions</p>
                        <p style={{ color: "#8FFFD6", fontSize: 14, fontWeight: 700, margin: 0 }}>{entry.positions}</p>
                      </div>
                      {/* Copy button — hidden for own entry */}
                      {!mine && entry.username && (
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => setCopyTarget(entry)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(143,255,214,0.35)", background: "rgba(143,255,214,0.07)", color: "#8FFFD6", cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}
                        >
                          <Copy size={12} /> Copy
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </>
      )}

      {/* ── All Profiles Tab ── */}
      {tab === "profiles" && (
        <>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ color: C.muted, fontSize: 13 }}>Loading profiles…</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div style={{ padding: 52, textAlign: "center", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14 }}>
              <p style={{ fontSize: 32, margin: "0 0 12px" }}>👥</p>
              <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No public profiles yet</p>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Make your portfolio public to connect with the community.</p>
            </div>
          ) : (
            <motion.div initial="hidden" animate="visible" variants={stagger}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {filteredProfiles.map(profile => {
                const up = profile.totalPnlPct >= 0;
                return (
                  <motion.div key={profile.userId} variants={fadeUp}
                    whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", transition: { duration: 0.18 } }}
                    style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <Avatar name={profile.name || profile.username} size={42} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: C.primary, fontWeight: 700, fontSize: 14, margin: 0 }}>{profile.name || "Anonymous"}</p>
                        {profile.username && <p style={{ color: C.muted, fontSize: 11, margin: "2px 0 0" }}>@{profile.username}</p>}
                      </div>
                    </div>
                    {profile.bio && (
                      <p style={{ color: C.muted, fontSize: 12, margin: "0 0 12px", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{profile.bio}</p>
                    )}
                    <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                      {[
                        { label: "Value",     value: `${currency}${profile.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: C.primary },
                        { label: "Return",    value: `${up ? "+" : ""}${profile.totalPnlPct.toFixed(2)}%`, color: up ? "#22c55e" : "#ef4444" },
                        { label: "Positions", value: String(profile.positions), color: "#8FFFD6" },
                      ].map(({ label, value, color }, i) => (
                        <div key={label} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? `1px solid ${C.line}` : "none" }}>
                          <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 3px" }}>{label}</p>
                          <p style={{ color, fontSize: 13, fontWeight: 700, margin: 0 }}>{value}</p>
                        </div>
                      ))}
                    </div>
                    <AllocationBar allocation={profile.allocation} />
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {editOpen && myProfile && (
          <ProfileEditModal profile={myProfile} onClose={() => setEditOpen(false)}
            onSave={updated => { setMyProfile(updated); loadData(); }} />
        )}
        {copyTarget && (
          <CopyConfirmModal
            entry={copyTarget}
            currency={currency}
            onClose={() => setCopyTarget(null)}
            onSuccess={() => { /* result shown inside modal; close on user action */ }}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}