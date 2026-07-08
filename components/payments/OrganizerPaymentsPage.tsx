"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type {
  OrganizerPaymentAttemptRow,
  OrganizerPaymentEventRow,
  OrganizerPaymentRegistrationRow,
  OrganizerPaymentsDashboardData,
  OrganizerWithdrawalRow,
  SupportedCurrency,
} from "@/lib/organizerPayments"
import { TierBadge } from "@/components/TierBadge"

type PaymentsPageProps = {
  data: OrganizerPaymentsDashboardData
}

type WorkspaceTab = "overview" | "events" | "transactions" | "withdrawals" | "security"
type EventPanelTab = "overview" | "registrations" | "payments"
type WithdrawalMethodKey = "MPESA" | "PAYBILL" | "BANK"

const WORKSPACE_TABS: WorkspaceTab[] = ["overview", "events", "transactions", "withdrawals", "security"]
const EVENT_PANEL_TABS: EventPanelTab[] = ["overview", "registrations", "payments"]

type WithdrawalDraft = {
  amount: string
  method: WithdrawalMethodKey
  paymentPin: string
  emailOtp: string
  mpesaPhone: string
  mpesaAccountName: string
  paybillNumber: string
  paybillAccountNumber: string
  paybillBusinessName: string
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
  bankBranchCode: string
}

const KENYAN_BANKS = [
  "Absa Bank Kenya",
  "Co-operative Bank",
  "DTB Kenya",
  "Equity Bank",
  "Family Bank",
  "KCB Bank",
  "NCBA Bank",
  "Standard Chartered Kenya",
]

const WITHDRAWAL_MINIMUM: Record<SupportedCurrency, number> = {
  KES: 100,
  USD: 1,
}

function formatMoney(currency: SupportedCurrency, amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(amount)
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value))
}

function formatDate(value: string | null) {
  if (!value) return "Date pending"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function statusLabel(status: OrganizerWithdrawalRow["status"]) {
  switch (status) {
    case "COMPLETED":
      return "Completed"
    case "FAILED":
      return "Failed"
    case "CANCELLED":
      return "Cancelled"
    default:
      return "Processing"
  }
}

function paymentStatusTone(status: OrganizerPaymentRegistrationRow["paymentStatus"] | OrganizerPaymentAttemptRow["status"]) {
  if (status === "SUCCESS" || status === "PAID") return { color: "#C8F55A", background: "rgba(200,245,90,0.1)" }
  if (status === "WAITLIST") return { color: "#FFB84D", background: "rgba(255,184,77,0.12)" }
  if (status === "PENDING" || status === "PAYMENT_PENDING" || status === "PROCESSING") return { color: "#8AB4FF", background: "rgba(138,180,255,0.12)" }
  return { color: "#FF8A8A", background: "rgba(255,107,107,0.12)" }
}

function trendIcon(color: string) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 11.5 6.8 7.7l2.2 2.2L13 5.9" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 5.9H13v2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function pillStyle(active: boolean): CSSProperties {
  return {
    border: active ? "0.5px solid rgba(200,245,90,0.38)" : "0.5px solid rgba(240,237,230,0.12)",
    background: active ? "rgba(200,245,90,0.08)" : "transparent",
    color: active ? "#C8F55A" : "rgba(240,237,230,0.7)",
    borderRadius: 999,
    padding: "0.55rem 0.95rem",
    fontSize: "0.82rem",
    fontFamily: "var(--font-dm-sans)",
    fontWeight: 600,
    cursor: "pointer",
  }
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 10,
  background: "#181818",
  border: "0.5px solid rgba(240,237,230,0.12)",
  color: "#F0EDE6",
  padding: "0.9rem 1rem",
  fontSize: "0.9rem",
  fontFamily: "var(--font-dm-sans)",
}

const primaryButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 999,
  background: "#C8F55A",
  color: "#0A0A0A",
  padding: "0.8rem 1.15rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  fontFamily: "var(--font-dm-sans)",
  cursor: "pointer",
}

const secondaryButtonStyle: CSSProperties = {
  border: "0.5px solid rgba(240,237,230,0.14)",
  borderRadius: 999,
  background: "transparent",
  color: "#F0EDE6",
  padding: "0.8rem 1.15rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  fontFamily: "var(--font-dm-sans)",
  cursor: "pointer",
}

function emptyDraft(): WithdrawalDraft {
  return {
    amount: "",
    method: "MPESA",
    paymentPin: "",
    emailOtp: "",
    mpesaPhone: "",
    mpesaAccountName: "",
    paybillNumber: "",
    paybillAccountNumber: "",
    paybillBusinessName: "",
    bankName: KENYAN_BANKS[0],
    bankAccountNumber: "",
    bankAccountName: "",
    bankBranchCode: "",
  }
}

