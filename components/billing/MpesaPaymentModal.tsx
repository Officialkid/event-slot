"use client"

import { useEffect, useState } from "react"

interface MpesaPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  plan: { name: string; displayName: string; monthlyPriceUsd: number; annualPriceUsd: number }
  billingCycle: "monthly" | "annual"
}

export function MpesaPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  plan,
  billingCycle,
}: MpesaPaymentModalProps) {
  const [phone, setPhone] = useState("")
  const [step, setStep] = useState<"input" | "waiting" | "success" | "error">("input")
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  const priceUsd = billingCycle === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd

  useEffect(() => {
    if (step !== "waiting" || !checkoutRequestId) return

    const interval = setInterval(async () => {
      const res = await fetch(`/api/payments/mpesa/status?checkoutRequestId=${checkoutRequestId}`)
      const data = await res.json()
      if (data.status === "SUCCESS") {
        clearInterval(interval)
        setStep("success")
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      } else if (data.status === "FAILED" || data.status === "CANCELLED") {
        clearInterval(interval)
        setErrorMessage(data.status === "CANCELLED" ? "Payment was cancelled." : "Payment failed. Please try again.")
        setStep("error")
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [checkoutRequestId, onClose, onSuccess, step])

  const handleSubmit = async () => {
    if (!phone.trim()) return
    setStep("waiting")
    setErrorMessage("")

    try {
      const res = await fetch("/api/payments/mpesa/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: plan.name, billingCycle, phone: phone.trim() }),
      })
      const data = await res.json()

      if (!res.ok || !data.checkoutRequestId) {
        setErrorMessage(data.error ?? "Failed to initiate payment.")
        setStep("error")
        return
      }

      setCheckoutRequestId(data.checkoutRequestId)
    } catch {
      setErrorMessage("Network error. Please try again.")
      setStep("error")
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,10,10,0.7)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Upgrade to {plan.displayName}
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
              {billingCycle === "annual" ? "Annual billing" : "Monthly billing"} · ${priceUsd}
              {billingCycle === "annual" ? "/year" : "/month"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xl transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            X
          </button>
        </div>

        {step === "input" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#C8F55A]/20 bg-[#C8F55A]/5 p-4">
              <p className="mb-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Pay via M-Pesa
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                You will receive an STK Push prompt on your phone. Enter your M-Pesa PIN to complete payment.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>
                M-Pesa Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full rounded-lg px-4 py-3 transition-colors focus:outline-none focus:border-[#C8F55A]"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Safaricom numbers only (07XX or 01XX)
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!phone.trim()}
              className="w-full rounded-xl bg-[#C8F55A] py-3 font-semibold text-black transition-colors hover:bg-[#b8e84a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send STK Push - KES ~{Math.ceil(priceUsd * 130).toLocaleString()}
            </button>
            <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
              Amount in KES calculated at current exchange rate
            </p>
          </div>
        )}

        {step === "waiting" && (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#C8F55A]/10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#C8F55A] border-t-transparent" />
            </div>
            <div>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                Check your phone
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                An M-Pesa prompt has been sent to <span style={{ color: "var(--text-primary)" }}>{phone}</span>.
                Enter your PIN to complete payment.
              </p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              This page updates automatically. Do not close it.
            </p>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-3 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#C8F55A]/20">
              <span className="text-2xl text-[#C8F55A]">OK</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Payment successful!
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Your {plan.displayName} plan is now active.
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center">
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
            <button
              onClick={() => setStep("input")}
              className="w-full rounded-xl py-3 transition-colors"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
