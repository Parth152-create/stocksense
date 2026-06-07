"use client";

import { useState, useEffect } from "react";
import {
  User, Mail, Lock, Bell, MessageSquare,
  Eye, EyeOff, ShieldCheck, CreditCard, AlertTriangle,
  Key, Plus, Trash2, Copy, Check, Terminal,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";
import { useToast } from "@/components/ToastContext";

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  hover:   "var(--color-surface-hover)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
};

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", padding: 3, background: checked ? "linear-gradient(135deg,#8FFFD6,#00c896)" : "var(--color-line)", transition: "background 0.3s", display: "flex", alignItems: "center", justifyContent: checked ? "flex-end" : "flex-start", flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: checked ? "#0a0a0a" : "var(--color-muted)", transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
    </button>
  );
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px", ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, label, danger = false }: { icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      <div style={{ color: danger ? "#ef4444" : "#8FFFD6" }}>{icon}</div>
      <span style={{ color: danger ? "#ef4444" : C.primary, fontWeight: 700, fontSize: 14 }}>{label}</span>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder, rightEl, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; rightEl?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", color: C.muted, fontSize: 12, marginBottom: 6, fontWeight: 500 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input type={type} value={value} placeholder={placeholder} disabled={disabled}
          onChange={e => onChange(e.target.value)}
          style={{ width: "100%", background: disabled ? C.hover : C.page, border: `1px solid ${C.line}`, borderRadius: 9, color: C.primary, fontSize: 14, padding: rightEl ? "10px 40px 10px 14px" : "10px 14px", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s", fontFamily: "inherit", opacity: disabled ? 0.6 : 1 }}
          onFocus={e => { if (!disabled) e.target.style.borderColor = "#8FFFD6"; }}
          onBlur={e => (e.target.style.borderColor = "var(--color-line)")} />
        {rightEl && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>{rightEl}</div>}
      </div>
    </div>
  );
}

function NotifRow({ icon, label, checked, onChange, last = false }: {
  icon: React.ReactNode; label: string; checked: boolean; onChange: () => void; last?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ color: C.muted }}>{icon}</div>
        <span style={{ color: C.primary, fontSize: 13 }}>{label}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function ProfileAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#8FFFD6,#00c896)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#0a0a0a", flexShrink: 0, border: `3px solid ${C.line}` }}>
      {initials}
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" }); }
  catch { return "—"; }
}

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