function resolveWorkspaceTab(value: string | null): WorkspaceTab {
  return WORKSPACE_TABS.includes(value as WorkspaceTab) ? (value as WorkspaceTab) : "overview"
}

function resolveEventPanelTab(value: string | null): EventPanelTab {
  return EVENT_PANEL_TABS.includes(value as EventPanelTab) ? (value as EventPanelTab) : "overview"
}

function MetricCard({
  label,
  value,
  accent = "#F0EDE6",
  hint,
  icon,
}: {
  label: string
  value: string
  accent?: string
  hint?: string
  icon?: ReactNode
}) {
  return (
    <div className="dashboard-surface" style={{ padding: "1.1rem 1.15rem", background: "#141414" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.7rem" }}>
        <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.42)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
          {label}
        </span>
        {icon}
      </div>
      <div style={{ fontSize: "1.55rem", color: accent, fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: "0.45rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

function SummaryLine({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", fontFamily: "var(--font-dm-sans)", fontSize: "0.86rem" }}>
      <span style={{ color: "rgba(240,237,230,0.52)" }}>{label}</span>
      <span style={{ color: accent ? "#C8F55A" : "#F0EDE6", textAlign: "right" }}>{value}</span>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: ReturnType<typeof paymentStatusTone> }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "0.24rem 0.55rem",
        fontSize: "0.7rem",
        fontFamily: "var(--font-dm-sans)",
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: tone.background,
        color: tone.color,
      }}
    >
      {label}
    </span>
  )
}

function WithdrawalModal({
  currency,
  available,
  paymentPinReady,
  twoFactorReady,
  securityEmail,
  onClose,
}: {
  currency: SupportedCurrency
  available: number
  paymentPinReady: boolean
  twoFactorReady: boolean
  securityEmail: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [draft, setDraft] = useState<WithdrawalDraft>(emptyDraft)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [otpMessage, setOtpMessage] = useState("")
  const [result, setResult] = useState<{ reference: string; destination: string; processingTime: string } | null>(null)

  const amount = Number(draft.amount)
  const minimum = WITHDRAWAL_MINIMUM[currency]
  const amountIsValid = Number.isFinite(amount) && amount >= minimum && amount <= available

  const destinationLabel = useMemo(() => {
    if (draft.method === "MPESA") return draft.mpesaPhone
    if (draft.method === "PAYBILL") return `${draft.paybillNumber} / ${draft.paybillAccountNumber}`
    return `${draft.bankName} / ${draft.bankAccountNumber}`
  }, [draft])

  function validateStep(nextStep: 2 | 3 | 4 | 5) {
    if (!twoFactorReady) {
      setError("Turn on account 2FA in Profile before requesting a withdrawal.")
      return false
    }
    if (!paymentPinReady) {
      setError("Set your payments PIN in the Security tab before requesting a withdrawal.")
      return false
    }
    if (nextStep === 2 && !amountIsValid) {
      setError(`Enter an amount between ${formatMoney(currency, minimum)} and ${formatMoney(currency, available)}.`)
      return false
    }
    if (nextStep === 4) {
      if (draft.method === "MPESA" && !draft.mpesaPhone.trim()) {
        setError("Enter the M-Pesa phone number.")
        return false
      }
      if (draft.method === "PAYBILL" && (!draft.paybillNumber.trim() || !draft.paybillAccountNumber.trim() || !draft.paybillBusinessName.trim())) {
        setError("Enter the PayBill destination details.")
        return false
      }
      if (draft.method === "BANK" && (!draft.bankName.trim() || !draft.bankAccountNumber.trim() || !draft.bankAccountName.trim() || !draft.bankBranchCode.trim())) {
        setError("Enter the bank transfer details.")
        return false
      }
    }
    if (nextStep === 5 && (!draft.paymentPin.trim() || !draft.emailOtp.trim())) {
      setError("Enter both your payments PIN and the email verification code.")
      return false
    }
    setError("")
    setStep(nextStep)
    return true
  }

  async function requestOtp() {
    setSendingOtp(true)
    setError("")
    setOtpMessage("")
    try {
      const res = await fetch("/api/organizer/payments/security/otp", { method: "POST" })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error || "Unable to send verification code.")
        return
      }
      setOtpMessage(payload.message || "Verification code sent.")
    } catch {
      setError("Unable to send verification code.")
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/organizer/payments/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency,
          amount,
          method: draft.method,
          paymentPin: draft.paymentPin,
          emailOtp: draft.emailOtp,
          destination: {
            mpesaPhone: draft.mpesaPhone,
            mpesaAccountName: draft.mpesaAccountName,
            paybillNumber: draft.paybillNumber,
            paybillAccountNumber: draft.paybillAccountNumber,
            paybillBusinessName: draft.paybillBusinessName,
            bankName: draft.bankName,
            bankAccountNumber: draft.bankAccountNumber,
            bankAccountName: draft.bankAccountName,
            bankBranchCode: draft.bankBranchCode,
          },
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error || "Withdrawal failed. Please try again.")
        return
      }
      setResult({
        reference: payload.reference,
        destination: payload.destinationLabel,
        processingTime: payload.processingTime,
      })
      setStep(5)
      router.refresh()
    } catch {
      setError("Withdrawal failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 90 }} />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(92vw, 560px)",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "#121212",
          border: "0.5px solid rgba(240,237,230,0.12)",
          borderRadius: 18,
          padding: "1.35rem",
          zIndex: 91,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "#F0EDE6" }}>
              Withdraw Funds
            </h2>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.86rem", color: "rgba(240,237,230,0.52)", fontFamily: "var(--font-dm-sans)" }}>
              Available balance: {formatMoney(currency, available)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontSize: "1.6rem", lineHeight: 1 }}>
            X
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: step >= item ? "rgba(200,245,90,0.12)" : "rgba(240,237,230,0.05)",
                border: step >= item ? "0.5px solid rgba(200,245,90,0.28)" : "0.5px solid rgba(240,237,230,0.12)",
                color: step >= item ? "#C8F55A" : "rgba(240,237,230,0.42)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              {item}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            <label style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.72)", fontFamily: "var(--font-dm-sans)" }}>
              Amount to withdraw
            </label>
            <input
              type="number"
              min={minimum}
              max={available}
              value={draft.amount}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
              placeholder={`${currency} ${minimum}`}
              style={inputStyle}
            />
            <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
              Maximum: {formatMoney(currency, available)}
            </p>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: "0.8rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>How would you like to receive your funds?</p>
            {([
              { key: "MPESA", title: "M-Pesa", description: "Send to a Safaricom mobile number" },
              { key: "PAYBILL", title: "Till / PayBill", description: "Send to a business till or PayBill destination" },
              { key: "BANK", title: "Bank Transfer", description: "Send to a local bank account" },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, method: option.key }))}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: draft.method === option.key ? "0.5px solid rgba(200,245,90,0.36)" : "0.5px solid rgba(240,237,230,0.12)",
                  background: draft.method === option.key ? "rgba(200,245,90,0.07)" : "#181818",
                  color: "#F0EDE6",
                  padding: "0.95rem 1rem",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "0.92rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>{option.title}</div>
                <div style={{ marginTop: 4, fontSize: "0.8rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)" }}>{option.description}</div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: "0.8rem" }}>
            {draft.method === "MPESA" && (
              <>
                <input value={draft.mpesaPhone} onChange={(event) => setDraft((current) => ({ ...current, mpesaPhone: event.target.value }))} placeholder="M-Pesa Phone Number" style={inputStyle} />
                <input value={draft.mpesaAccountName} onChange={(event) => setDraft((current) => ({ ...current, mpesaAccountName: event.target.value }))} placeholder="Account Name" style={inputStyle} />
              </>
            )}

            {draft.method === "PAYBILL" && (
              <>
                <input value={draft.paybillNumber} onChange={(event) => setDraft((current) => ({ ...current, paybillNumber: event.target.value }))} placeholder="Till or PayBill Number" style={inputStyle} />
                <input value={draft.paybillAccountNumber} onChange={(event) => setDraft((current) => ({ ...current, paybillAccountNumber: event.target.value }))} placeholder="Account Number" style={inputStyle} />
                <input value={draft.paybillBusinessName} onChange={(event) => setDraft((current) => ({ ...current, paybillBusinessName: event.target.value }))} placeholder="Business Name" style={inputStyle} />
              </>
            )}

            {draft.method === "BANK" && (
              <>
                <select value={draft.bankName} onChange={(event) => setDraft((current) => ({ ...current, bankName: event.target.value }))} style={inputStyle}>
                  {KENYAN_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                </select>
                <input value={draft.bankAccountNumber} onChange={(event) => setDraft((current) => ({ ...current, bankAccountNumber: event.target.value }))} placeholder="Account Number" style={inputStyle} />
                <input value={draft.bankAccountName} onChange={(event) => setDraft((current) => ({ ...current, bankAccountName: event.target.value }))} placeholder="Account Name" style={inputStyle} />
                <input value={draft.bankBranchCode} onChange={(event) => setDraft((current) => ({ ...current, bankBranchCode: event.target.value }))} placeholder="Branch Code" style={inputStyle} />
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "grid", gap: "0.8rem" }}>
            <div style={{ background: "rgba(200,245,90,0.06)", border: "0.5px solid rgba(200,245,90,0.16)", borderRadius: 12, padding: "0.95rem 1rem" }}>
              <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.7, color: "rgba(240,237,230,0.72)", fontFamily: "var(--font-dm-sans)" }}>
                Withdrawals require your payments PIN and a one-time verification code sent to {securityEmail ?? "your email"}.
              </p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              value={draft.paymentPin}
              onChange={(event) => setDraft((current) => ({ ...current, paymentPin: event.target.value }))}
              placeholder="Payments PIN"
              style={inputStyle}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem" }}>
              <input
                inputMode="numeric"
                value={draft.emailOtp}
                onChange={(event) => setDraft((current) => ({ ...current, emailOtp: event.target.value }))}
                placeholder="Email verification code"
                style={inputStyle}
              />
              <button type="button" onClick={requestOtp} disabled={sendingOtp} style={{ ...secondaryButtonStyle, opacity: sendingOtp ? 0.7 : 1 }}>
                {sendingOtp ? "Sending..." : "Send code"}
              </button>
            </div>
            {otpMessage ? (
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>{otpMessage}</p>
            ) : null}
          </div>
        )}

        {step === 5 && result ? (
          <div style={{ display: "grid", gap: "0.8rem", padding: "0.5rem 0" }}>
            <div style={{ fontSize: "1rem", color: "#C8F55A", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>Withdrawal Initiated</div>
            <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.7, color: "rgba(240,237,230,0.75)", fontFamily: "var(--font-dm-sans)" }}>
              {formatMoney(currency, amount)} has been queued for {result.destination}.
            </p>
            <SummaryLine label="Reference" value={result.reference} />
            <SummaryLine label="Processing time" value={result.processingTime} />
          </div>
        ) : null}

        {step < 5 && (
          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            <SummaryLine label="Amount" value={formatMoney(currency, Number.isFinite(amount) ? amount : 0)} accent />
            <SummaryLine label="Destination" value={destinationLabel || "To be provided"} />
          </div>
        )}

        {error ? <p style={{ margin: "1rem 0 0", color: "#FF6B6B", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p> : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginTop: "1.2rem", flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {step > 1 && step < 5 ? (
              <button type="button" onClick={() => { setError(""); setStep((current) => (current - 1) as 1 | 2 | 3 | 4 | 5) }} style={secondaryButtonStyle}>
                Back
              </button>
            ) : null}
            {step === 1 && <button type="button" onClick={() => validateStep(2)} style={primaryButtonStyle}>Continue</button>}
            {step === 2 && <button type="button" onClick={() => validateStep(3)} style={primaryButtonStyle}>Continue</button>}
            {step === 3 && <button type="button" onClick={() => validateStep(4)} style={primaryButtonStyle}>Continue</button>}
            {step === 4 && (
              <button type="button" onClick={handleSubmit} disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.65 : 1 }}>
                {submitting ? "Submitting..." : "Confirm Withdrawal"}
              </button>
            )}
            {step === 5 && <button type="button" onClick={onClose} style={primaryButtonStyle}>Done</button>}
          </div>
        </div>
      </div>
    </>
  )
}

