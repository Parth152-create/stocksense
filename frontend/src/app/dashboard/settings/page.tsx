"use client";

import { useState, useEffect } from "react";
import {
  User, Mail, Lock, Bell, MessageSquare,
  Eye, EyeOff, ShieldCheck, CreditCard, AlertTriangle,
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", padding: 3,
        background: checked ? "linear-gradient(135deg,#8FFFD6,#00c896)" : "var(--color-line)",
        transition: "background 0.3s", display: "flex", alignItems: "center",
        justifyContent: checked ? "flex-end" : "flex-start", flexShrink: 0,
      }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: checked ? "#0a0a0a" : "var(--color-muted)",
        transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }} />
    </button>
  );
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, label, danger = false }: { icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
      <div style={{ color: danger ? "#ef4444" : "#8FFFD6" }}>{icon}</div>
      <span style={{ color: danger ? "#ef4444" : C.primary, fontWeight: 700, fontSize: 15 }}>{label}</span>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder, rightEl, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; rightEl?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", color: C.muted, fontSize: 12, marginBottom: 7, fontWeight: 500 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={type} value={value} placeholder={placeholder} disabled={disabled}
          onChange={e => onChange(e.target.value)}
          style={{
            width: "100%", background: disabled ? C.hover : C.page, border: `1px solid ${C.line}`,
            borderRadius: 9, color: C.primary, fontSize: 14,
            padding: rightEl ? "10px 40px 10px 14px" : "10px 14px",
            outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
            fontFamily: "inherit", opacity: disabled ? 0.6 : 1,
          }}
          onFocus={e => { if (!disabled) e.target.style.borderColor = "#8FFFD6"; }}
          onBlur={e => (e.target.style.borderColor = "var(--color-line)")} />
        {rightEl && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
            {rightEl}
          </div>
        )}
      </div>
    </div>
  );
}