function ApiKeysSection() {
  const { toast } = useToast();
  const [keys,        setKeys]        = useState<ApiKeyRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [newKeyName,  setNewKeyName]  = useState("");
  const [creating,    setCreating]    = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: string; raw: string } | null>(null);
  const [copied,      setCopied]      = useState(false);
  const [revoking,    setRevoking]    = useState<string | null>(null);

  const loadKeys = async () => {
    try {
      const res = await fetchWithAuth("/api/keys");
      if (res.ok) setKeys(await res.json());
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { loadKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res  = await fetchWithAuth("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newKeyName.trim() }) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to create key", "error"); return; }
      setRevealedKey({ id: data.id, raw: data.key });
      setNewKeyName(""); setShowCreate(false);
      await loadKeys();
    } catch { toast("Network error", "error"); }
    finally { setCreating(false); }
  };

  const handleRevoke = async (id: string, name: string) => {
    setRevoking(id);
    try {
      const res = await fetchWithAuth(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok) { toast(`"${name}" revoked`, "info"); setKeys(prev => prev.filter(k => k.id !== id)); if (revealedKey?.id === id) setRevealedKey(null); }
      else toast("Failed to revoke key", "error");
    } catch { toast("Network error", "error"); }
    finally { setRevoking(null); }
  };

  const handleCopy = async () => {
    if (!revealedKey) return;
    try { await navigator.clipboard.writeText(revealedKey.raw); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { }
  };

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Terminal size={14} color="#8FFFD6" />
          <span style={{ color: C.primary, fontWeight: 700, fontSize: 14 }}>API Keys</span>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${showCreate ? "#8FFFD6" : C.line}`, background: showCreate ? "rgba(143,255,214,0.08)" : "transparent", color: showCreate ? "#8FFFD6" : C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          <Plus size={12} /> New Key
        </button>
      </div>

      <div style={{ background: C.hover, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
        <p style={{ color: C.muted, fontSize: 11, margin: 0, lineHeight: 1.6 }}>
          Use API keys for programmatic access. Send in the{" "}
          <code style={{ color: "#8FFFD6", background: "rgba(143,255,214,0.1)", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>X-API-Key</code>{" "}
          header. Rate limited to <strong style={{ color: C.primary }}>60 req/min</strong>. Max 10 keys.
        </p>
      </div>

      {showCreate && (
        <div style={{ background: C.page, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <label style={{ display: "block", color: C.muted, fontSize: 12, marginBottom: 6, fontWeight: 500 }}>Key Name</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="e.g. My trading bot" autoFocus
              style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, color: C.primary, fontSize: 13, padding: "9px 12px", outline: "none", fontFamily: "inherit" }} />
            <button onClick={handleCreate} disabled={creating || !newKeyName.trim()}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: creating || !newKeyName.trim() ? C.hover : "#8FFFD6", color: creating || !newKeyName.trim() ? C.muted : "#0a0a0a", cursor: creating || !newKeyName.trim() ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13 }}>
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {revealedKey && (
        <div style={{ background: "rgba(143,255,214,0.06)", border: "1px solid rgba(143,255,214,0.25)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Key size={12} color="#8FFFD6" />
            <span style={{ color: "#8FFFD6", fontSize: 11, fontWeight: 700 }}>Copy your key now — it won't be shown again</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ flex: 1, background: C.page, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 12px", fontSize: 11, color: C.primary, wordBreak: "break-all", fontFamily: "monospace" }}>
              {revealedKey.raw}
            </code>
            <button onClick={handleCopy}
              style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 8, border: `1px solid ${copied ? "rgba(143,255,214,0.4)" : C.line}`, background: copied ? "rgba(143,255,214,0.1)" : "transparent", color: copied ? "#8FFFD6" : C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          {copied && <p style={{ color: "#8FFFD6", fontSize: 10, margin: "6px 0 0" }}>Copied!</p>}
          <button onClick={() => setRevealedKey(null)} style={{ marginTop: 10, background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", padding: 0 }}>
            I've saved it — dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2].map(i => <div key={i} style={{ height: 52, borderRadius: 8, background: C.hover, opacity: 0.5 }} />)}
        </div>
      ) : keys.length === 0 ? (
        <div style={{ padding: "24px 0", textAlign: "center" }}>
          <Key size={24} color="var(--color-line)" style={{ margin: "0 auto 8px", display: "block" }} />
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No API keys yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {keys.map(k => (
            <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, background: C.hover, border: `1px solid ${C.line}` }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(143,255,214,0.1)", border: "1px solid rgba(143,255,214,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Key size={13} color="#8FFFD6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>{k.name}</p>
                <p style={{ color: C.muted, fontSize: 10, margin: "2px 0 0" }}>
                  <code style={{ color: "#8FFFD6", fontSize: 10 }}>{k.keyPrefix}</code>
                  {" · "}Created {formatDate(k.createdAt)}
                  {" · "}Last used: {formatDateTime(k.lastUsedAt)}
                </p>
              </div>
              <button onClick={() => handleRevoke(k.id, k.name)} disabled={revoking === k.id}
                style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: revoking === k.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: revoking === k.id ? 0.5 : 1 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {keys.length > 0 && (
        <div style={{ marginTop: 14, background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 14px" }}>
          <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px", fontWeight: 600 }}>Example</p>
          <code style={{ color: "#8FFFD6", fontSize: 11, fontFamily: "monospace" }}>
            curl -H "X-API-Key: ss_live_..." https://yourapp.com/api/v1/stocks/AAPL
          </code>
        </div>
      )}
    </SectionCard>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [provider,   setProvider]   = useState("local");
  const [createdAt,  setCreatedAt]  = useState("");
  const [loadingMe,  setLoadingMe]  = useState(true);
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showCurrPw, setShowCurrPw] = useState(false);
  const [showNewPw,  setShowNewPw]  = useState(false);
  const [pwLoading,  setPwLoading]  = useState(false);
  const [priceAlerts,   setPriceAlerts]   = useState(true);
  const [txEmails,      setTxEmails]      = useState(true);
  const [newsDigest,    setNewsDigest]    = useState(false);
  const [marketSummary, setMarketSummary] = useState(true);
  const [twoFA,             setTwoFA]             = useState(false);
  const [savingProfile,     setSavingProfile]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword,    setDeletePassword]    = useState("");
  const [deleteLoading,     setDeleteLoading]     = useState(false);

  useEffect(() => {
    fetchWithAuth("/api/users/me")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setName(data.name || ""); setEmail(data.email || ""); setProvider(data.provider || "local"); setCreatedAt(data.createdAt || ""); })
      .catch(() => {})
      .finally(() => setLoadingMe(false));
  }, []);

  useEffect(() => {
    fetchWithAuth("/api/notifications/preferences")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setPriceAlerts(data.prefPriceAlerts ?? true); setTxEmails(data.prefTransactionEmails ?? true); setNewsDigest(data.prefMentMessages ?? false); })
      .catch(() => {});
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetchWithAuth("/api/users/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
      if (res.ok) toast("Profile updated successfully", "success");
      else { const err = await res.json().catch(() => ({})); toast((err as any).error || "Failed to update profile", "error"); }
    } catch { toast("Network error", "error"); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) { toast("Please fill all password fields", "error"); return; }
    if (newPw !== confirmPw) { toast("New passwords do not match", "error"); return; }
    if (newPw.length < 8) { toast("Password must be at least 8 characters", "error"); return; }
    setPwLoading(true);
    try {
      const res = await fetchWithAuth("/api/users/me/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { toast("Password changed successfully", "success"); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
      else toast((data as any).error || "Failed to change password", "error");
    } catch { toast("Network error", "error"); }
    finally { setPwLoading(false); }
  };

  const toggleAndSave = async (setter: React.Dispatch<React.SetStateAction<boolean>>, current: boolean, key: string) => {
    const next = !current; setter(next);
    try {
      await fetchWithAuth("/api/notifications/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefPriceAlerts: key === "priceAlerts" ? next : priceAlerts, prefTransactionEmails: key === "txEmails" ? next : txEmails, prefMentMessages: key === "newsDigest" ? next : newsDigest }) });
      toast("Preferences updated", "success");
    } catch { toast("Failed to save", "error"); }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) { toast("Enter your password to confirm", "error"); return; }
    setDeleteLoading(true);
    try {
      const res = await fetchWithAuth("/api/users/me", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePassword }) });
      if (res.ok) { toast("Account deleted", "info"); sessionStorage.removeItem("access_token"); window.location.href = "/login"; }
      else { const err = await res.json().catch(() => ({})); toast((err as any).error || "Incorrect password", "error"); }
    } catch { toast("Network error", "error"); }
    finally { setDeleteLoading(false); }
  };

  const isOAuth = provider !== "local";
  const btnStyle = (loading: boolean, danger = false) => ({
    width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
    cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13,
    background: loading ? C.hover : danger ? "#ef4444" : "linear-gradient(135deg,#8FFFD6,#00c896)",
    color: loading ? C.muted : danger ? "#fff" : "#0a0a0a",
    opacity: loading ? 0.7 : 1, transition: "all 0.2s",
  });

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        input::placeholder { color: var(--color-muted); }
        .settings-grid { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
        @media (max-width: 768px) { .settings-grid { grid-template-columns: 1fr; } }
        .settings-banner { flex-wrap: nowrap; }
        @media (max-width: 480px) { .settings-banner { flex-wrap: wrap; gap: 12px; } }
      `}</style>

      <div style={{ padding: "16px", maxWidth: 1100, margin: "0 auto", animation: "fadeInUp 0.4s ease", background: C.page, minHeight: "100vh", boxSizing: "border-box" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.primary, margin: "0 0 4px" }}>Settings</h1>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Manage your account, security, and notification preferences</p>
        </div>

        <div className="settings-banner" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
          {loadingMe ? <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.hover, flexShrink: 0 }} /> : <ProfileAvatar name={name || email} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loadingMe ? "Loading…" : (name || email.split("@")[0] || "—")}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
          </div>
          <span style={{ fontSize: 10, color: "#8FFFD6", background: "rgba(143,255,214,0.08)", border: "1px solid rgba(143,255,214,0.2)", borderRadius: 6, padding: "3px 8px", fontWeight: 600, flexShrink: 0 }}>
            {isOAuth ? provider.charAt(0).toUpperCase() + provider.slice(1) + " OAuth" : "Local"}
          </span>
        </div>

        <div className="settings-grid" style={{ display: "grid", gap: 14 }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionCard>
              <SectionTitle icon={<User size={14} />} label="Personal Information" />
              <InputField label="Full Name" value={name} onChange={setName} placeholder="Your full name" />
              <InputField label="Email Address" value={email} onChange={setEmail} placeholder="your@email.com" type="email" disabled={isOAuth} />
              {isOAuth && <p style={{ color: C.muted, fontSize: 11, marginTop: -8, marginBottom: 10 }}>Email is managed by your {provider} account.</p>}
              <button onClick={handleSaveProfile} disabled={savingProfile} style={btnStyle(savingProfile)}>{savingProfile ? "Saving…" : "Save Profile"}</button>
            </SectionCard>

            <SectionCard>
              <SectionTitle icon={<Bell size={14} />} label="Notification Preferences" />
              <NotifRow icon={<Bell size={14} />}          label="Price Alerts"       checked={priceAlerts}   onChange={() => toggleAndSave(setPriceAlerts, priceAlerts, "priceAlerts")} />
              <NotifRow icon={<Mail size={14} />}          label="Transaction Emails" checked={txEmails}      onChange={() => toggleAndSave(setTxEmails, txEmails, "txEmails")} />
              <NotifRow icon={<MessageSquare size={14} />} label="News Digest"        checked={newsDigest}    onChange={() => toggleAndSave(setNewsDigest, newsDigest, "newsDigest")} />
              <NotifRow icon={<CreditCard size={14} />}    label="Market Summary"     checked={marketSummary} onChange={() => setMarketSummary(!marketSummary)} last />
            </SectionCard>

            <ApiKeysSection />
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionCard>
              <SectionTitle icon={<Lock size={14} />} label="Change Password" />
              {isOAuth ? <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6 }}>You signed in with {provider}. Password management is handled by your OAuth provider.</p> : (
                <>
                  <InputField label="Current Password" value={currentPw} onChange={setCurrentPw} type={showCurrPw ? "text" : "password"} placeholder="Enter current password" rightEl={<button onClick={() => setShowCurrPw(!showCurrPw)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 0, display: "flex" }}>{showCurrPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>} />
                  <InputField label="New Password" value={newPw} onChange={setNewPw} type={showNewPw ? "text" : "password"} placeholder="Min 8 characters" rightEl={<button onClick={() => setShowNewPw(!showNewPw)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 0, display: "flex" }}>{showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>} />
                  <InputField label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Re-enter new password" />
                  {newPw && confirmPw && newPw !== confirmPw && <p style={{ color: "#ef4444", fontSize: 11, marginTop: -8, marginBottom: 10 }}>Passwords do not match</p>}
                  <button onClick={handleChangePassword} disabled={pwLoading} style={btnStyle(pwLoading)}>{pwLoading ? "Updating…" : "Change Password"}</button>
                </>
              )}
            </SectionCard>

            <SectionCard>
              <SectionTitle icon={<ShieldCheck size={14} />} label="Security" />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, borderBottom: `1px solid ${C.line}`, marginBottom: 14 }}>
                <div>
                  <div style={{ color: C.primary, fontSize: 13, fontWeight: 500 }}>Two-Factor Authentication</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Add an extra layer of security</div>
                </div>
                <Toggle checked={twoFA} onChange={() => { setTwoFA(!twoFA); toast(!twoFA ? "2FA enabled" : "2FA disabled", !twoFA ? "success" : "info"); }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[{ label: "Last login", value: "Today" }, { label: "Active sessions", value: "1 device" }, { label: "Account created", value: formatDate(createdAt) }].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 12 }}>{label}</span>
                    <span style={{ color: C.primary, fontSize: 12, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard>
              <SectionTitle icon={<AlertTriangle size={14} />} label="Danger Zone" danger />
              <p style={{ color: C.muted, fontSize: 13, margin: "0 0 14px", lineHeight: 1.6 }}>Permanently delete your account and all associated data. This cannot be undone.</p>
              {!showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "rgba(239,68,68,0.06)", color: "#ef4444", transition: "all 0.2s" }}>Delete Account</button>
              ) : (
                <div>
                  <p style={{ color: "#ef4444", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Enter your password to confirm:</p>
                  <InputField label="Password" value={deletePassword} onChange={setDeletePassword} type="password" placeholder="Your current password" />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
                    <button onClick={handleDeleteAccount} disabled={deleteLoading} style={{ ...btnStyle(deleteLoading, true), flex: 1, width: "auto" }}>{deleteLoading ? "Deleting…" : "Yes, Delete"}</button>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </>
  );
}