"use client";

import { useState, useEffect, useCallback } from "react";
import { useMarket } from "@/hooks/useMarket";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Plus, Link2, Trash2, RefreshCw, ArrowUpRight, ArrowDownLeft } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankAccount {
  id: string;
  name: string;
  bank: string;
  balance: number;
  color: string;
  bg: string;
  letter: string;
  linked: boolean;
  accountNo: string;
}

interface FundingEntry {
  month: string;
  deposit: number;
  withdrawal: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ACCOUNTS: BankAccount[] = [
  { id: "1", name: "Chava", bank: "USA", balance: 1133, color: "#8FFFD6", bg: "#8FFFD618", letter: "C", linked: true, accountNo: "****4821" },
  { id: "2", name: "Walls Fargo", bank: "Fargo", balance: 1797, color: "#3b82f6", bg: "#3b82f618", letter: "W", linked: true, accountNo: "****2291" },
  { id: "3", name: "Dypest", bank: "S&A", balance: 350, color: "#8b5cf6", bg: "#8b5cf618", letter: "D", linked: true, accountNo: "****9034" },
  { id: "4", name: "Apple Apple", bank: "AFA", balance: 1080, color: "#aaaaaa", bg: "#aaaaaa18", letter: "", linked: true, accountNo: "****7712" },
  { id: "5", name: "Niarcaesole", bank: "Nals", balance: 250, color: "#f59e0b", bg: "#f59e0b18", letter: "N", linked: true, accountNo: "****5503" },
];

const FUNDING_HISTORY: FundingEntry[] = [
  { month: "Sep", deposit: 420, withdrawal: 180 },
  { month: "Oct", deposit: 380, withdrawal: 220 },
  { month: "Nov", deposit: 490, withdrawal: 150 },
  { month: "Tue", deposit: 340, withdrawal: 280 },
  { month: "May", deposit: 460, withdrawal: 190 },
  { month: "Jun", deposit: 500, withdrawal: 240 },
  { month: "Jul", deposit: 420, withdrawal: 160 },
  { month: "Aug", deposit: 480, withdrawal: 200 },
];

const RECENT_TRANSACTIONS = [
  { id: "t1", type: "deposit",    account: "Chava",       amount: 500,  date: "Today, 10:24 AM",    status: "completed" },
  { id: "t2", type: "withdrawal", account: "Walls Fargo", amount: 200,  date: "Today, 08:11 AM",    status: "completed" },
  { id: "t3", type: "deposit",    account: "Apple Apple", amount: 1080, date: "Yesterday, 4:30 PM",  status: "completed" },
  { id: "t4", type: "withdrawal", account: "Dypest",      amount: 75,   date: "Yesterday, 2:15 PM",  status: "pending"   },
  { id: "t5", type: "deposit",    account: "Niarcaesole", amount: 250,  date: "May 28, 11:00 AM",   status: "completed" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AccountCard({ acc, currency, onUnlink }: {
  acc: BankAccount; currency: string; onUnlink: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#111111",
        border: `1px solid ${hovered ? acc.color + "44" : "#1f1f1f"}`,
        borderRadius: 14,
        padding: "18px 20px",
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow */}
      <div style={{
        position: "absolute", top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle, ${acc.color}11 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: acc.bg,
            border: `1px solid ${acc.color}33`, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 13, fontWeight: 700, color: acc.color, flexShrink: 0,
          }}>
            {acc.letter || acc.name.charAt(0)}
          </div>
          <div>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: 13, margin: 0 }}>{acc.name}</p>
            <p style={{ color: "#555", fontSize: 11, margin: "2px 0 0" }}>{acc.bank}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => onUnlink(acc.id)}
            style={{
              width: 28, height: 28, borderRadius: 8, border: "1px solid #1f1f1f",
              background: "transparent", color: "#444", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            title="Unlink account"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <p style={{ color: "#555", fontSize: 11, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>Balance</p>
      <p style={{ color: "#fff", fontWeight: 800, fontSize: 22, margin: 0, letterSpacing: -0.5 }}>
        {currency}{acc.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
      <p style={{ color: "#333", fontSize: 10, margin: "6px 0 0" }}>{acc.accountNo}</p>
    </div>
  );
}

function LinkNewCard({ onLink }: { onLink: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onLink}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#141414" : "transparent",
        border: `1px dashed ${hovered ? "#8FFFD644" : "#2a2a2a"}`,
        borderRadius: 14,
        padding: "18px 20px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        minHeight: 130,
        transition: "all 0.2s",
        width: "100%",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: hovered ? "#8FFFD618" : "#1a1a1a",
        border: `1px solid ${hovered ? "#8FFFD644" : "#2a2a2a"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
      }}>
        <Plus size={16} color={hovered ? "#8FFFD6" : "#444"} />
      </div>
      <span style={{ color: hovered ? "#8FFFD6" : "#555", fontSize: 13, fontWeight: 500 }}>Link New Account</span>
    </button>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "#888", marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
          <span style={{ color: "#888" }}>{p.name}:</span>
          <span style={{ color: "#fff", fontWeight: 600 }}>${p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { market } = useMarket();
  const currency = market.currency || "$";

  const [accounts, setAccounts] = useState<BankAccount[]>(ACCOUNTS);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "deposit" | "withdrawal">("all");

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const handleUnlink = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const filteredTx = RECENT_TRANSACTIONS.filter(
    (t) => activeFilter === "all" || t.type === activeFilter
  );

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto", fontFamily: "'Geist','Inter',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Wallet &amp; Funding</h1>
          <p style={{ color: "#555", fontSize: 12, margin: "4px 0 0" }}>Manage your linked bank accounts and fund transfers</p>
        </div>
        <button
          onClick={() => setShowLinkModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
            background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer",
            color: "#0a0a0a", fontWeight: 700, fontSize: 13, transition: "opacity 0.2s",
          }}
        >
          <Plus size={14} />
          Link new Account
        </button>
      </div>

      {/* ── Total Balance Banner ── */}
      <div style={{
        background: "linear-gradient(135deg, #111 0%, #141414 100%)",
        border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px 28px",
        marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 200,
          background: "radial-gradient(ellipse at right, #8FFFD608 0%, transparent 70%)", pointerEvents: "none" }} />
        <div>
          <p style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>Total Linked Balance</p>
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 36, margin: 0, letterSpacing: -1 }}>
            {currency}{totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p style={{ color: "#22c55e", fontSize: 12, margin: "6px 0 0", fontWeight: 500 }}>
            +{currency}280.00 this month
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
            background: "#8FFFD618", borderRadius: 10, border: "1px solid #8FFFD633",
            cursor: "pointer", color: "#8FFFD6", fontWeight: 600, fontSize: 13,
          }}>
            <ArrowDownLeft size={14} /> Deposit
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
            background: "#1f1f1f", borderRadius: 10, border: "1px solid #2a2a2a",
            cursor: "pointer", color: "#888", fontWeight: 600, fontSize: 13,
          }}>
            <ArrowUpRight size={14} /> Withdraw
          </button>
        </div>
      </div>

      {/* ── Accounts Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {accounts.map((acc) => (
          <AccountCard key={acc.id} acc={acc} currency={currency} onUnlink={handleUnlink} />
        ))}
        <LinkNewCard onLink={() => setShowLinkModal(true)} />
      </div>

      {/* ── Bottom 2-col: Funding History + Recent Transactions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>

        {/* Funding History Chart */}
        <div style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: 0 }}>Funding History</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: "#8FFFD6" }} />
                <span style={{ color: "#555", fontSize: 11 }}>Deposit</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: "#6366f1" }} />
                <span style={{ color: "#555", fontSize: 11 }}>Withdrawal</span>
              </div>
              <span style={{ color: "#555", fontSize: 11, background: "#1a1a1a", padding: "2px 8px", borderRadius: 6, border: "1px solid #222" }}>Today ▾</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={FUNDING_HISTORY} barGap={4} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: "#444", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#ffffff06" }} />
              <Bar dataKey="deposit" name="Deposit" radius={[4, 4, 0, 0]} maxBarSize={18}>
                {FUNDING_HISTORY.map((_, i) => (
                  <Cell key={i} fill={i % 3 === 0 ? "#8FFFD6" : i % 3 === 1 ? "#6366f1" : "#f59e0b"} />
                ))}
              </Bar>
              <Bar dataKey="withdrawal" name="Withdrawal" radius={[4, 4, 0, 0]} maxBarSize={18}>
                {FUNDING_HISTORY.map((_, i) => (
                  <Cell key={i} fill={i % 3 === 0 ? "#8FFFD655" : i % 3 === 1 ? "#6366f155" : "#f59e0b55"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Transactions */}
        <div style={{ background: "#111111", border: "1px solid #1f1f1f", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: 0 }}>Recent Transfers</p>
            <div style={{ display: "flex", gap: 4 }}>
              {(["all", "deposit", "withdrawal"] as const).map((f) => (
                <button key={f} onClick={() => setActiveFilter(f)} style={{
                  padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 10, fontWeight: 600, textTransform: "capitalize", transition: "all 0.15s",
                  background: activeFilter === f ? "#8FFFD618" : "transparent",
                  color: activeFilter === f ? "#8FFFD6" : "#444",
                }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {filteredTx.map((tx) => (
              <div key={tx.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 12px", borderRadius: 10, background: "#0d0d0d",
                border: "1px solid #1a1a1a", marginBottom: 4,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: tx.type === "deposit" ? "#22c55e18" : "#ef444418",
                  border: `1px solid ${tx.type === "deposit" ? "#22c55e33" : "#ef444433"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {tx.type === "deposit"
                    ? <ArrowDownLeft size={13} color="#22c55e" />
                    : <ArrowUpRight size={13} color="#ef4444" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#fff", fontSize: 12, fontWeight: 600, margin: 0, textTransform: "capitalize" }}>{tx.type}</p>
                  <p style={{ color: "#555", fontSize: 10, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.account} · {tx.date}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: tx.type === "deposit" ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 13, margin: 0 }}>
                    {tx.type === "deposit" ? "+" : "-"}{currency}{tx.amount.toLocaleString()}
                  </p>
                  <p style={{
                    fontSize: 9, margin: "2px 0 0", fontWeight: 600, textTransform: "uppercase",
                    color: tx.status === "completed" ? "#22c55e" : "#f59e0b",
                  }}>{tx.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Link Account Modal ── */}
      {showLinkModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowLinkModal(false)}>
          <div style={{
            background: "#111", border: "1px solid #1f1f1f", borderRadius: 16,
            padding: "28px 32px", width: 420, animation: "fadeInUp 0.25s ease",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#8FFFD618", border: "1px solid #8FFFD633", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Link2 size={16} color="#8FFFD6" />
              </div>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: 0 }}>Link New Account</h3>
            </div>
            {[
              { label: "Bank Name", placeholder: "e.g. Chase, Wells Fargo" },
              { label: "Account Number", placeholder: "Enter account number" },
              { label: "Routing Number", placeholder: "Enter routing number" },
            ].map(({ label, placeholder }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ color: "#888", fontSize: 12, display: "block", marginBottom: 6 }}>{label}</label>
                <input placeholder={placeholder} style={{
                  width: "100%", background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 8,
                  color: "#fff", fontSize: 13, padding: "10px 14px", outline: "none", boxSizing: "border-box",
                }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowLinkModal(false)} style={{
                flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #1f1f1f",
                background: "transparent", color: "#888", cursor: "pointer", fontWeight: 600, fontSize: 13,
              }}>Cancel</button>
              <button onClick={() => setShowLinkModal(false)} style={{
                flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                background: "#8FFFD6", color: "#0a0a0a", cursor: "pointer", fontWeight: 700, fontSize: 13,
              }}>Link Account</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}