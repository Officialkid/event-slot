"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import ComingSoon from "@/components/ui/ComingSoon"
import { markFeatureUsed } from "@/lib/markFeatureUsed"

interface BillingStatus {
  plan: string
  billingCycle: string | null
  planEndDate: string | null
  paystackSubscriptionCode: string | null
  creditBalance: number
}

interface CreditTx {
  id: string
  amount: number
  type: string
  description: string
  createdAt: string
  balance: number
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function fmtRenewal(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function fmtCredits(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

function fmtAmt(n: number) {
  const abs = fmtCredits(Math.abs(n))
  return n >= 0 ? "+" + abs : "-" + abs
}

const PLAN_DISPLAY: Record<string, string> = {
  free: "Free Plan",
  pro: "Pro Plan",
  business: "Business Plan",
}

function PlanBadge({ plan, large }: { plan: string; large?: boolean }) {
  const s: Record<string, React.CSSProperties> = {
    free: { background: "rgba(240,237,230,0.06)", border: "0.5px solid rgba(240,237,230,0.15)", color: "rgba(240,237,230,0.55)" },
    pro: { background: "rgba(200,245,90,0.1)", border: "0.5px solid rgba(200,245,90,0.3)", color: "#C8F55A" },
    business: { background: "rgba(147,112,219,0.1)", border: "0.5px solid rgba(147,112,219,0.3)", color: "#9370DB" },
  }
  return (
    <span
      style={{
        ...(s[plan] ?? s.free),
        borderRadius: 100,
        fontSize: large ? "0.8rem" : "0.7rem",
        fontWeight: 500,
        padding: large ? "0.35rem 0.875rem" : "0.3rem 0.75rem",
        display: "inline-block",
        letterSpacing: "0.04em",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {PLAN_DISPLAY[plan] ?? "Free Plan"}
    </span>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1rem" }}>
      {children}
    </h2>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
      {children}
    </div>
  )
}

const FEATURE_COSTS = [
  { feature: "AI event report", cost: "50 credits" },
  { feature: "AI insight cards", cost: "20 credits" },
  { feature: "Analytics Q&A query", cost: "60 credits per question" },
  { feature: "Remove watermark", cost: "10 credits" },
  { feature: "Export CSV", cost: "15 credits" },
]

export default function BillingPage() {
  const searchParams = useSearchParams()
  const isSuccess = searchParams.get("success") === "true"
  const isCreditsAdded = searchParams.get("credits") === "added"
  const planParam = searchParams.get("plan") ?? ""

  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [successVisible, setSuccessVisible] = useState(isSuccess)
  const [creditsVisible, setCreditsVisible] = useState(isCreditsAdded)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [creditHistory, setCreditHistory] = useState<CreditTx[]>([])

  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(() => setSuccessVisible(false), 5000)
      return () => clearTimeout(t)
    }
  }, [isSuccess])

  useEffect(() => {
    if (isCreditsAdded) {
      const t = setTimeout(() => setCreditsVisible(false), 5000)
      return () => clearTimeout(t)
    }
  }, [isCreditsAdded])

  const fetchStatus = useCallback(async () => {
    try { const res = await fetch("/api/billing/status"); const data = await res.json(); setStatus(data) } catch { /* ignore */ }
  }, [])

  const fetchCreditHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/user/credits/history')
      const data = await res.json()
      if (data.transactions) setCreditHistory(data.transactions)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useEffect(() => {
    markFeatureUsed("billing")
  }, [])



  async function handleCancel() {
    if (!window.confirm("Cancel your subscription? You will keep access until end of the current billing period.")) return
    setCancelLoading(true); setCancelError("")
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" })
      const data = await res.json()
      if (res.ok) { await fetchStatus() }
      else { setCancelError(data.error ?? "Failed to cancel. Please try again.") }
    } catch { setCancelError("Network error. Please try again.") }
    finally { setCancelLoading(false) }
  }



  async function toggleHistory() {
    if (!historyOpen && creditHistory.length === 0) {
      await fetchCreditHistory()
    }
    setHistoryOpen(o => !o)
  }

  const plan = status?.plan ?? "free"
  const isPaid = plan === "pro" || plan === "business"
  const creditBalance = status?.creditBalance ?? 0
  const successPlanName = PLAN_DISPLAY[planParam] ?? PLAN_DISPLAY[plan] ?? "your new plan"

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <style>{`
        @keyframes bil-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .bil-in { animation: bil-in 0.22s ease; }
        @keyframes bil-spin { to { transform: rotate(360deg); } }
        .bil-row:hover td { background: rgba(240,237,230,0.02); }
        .bil-ghost:hover { background: rgba(240,237,230,0.07) !important; border-color: rgba(240,237,230,0.22) !important; }
        .bil-collapsible:hover { background: rgba(240,237,230,0.04) !important; }
      `}</style>

      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.6rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.25rem" }}>
          Billing
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
          Manage your plan, credits, and billing history.
        </p>
      </div>

      {successVisible && (
        <div className="bil-in" style={{
          background: "rgba(200,245,90,0.1)", border: "0.5px solid rgba(200,245,90,0.35)", borderRadius: 10,
          padding: "0.875rem 1.25rem", marginBottom: "1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C8F55A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5" /><path d="M5 8l2 2 4-4" />
            </svg>
            <span style={{ fontSize: "0.875rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}>
              Payment successful. Welcome to {successPlanName}.
            </span>
          </div>
          <button onClick={() => setSuccessVisible(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(200,245,90,0.5)", fontSize: "1.1rem", lineHeight: 1, padding: 0 }}>x</button>
        </div>
      )}

      {creditsVisible && (
        <div className="bil-in" style={{
          background: "rgba(200,245,90,0.1)", border: "0.5px solid rgba(200,245,90,0.35)", borderRadius: 10,
          padding: "0.875rem 1.25rem", marginBottom: "1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C8F55A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5" /><path d="M5 8l2 2 4-4" />
            </svg>
            <span style={{ fontSize: "0.875rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}>
              Credits added to your account.
            </span>
          </div>
          <button onClick={() => setCreditsVisible(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(200,245,90,0.5)", fontSize: "1.1rem", lineHeight: 1, padding: 0 }}>x</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        <section>
          <SectionHeading>Current Plan</SectionHeading>
          <Card>
            {!status ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(200,245,90,0.2)", borderTopColor: "#C8F55A", animation: "bil-spin 0.8s linear infinite" }} />
                <span style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>Loading...</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flexWrap: "wrap" }}>
                  <PlanBadge plan={plan} large />
                  <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6" }}>
                    {PLAN_DISPLAY[plan] ?? "Free Plan"}
                  </span>
                </div>
                {isPaid && (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)" }}>
                    {"Billed "}
                    <span style={{ color: "rgba(240,237,230,0.75)" }}>
                      {status.billingCycle === "annual" ? "annually" : "monthly"}
                    </span>
                    {status.planEndDate && (
                      <>
                        {" - Renews "}
                        <span style={{ color: "rgba(240,237,230,0.75)" }}>{fmtRenewal(status.planEndDate)}</span>
                      </>
                    )}
                  </p>
                )}
                {!isPaid && (
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                    No active subscription - Free forever
                  </p>
                )}
                {cancelError && <p style={{ margin: 0, fontSize: "0.8rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{cancelError}</p>}
                {isPaid && (
                  <button onClick={handleCancel} disabled={cancelLoading} style={{
                    alignSelf: "flex-start", background: "transparent", border: "none", padding: 0,
                    cursor: cancelLoading ? "not-allowed" : "pointer",
                    fontSize: "0.78rem", color: "rgba(255,107,107,0.6)",
                    fontFamily: "var(--font-dm-sans)", textDecoration: "underline",
                    textDecorationColor: "rgba(255,107,107,0.25)",
                  }}>
                    {cancelLoading ? "Cancelling..." : "Cancel subscription"}
                  </button>
                )}
              </div>
            )}
          </Card>
        </section>

        <section>
          <SectionHeading>EventSlot Credits</SectionHeading>

          {/* Balance card */}
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", color: "#F0EDE6" }}>
                Your credits
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", margin: "0.375rem 0 0.125rem" }}>
                <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2.5rem", color: "#C8F55A", lineHeight: 1 }}>
                  {status ? fmtCredits(creditBalance) : "—"}
                </span>
                <span style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
                  credits available
                </span>
              </div>
              <button
                onClick={toggleHistory}
                style={{
                  alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer",
                  fontSize: "0.78rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)",
                  textDecoration: "underline", textDecorationColor: "rgba(240,237,230,0.15)", marginTop: "0.25rem",
                }}
              >
                View transaction history
              </button>
            </div>
          </Card>

          {/* Bundle cards — payment coming soon */}
          <div style={{ marginTop: "1rem" }}>
            <ComingSoon
              featureName="Credit Purchases"
              description="Purchasing credits will be available once our payment system goes live. You'll be notified as soon as top-ups are open."
            />
          </div>

          {/* Feature cost table */}
          <div style={{ marginTop: "1.25rem" }}>
            <p style={{ margin: "0 0 0.625rem", fontSize: "0.72rem", fontWeight: 600, color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              What you can do with credits
            </p>
            <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.6rem 0.875rem", color: "rgba(240,237,230,0.3)", fontWeight: 500, fontSize: "0.68rem", textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: "0.5px solid rgba(240,237,230,0.06)" }}>Feature</th>
                    <th style={{ textAlign: "right", padding: "0.6rem 0.875rem", color: "rgba(240,237,230,0.3)", fontWeight: 500, fontSize: "0.68rem", textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: "0.5px solid rgba(240,237,230,0.06)", whiteSpace: "nowrap" as const }}>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_COSTS.map((row, i) => (
                    <tr key={row.feature} className="bil-row">
                      <td style={{ padding: "0.6rem 0.875rem", color: "rgba(240,237,230,0.6)", borderBottom: i < FEATURE_COSTS.length - 1 ? "0.5px solid rgba(240,237,230,0.04)" : "none" }}>
                        {row.feature}
                      </td>
                      <td style={{ padding: "0.6rem 0.875rem", color: "rgba(240,237,230,0.75)", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap" as const, borderBottom: i < FEATURE_COSTS.length - 1 ? "0.5px solid rgba(240,237,230,0.04)" : "none" }}>
                        {row.cost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction history (collapsible) */}
          {historyOpen && (
            <div style={{ marginTop: "1.25rem" }} className="bil-in">
              <Card>
                {creditHistory.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                    No transactions yet.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", fontFamily: "var(--font-dm-sans)" }}>
                      <thead><tr>
                        {["Date", "Type", "Amount", "Description"].map(h => (
                          <th key={h} style={{
                            textAlign: "left", padding: "0 0.75rem 0.75rem",
                            color: "rgba(240,237,230,0.3)", fontWeight: 500, fontSize: "0.68rem",
                            textTransform: "uppercase" as const, letterSpacing: "0.05em",
                            borderBottom: "0.5px solid rgba(240,237,230,0.06)", whiteSpace: "nowrap" as const,
                          }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {creditHistory.map(tx => {
                          const isPos = tx.amount >= 0
                          const typeLabel = isPos ? "Purchase" : "Spent"
                          return (
                            <tr key={tx.id} className="bil-row" style={{ borderBottom: "0.5px solid rgba(240,237,230,0.04)" }}>
                              <td style={{ padding: "0.7rem 0.75rem", color: "rgba(240,237,230,0.5)", whiteSpace: "nowrap" as const }}>{fmtDate(tx.createdAt)}</td>
                              <td style={{ padding: "0.7rem 0.75rem", whiteSpace: "nowrap" as const }}>
                                <span style={{ fontSize: "0.72rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: isPos ? "#C8F55A" : "rgba(240,237,230,0.35)" }}>
                                  {typeLabel}
                                </span>
                              </td>
                              <td style={{ padding: "0.7rem 0.75rem", whiteSpace: "nowrap" as const, fontWeight: 500, color: isPos ? "#C8F55A" : "rgba(255,107,107,0.75)" }}>{fmtAmt(tx.amount)}</td>
                              <td style={{ padding: "0.7rem 0.75rem", color: "rgba(240,237,230,0.55)", maxWidth: 220 }}>
                                <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{tx.description}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}
        </section>

        {plan !== "business" && (
          <section>
            <SectionHeading>Upgrade your plan</SectionHeading>
            <ComingSoon
              featureName="Plan Upgrades"
              description="Pro and Business subscriptions are coming soon. Once our payment system goes live you'll be able to upgrade directly from here."
            />
          </section>
        )}

      </div>
    </div>
  )
}