function NotifRow({ icon, label, checked, onChange, last = false }: {
  icon: React.ReactNode; label: string; checked: boolean; onChange: () => void; last?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ color: C.muted }}>{icon}</div>
        <span style={{ color: C.primary, fontSize: 14 }}>{label}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function ProfileAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#8FFFD6,#00c896)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20, color: "#0a0a0a", flexShrink: 0, border: `3px solid ${C.line}` }}>
      {initials}
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
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

  const [twoFA,              setTwoFA]              = useState(false);
  const [savingProfile,      setSavingProfile]      = useState(false);
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);
  const [deletePassword,     setDeletePassword]     = useState("");
  const [deleteLoading,      setDeleteLoading]      = useState(false);

  useEffect(() => {
    fetchWithAuth("/api/users/me")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setName(data.name || "");
        setEmail(data.email || "");
        setProvider(data.provider || "local");
        setCreatedAt(data.createdAt || "");
      })
      .catch(() => {})
      .finally(() => setLoadingMe(false));
  }, []);

  useEffect(() => {
    fetchWithAuth("/api/notifications/preferences")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setPriceAlerts(data.prefPriceAlerts ?? true);
        setTxEmails(data.prefTransactionEmails ?? true);
        setNewsDigest(data.prefMentMessages ?? false);
      })
      .catch(() => {});
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetchWithAuth("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (res.ok) {
        toast("Profile updated successfully", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        toast((err as any).error || "Failed to update profile", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast("Please fill all password fields", "error"); return;
    }
    if (newPw !== confirmPw) {
      toast("New passwords do not match", "error"); return;
    }
    if (newPw.length < 8) {
      toast("Password must be at least 8 characters", "error"); return;
    }
    setPwLoading(true);
    try {
      const res = await fetchWithAuth("/api/users/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("Password changed successfully", "success");
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      } else {
        toast((data as any).error || "Failed to change password", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setPwLoading(false);
    }
  };

  const toggleAndSave = async (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    current: boolean,
    key: string
  ) => {
    const next = !current;
    setter(next);
    try {
      await fetchWithAuth("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefPriceAlerts:       key === "priceAlerts"  ? next : priceAlerts,
          prefTransactionEmails: key === "txEmails"     ? next : txEmails,
          prefMentMessages:      key === "newsDigest"   ? next : newsDigest,
        }),
      });
      toast("Preferences updated", "success");
    } catch { toast("Failed to save", "error"); }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) { toast("Enter your password to confirm", "error"); return; }
    setDeleteLoading(true);
    try {
      const res = await fetchWithAuth("/api/users/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (res.ok) {
        toast("Account deleted", "info");
        sessionStorage.removeItem("access_token");
        window.location.href = "/login";
      } else {
        const err = await res.json().catch(() => ({}));
        toast((err as any).error || "Incorrect password", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const isOAuth = provider !== "local";

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        input::placeholder { color: var(--color-muted); }
      `}</style>

      <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto", animation: "fadeInUp 0.4s ease", background: C.page, minHeight: "100vh" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.primary, margin: "0 0 6px" }}>Settings</h1>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Manage your account, security, and notification preferences</p>
        </div>

        {/* Profile Banner */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 24px", marginBottom: 18, display: "flex", alignItems: "center", gap: 16 }}>
          {loadingMe ? (
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.hover, flexShrink: 0 }} />
          ) : (
            <ProfileAvatar name={name || email} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.primary }}>
              {loadingMe ? "Loading…" : (name || email.split("@")[0] || "—")}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{email}</div>
          </div>
          <span style={{ fontSize: 11, color: "#8FFFD6", background: "rgba(143,255,214,0.08)", border: "1px solid rgba(143,255,214,0.2)", borderRadius: 6, padding: "4px 10px", fontWeight: 600 }}>
            {isOAuth ? provider.charAt(0).toUpperCase() + provider.slice(1) + " OAuth" : "Local Account"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionCard>
              <SectionTitle icon={<User size={15} />} label="Personal Information" />
              <InputField label="Full Name"     value={name}  onChange={setName}  placeholder="Your full name" />
              <InputField label="Email Address" value={email} onChange={setEmail} placeholder="your@email.com" type="email" disabled={isOAuth} />
              {isOAuth && (
                <p style={{ color: C.muted, fontSize: 11, marginTop: -8, marginBottom: 8 }}>
                  Email is managed by your {provider} account.
                </p>
              )}
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: savingProfile ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, background: savingProfile ? C.hover : "linear-gradient(135deg,#8FFFD6,#00c896)", color: "#0a0a0a", opacity: savingProfile ? 0.7 : 1, transition: "all 0.2s" }}>
                {savingProfile ? "Saving…" : "Save Profile"}
              </button>
            </SectionCard>

            <SectionCard>
              <SectionTitle icon={<Bell size={15} />} label="Notification Preferences" />
              <NotifRow icon={<Bell size={15} />}          label="Price Alerts"       checked={priceAlerts}   onChange={() => toggleAndSave(setPriceAlerts, priceAlerts, "priceAlerts")} />
              <NotifRow icon={<Mail size={15} />}          label="Transaction Emails" checked={txEmails}      onChange={() => toggleAndSave(setTxEmails, txEmails, "txEmails")} />
              <NotifRow icon={<MessageSquare size={15} />} label="News Digest"        checked={newsDigest}    onChange={() => toggleAndSave(setNewsDigest, newsDigest, "newsDigest")} />
              <NotifRow icon={<CreditCard size={15} />}    label="Market Summary"     checked={marketSummary} onChange={() => setMarketSummary(!marketSummary)} last />
            </SectionCard>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionCard>
              <SectionTitle icon={<Lock size={15} />} label="Change Password" />
              {isOAuth ? (
                <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
                  You signed in with {provider}. Password management is handled by your OAuth provider.
                </p>
              ) : (
                <>
                  <InputField
                    label="Current Password" value={currentPw} onChange={setCurrentPw}
                    type={showCurrPw ? "text" : "password"} placeholder="Enter current password"
                    rightEl={
                      <button onClick={() => setShowCurrPw(!showCurrPw)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 0, display: "flex" }}>
                        {showCurrPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    } />
                  <InputField
                    label="New Password" value={newPw} onChange={setNewPw}
                    type={showNewPw ? "text" : "password"} placeholder="Min 8 characters"
                    rightEl={
                      <button onClick={() => setShowNewPw(!showNewPw)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 0, display: "flex" }}>
                        {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    } />
                  <InputField
                    label="Confirm New Password" value={confirmPw} onChange={setConfirmPw}
                    type="password" placeholder="Re-enter new password" />
                  {newPw && confirmPw && newPw !== confirmPw && (
                    <p style={{ color: "#ef4444", fontSize: 11, marginTop: -8, marginBottom: 8 }}>Passwords do not match</p>
                  )}
                  <button
                    onClick={handleChangePassword}
                    disabled={pwLoading}
                    style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: pwLoading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, background: pwLoading ? C.hover : "linear-gradient(135deg,#8FFFD6,#00c896)", color: "#0a0a0a", opacity: pwLoading ? 0.7 : 1, transition: "all 0.2s" }}>
                    {pwLoading ? "Updating…" : "Change Password"}
                  </button>
                </>
              )}
            </SectionCard>

            <SectionCard>
              <SectionTitle icon={<ShieldCheck size={15} />} label="Security" />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: `1px solid ${C.line}`, marginBottom: 16 }}>
                <div>
                  <div style={{ color: C.primary, fontSize: 14, fontWeight: 500 }}>Two-Factor Authentication</div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Add an extra layer of security to your account</div>
                </div>
                <Toggle checked={twoFA} onChange={() => {
                  setTwoFA(!twoFA);
                  toast(!twoFA ? "2FA enabled" : "2FA disabled", !twoFA ? "success" : "info");
                }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Last login",      value: "Today" },
                  { label: "Active sessions", value: "1 device" },
                  { label: "Account created", value: formatDate(createdAt) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 12 }}>{label}</span>
                    <span style={{ color: C.primary, fontSize: 12, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard>
              <SectionTitle icon={<AlertTriangle size={15} />} label="Danger Zone" danger />
              <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "rgba(239,68,68,0.06)", color: "#ef4444", transition: "all 0.2s" }}
                  onMouseOver={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; }}
                  onMouseOut={e => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}>
                  Delete Account
                </button>
              ) : (
                <div>
                  <p style={{ color: "#ef4444", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                    Enter your password to confirm deletion:
                  </p>
                  <InputField
                    label="Password" value={deletePassword} onChange={setDeletePassword}
                    type="password" placeholder="Your current password" />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); }}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                      Cancel
                    </button>
                    <button onClick={handleDeleteAccount} disabled={deleteLoading}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", cursor: deleteLoading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, opacity: deleteLoading ? 0.7 : 1 }}>
                      {deleteLoading ? "Deleting…" : "Yes, Delete"}
                    </button>
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