function SecurityPanel({
  security,
}: {
  security: OrganizerPaymentsDashboardData["security"]
}) {
  const router = useRouter()
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSavePin() {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const res = await fetch("/api/organizer/payments/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, confirmPin }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error || "Could not save your payments PIN.")
        return
      }
      setMessage("Payments PIN saved. Withdrawals will now require your PIN and an email code.")
      setPin("")
      setConfirmPin("")
      router.refresh()
    } catch {
      setError("Could not save your payments PIN.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="dashboard-surface" style={{ padding: "1rem 1.1rem" }}>
        <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.05rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
          Payments security
        </h2>
        <p style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.7, color: "rgba(240,237,230,0.62)", fontFamily: "var(--font-dm-sans)" }}>
          Every withdrawal now requires account 2FA, a dedicated payments PIN, and an email OTP. This works separately from your normal sign-in so money movement has its own security wall.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        <MetricCard label="Account 2FA" value={security.twoFactorEnabled ? "Enabled" : "Off"} accent={security.twoFactorEnabled ? "#C8F55A" : "#FFB84D"} hint="Profile-level sign-in protection" />
        <MetricCard label="Payments PIN" value={security.paymentPinEnabled ? "Configured" : "Required"} accent={security.paymentPinEnabled ? "#C8F55A" : "#FFB84D"} hint="Needed before any withdrawal" />
        <MetricCard label="Verification email" value={security.email ?? "Missing"} accent={security.email ? "#F0EDE6" : "#FF8A8A"} hint="Used for every withdrawal OTP" />
      </div>

      {!security.twoFactorEnabled ? (
        <div className="dashboard-surface" style={{ padding: "1rem 1.1rem", borderColor: "rgba(255,184,77,0.28)", background: "rgba(255,184,77,0.05)" }}>
          <p style={{ margin: 0, fontSize: "0.84rem", lineHeight: 1.7, color: "#FFB84D", fontFamily: "var(--font-dm-sans)" }}>
            Turn on two-factor authentication in Profile before any withdrawal can be approved.
          </p>
        </div>
      ) : null}

      <div className="dashboard-surface" style={{ padding: "1rem 1.1rem" }}>
        <div style={{ display: "grid", gap: "0.8rem", maxWidth: 420 }}>
          <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
            {security.paymentPinEnabled ? "Update payments PIN" : "Set payments PIN"}
          </h3>
          <input value={pin} onChange={(event) => setPin(event.target.value)} inputMode="numeric" type="password" placeholder="4 to 6 digit PIN" style={inputStyle} />
          <input value={confirmPin} onChange={(event) => setConfirmPin(event.target.value)} inputMode="numeric" type="password" placeholder="Confirm PIN" style={inputStyle} />
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" onClick={handleSavePin} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : security.paymentPinEnabled ? "Update PIN" : "Save PIN"}
            </button>
            <Link href="/dashboard/profile" style={{ ...secondaryButtonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Open profile security
            </Link>
          </div>
          {message ? <p style={{ margin: 0, fontSize: "0.8rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>{message}</p> : null}
          {error ? <p style={{ margin: 0, fontSize: "0.8rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

function EventOverview({
  event,
}: {
  event: OrganizerPaymentEventRow
}) {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <MetricCard label="Gross revenue" value={formatMoney(event.currency, event.gross)} accent="#C8F55A" icon={trendIcon("#C8F55A")} />
        <MetricCard label="Net earnings" value={formatMoney(event.currency, event.net)} accent="#C8F55A" icon={trendIcon("#C8F55A")} />
        <MetricCard label="Confirmed" value={String(event.confirmedCount)} hint="Attendees in the event" />
        <MetricCard label="Waitlist" value={String(event.waitlistCount)} hint="Still waiting for a spot" />
      </div>

      <div className="dashboard-surface" style={{ padding: "1rem 1.1rem" }}>
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <SummaryLine label="Event date" value={formatDate(event.eventDate)} />
          <SummaryLine label="Ticket revenue" value={formatMoney(event.currency, event.gross)} />
          <SummaryLine label="Platform commission" value={`${formatMoney(event.currency, event.commission)} · ${Math.round(event.commissionRate * 100)}%`} />
          <SummaryLine label="Successful payments" value={String(event.successfulPayments)} />
          <SummaryLine label="Pending payments" value={String(event.pendingPayments)} />
        </div>
      </div>

      <div className="dashboard-surface" style={{ padding: "1rem 0" }}>
        <div style={{ padding: "0 1.1rem 0.9rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
            Ticket tiers
          </h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Tickets Sold</th>
                <th>Price</th>
                <th>Gross</th>
                <th>Commission</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {event.tiers.map((tier) => (
                <tr key={tier.id}>
                  <td>
                    <TierBadge name={tier.name} badgeColor={tier.badgeColor} textColor={tier.textColor} metallic={tier.metallic} size="sm" />
                  </td>
                  <td>{tier.ticketsSold}</td>
                  <td>{formatMoney(event.currency, tier.price)}</td>
                  <td>{formatMoney(event.currency, tier.gross)}</td>
                  <td>{formatMoney(event.currency, tier.commission)}</td>
                  <td>{formatMoney(event.currency, tier.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function EventRegistrationsTable({ rows, currency }: { rows: OrganizerPaymentRegistrationRow[]; currency: SupportedCurrency }) {
  return (
    <div className="table-wrapper" style={{ maxHeight: 520 }}>
      <table>
        <thead>
          <tr>
            <th>Attendee</th>
            <th>Status</th>
            <th>Tier</th>
            <th>Amount</th>
            <th>Registered</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div style={{ display: "grid", gap: 2 }}>
                  <span style={{ color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>{row.attendeeName}</span>
                  <span style={{ color: "rgba(240,237,230,0.42)", fontFamily: "var(--font-dm-sans)", fontSize: "0.76rem" }}>{row.attendeeEmail ?? "No email"}</span>
                </div>
              </td>
              <td><StatusPill label={row.paymentStatus} tone={paymentStatusTone(row.paymentStatus)} /></td>
              <td>{row.tierName}</td>
              <td>{formatMoney(currency, row.amountPaid)}</td>
              <td>{formatDateTime(row.submittedAt)}</td>
              <td>{row.paymentReference ?? row.confirmationCode ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
                No registrations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function EventPaymentsTable({ rows }: { rows: OrganizerPaymentAttemptRow[] }) {
  return (
    <div className="table-wrapper" style={{ maxHeight: 520 }}>
      <table>
        <thead>
          <tr>
            <th>Attendee</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Created</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div style={{ display: "grid", gap: 2 }}>
                  <span style={{ color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>{row.attendeeName}</span>
                  <span style={{ color: "rgba(240,237,230,0.42)", fontFamily: "var(--font-dm-sans)", fontSize: "0.76rem" }}>{row.attendeeEmail ?? "No email"}</span>
                </div>
              </td>
              <td><StatusPill label={row.status} tone={paymentStatusTone(row.status)} /></td>
              <td>{formatMoney(row.currency, row.amount)}</td>
              <td>{row.paymentMethod}</td>
              <td>{formatDateTime(row.createdAt)}</td>
              <td>{row.reference ?? "Pending"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
                No payment attempts recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function OrganizerPaymentsPage({ data }: PaymentsPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialWorkspaceTab = resolveWorkspaceTab(searchParams.get("tab"))
  const initialEventPanelTab = resolveEventPanelTab(searchParams.get("eventTab"))
  const [currency, setCurrency] = useState<SupportedCurrency>(data.defaultCurrency)
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>(initialWorkspaceTab)
  const [eventPanelTab, setEventPanelTab] = useState<EventPanelTab>(initialEventPanelTab)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(data.events[0]?.id ?? null)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [eventFilter, setEventFilter] = useState("all")
  const [tierFilter, setTierFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const summary = data.summaryByCurrency[currency]
  const events = useMemo(() => data.events.filter((event) => event.currency === currency), [currency, data.events])
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId]
  )
  const filteredTransactions = useMemo(() => {
    return data.transactions.filter((item) => {
      if (item.currency !== currency) return false
      if (eventFilter !== "all" && item.eventTitle !== eventFilter) return false
      if (tierFilter !== "all" && item.tierName !== tierFilter) return false
      if (dateFrom && (!item.paidAt || new Date(item.paidAt) < new Date(`${dateFrom}T00:00:00`))) return false
      if (dateTo && (!item.paidAt || new Date(item.paidAt) > new Date(`${dateTo}T23:59:59`))) return false
      return true
    })
  }, [currency, data.transactions, dateFrom, dateTo, eventFilter, tierFilter])

  const eventOptions = useMemo(() => Array.from(new Set(data.transactions.filter((item) => item.currency === currency).map((item) => item.eventTitle))), [currency, data.transactions])
  const tierOptions = useMemo(() => Array.from(new Set(data.transactions.filter((item) => item.currency === currency).map((item) => item.tierName))), [currency, data.transactions])
  const withdrawals = useMemo(() => data.withdrawals.filter((item) => item.currency === currency), [currency, data.withdrawals])

  useEffect(() => {
    const nextWorkspaceTab = resolveWorkspaceTab(searchParams.get("tab"))
    if (workspaceTab !== nextWorkspaceTab) {
      setWorkspaceTab(nextWorkspaceTab)
    }
  }, [searchParams, workspaceTab])

  useEffect(() => {
    const nextEventPanelTab = resolveEventPanelTab(searchParams.get("eventTab"))
    if (eventPanelTab !== nextEventPanelTab) {
      setEventPanelTab(nextEventPanelTab)
    }
  }, [eventPanelTab, searchParams])

  function updateWorkspaceTab(nextTab: WorkspaceTab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", nextTab)
    if (nextTab !== "events") {
      params.delete("eventTab")
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    setWorkspaceTab(nextTab)
    if (nextTab !== "events") {
      setEventPanelTab("overview")
    }
  }

  function updateEventPanel(nextTab: EventPanelTab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", "events")
    params.set("eventTab", nextTab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    setWorkspaceTab("events")
    setEventPanelTab(nextTab)
  }

  return (
    <div className="dashboard-page-shell" style={{ maxWidth: 1220 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 className="dashboard-page-title">Payments</h1>
        <p className="dashboard-page-intro">Your payments area brings together every paid event, every payout signal, and the controls that protect withdrawals.</p>
      </div>

      {data.availableCurrencies.length > 1 && (
        <div style={{ display: "flex", gap: 10, marginBottom: "1rem", flexWrap: "wrap" }}>
          {data.availableCurrencies.map((item) => (
            <button key={item} type="button" onClick={() => setCurrency(item)} style={pillStyle(currency === item)}>
              {item}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1rem" }}>
        {([
          { key: "overview", label: "Overview" },
          { key: "events", label: "Events" },
          { key: "transactions", label: "Transactions" },
          { key: "withdrawals", label: "Withdrawals" },
          { key: "security", label: "Security" },
        ] as const).map((tab) => (
          <button key={tab.key} type="button" onClick={() => updateWorkspaceTab(tab.key)} style={pillStyle(workspaceTab === tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {workspaceTab === "overview" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <MetricCard label="Total Gross" value={formatMoney(currency, summary.gross)} accent="#C8F55A" icon={trendIcon("#C8F55A")} />
            <MetricCard label="Commission Deducted" value={formatMoney(currency, summary.commission)} accent="rgba(240,237,230,0.72)" />
            <MetricCard label="Net Earnings" value={formatMoney(currency, summary.net)} accent="#C8F55A" icon={trendIcon("#C8F55A")} />
            <MetricCard label="Withdrawable Balance" value={formatMoney(currency, summary.withdrawable)} accent="#C8F55A" />
          </section>

          <section className="dashboard-surface" style={{ padding: "1rem 1.1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>Available now</div>
                <div style={{ marginTop: 4, fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
                  {formatMoney(currency, summary.withdrawable)}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={summary.withdrawable <= 0}
                  onClick={() => setShowWithdrawModal(true)}
                  style={{
                    ...primaryButtonStyle,
                    opacity: summary.withdrawable > 0 ? 1 : 0.5,
                    cursor: summary.withdrawable > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  Withdraw Funds
                </button>
                <button type="button" onClick={() => updateWorkspaceTab("events")} style={secondaryButtonStyle}>
                  View all events
                </button>
              </div>
            </div>
          </section>

          <section className="dashboard-surface" style={{ padding: "1rem 1.1rem", background: "rgba(255,184,77,0.05)", borderColor: "rgba(255,184,77,0.18)" }}>
            <p style={{ margin: 0, fontSize: "0.84rem", lineHeight: 1.7, color: "rgba(240,237,230,0.7)", fontFamily: "var(--font-dm-sans)" }}>
              EventSlot&apos;s platform commission is non-refundable. If you issue a refund to an attendee, the commission amount is deducted from your net balance.
            </p>
          </section>

          <section className="dashboard-surface" style={{ padding: "1rem 1.1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
                Paid events
              </h2>
              <button type="button" onClick={() => updateWorkspaceTab("transactions")} style={secondaryButtonStyle}>
                View my payments
              </button>
            </div>

            {events.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(240,237,230,0.56)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
                Once your paid events start receiving payments, they will appear here with earnings, attendees, payment attempts, and withdrawal readiness.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.85rem" }}>
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      setSelectedEventId(event.id)
                      updateWorkspaceTab("events")
                    }}
                    style={{
                      textAlign: "left",
                      background: "rgba(255,255,255,0.01)",
                      border: "0.5px solid rgba(240,237,230,0.08)",
                      borderRadius: 14,
                      padding: "1rem 1.05rem",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>{event.title}</div>
                        <div style={{ marginTop: 6, fontSize: "0.8rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>
                          {formatDate(event.eventDate)} | {event.confirmedCount} confirmed | {event.waitlistCount} waitlisted
                        </div>
                      </div>
                      <div style={{ minWidth: 180 }}>
                        <div style={{ fontSize: "0.74rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Net earnings
                        </div>
                        <div style={{ marginTop: 6, fontSize: "1.1rem", color: "#C8F55A", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>
                          {formatMoney(event.currency, event.net)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {workspaceTab === "events" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: "1rem" }}>
          <aside className="dashboard-surface" style={{ padding: "1rem 0" }}>
            <div style={{ padding: "0 1rem 0.8rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.02rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
                Paid events
              </h2>
            </div>
            <div style={{ display: "grid", gap: "0.55rem", padding: "0 0.7rem 0.4rem" }}>
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                  style={{
                    textAlign: "left",
                    borderRadius: 12,
                    border: selectedEvent?.id === event.id ? "0.5px solid rgba(200,245,90,0.3)" : "0.5px solid rgba(240,237,230,0.08)",
                    background: selectedEvent?.id === event.id ? "rgba(200,245,90,0.06)" : "rgba(255,255,255,0.01)",
                    padding: "0.9rem 0.95rem",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "0.92rem", color: "#F0EDE6", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>{event.title}</div>
                  <div style={{ marginTop: 4, fontSize: "0.76rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>
                    {formatMoney(event.currency, event.net)} net | {event.successfulPayments} paid
                  </div>
                </button>
              ))}
              {events.length === 0 && (
                <p style={{ margin: "0 0.35rem", color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)", fontSize: "0.84rem", lineHeight: 1.7 }}>
                  No paid events yet.
                </p>
              )}
            </div>
          </aside>

          <section className="dashboard-surface" style={{ padding: "1rem 1.1rem" }}>
            {!selectedEvent ? (
              <p style={{ margin: 0, color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
                Choose an event to inspect its registrations, payments, and revenue.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
                      {selectedEvent.title}
                    </h2>
                    <p style={{ margin: "0.45rem 0 0", fontSize: "0.84rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)" }}>
                      {formatDate(selectedEvent.eventDate)} | {selectedEvent.confirmedCount} confirmed | {selectedEvent.waitlistCount} waitlisted
                    </p>
                  </div>
                  <Link href={`/dashboard/events/${selectedEvent.slug}`} style={{ ...secondaryButtonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                    Open event dashboard
                  </Link>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {([
                    { key: "overview", label: "Overview" },
                    { key: "registrations", label: "Registrations" },
                    { key: "payments", label: "Payments" },
                  ] as const).map((tab) => (
                    <button key={tab.key} type="button" onClick={() => updateEventPanel(tab.key)} style={pillStyle(eventPanelTab === tab.key)}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {eventPanelTab === "overview" && <EventOverview event={selectedEvent} />}
                {eventPanelTab === "registrations" && <EventRegistrationsTable rows={selectedEvent.registrations} currency={selectedEvent.currency} />}
                {eventPanelTab === "payments" && <EventPaymentsTable rows={selectedEvent.paymentAttempts} />}
              </div>
            )}
          </section>
        </div>
      )}

      {workspaceTab === "transactions" && (
        <section className="dashboard-surface" style={{ padding: "1rem 1.1rem" }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.05rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
            Transaction log
          </h2>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: "1rem" }}>
            <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} style={inputStyle}>
              <option value="all">All events</option>
              {eventOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} style={inputStyle}>
              <option value="all">All tiers</option>
              {tierOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={inputStyle} />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={inputStyle} />
          </div>
          <div className="table-wrapper" style={{ maxHeight: 520 }}>
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Attendee</th>
                  <th>Event</th>
                  <th>Tier</th>
                  <th>Amount Paid</th>
                  <th>Commission</th>
                  <th>You Received</th>
                  <th>M-Pesa Ref</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.paidAt)}</td>
                    <td>{item.attendeeName}</td>
                    <td>{item.eventTitle}</td>
                    <td>{item.tierName}</td>
                    <td>{formatMoney(item.currency, item.amount)}</td>
                    <td>{formatMoney(item.currency, item.commission)}</td>
                    <td>{formatMoney(item.currency, item.net)}</td>
                    <td>{item.mpesaRef ?? "-"}</td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
                      No transactions match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {workspaceTab === "withdrawals" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="dashboard-surface" style={{ padding: "1rem 1.1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>Withdrawable now</div>
              <div style={{ marginTop: 4, fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
                {formatMoney(currency, summary.withdrawable)}
              </div>
              {!data.security.twoFactorEnabled ? (
                <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#FFB84D", fontFamily: "var(--font-dm-sans)" }}>
                  Enable account 2FA in Profile to unlock withdrawals.
                </div>
              ) : !data.security.paymentPinEnabled ? (
                <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#FFB84D", fontFamily: "var(--font-dm-sans)" }}>
                  Set your payments PIN in the Security tab to unlock withdrawals.
                </div>
              ) : null}
            </div>
            <button
              type="button"
              disabled={summary.withdrawable <= 0 || !data.security.twoFactorEnabled || !data.security.paymentPinEnabled}
              onClick={() => setShowWithdrawModal(true)}
              style={{
                ...primaryButtonStyle,
                opacity: summary.withdrawable > 0 && data.security.twoFactorEnabled && data.security.paymentPinEnabled ? 1 : 0.5,
                cursor: summary.withdrawable > 0 && data.security.twoFactorEnabled && data.security.paymentPinEnabled ? "pointer" : "not-allowed",
              }}
            >
              Withdraw Funds
            </button>
          </section>

          <section className="dashboard-surface" style={{ padding: "1rem 1.1rem" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.05rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
              Withdrawal history
            </h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatMoney(item.currency, item.amount)}</td>
                      <td>{item.method === "MPESA" ? "M-Pesa" : item.method === "PAYBILL" ? "Till / PayBill" : "Bank Transfer"}</td>
                      <td>{statusLabel(item.status)}</td>
                      <td>{item.providerRef ?? "Pending"}</td>
                      <td>{item.destination}</td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
                        No withdrawal requests yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {workspaceTab === "security" && <SecurityPanel security={data.security} />}

      {showWithdrawModal ? (
        <WithdrawalModal
          currency={currency}
          available={summary.withdrawable}
          paymentPinReady={data.security.paymentPinEnabled}
          twoFactorReady={data.security.twoFactorEnabled}
          securityEmail={data.security.email}
          onClose={() => setShowWithdrawModal(false)}
        />
      ) : null}
    </div>
  )
}

