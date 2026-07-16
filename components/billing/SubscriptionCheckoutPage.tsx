"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CreditCard, Loader2, ShieldCheck, Smartphone } from "lucide-react"
import { BillingPausedNotice } from "@/components/billing/BillingPausedNotice"
import { getBillingNoticeCopy } from "@/lib/billingNotice"
import { isBillingCheckoutEnabled } from "@/lib/pricingRollout"
import type { SubscriptionPlanDefinition } from "@/lib/subscriptionPlans"
import {
  formatKes,
  formatUsd,
  getSubscriptionBillingQuote,
  normalizeBillingCycle,
  normalizePaymentMethod,
  type SubscriptionBillingCycle,
  type SubscriptionPaymentMethod,
} from "@/lib/subscriptionBilling"

type SubscriptionCheckoutPageProps = {
  plans: SubscriptionPlanDefinition[]
  currentPlanKey: string
  initialPlanKey: string
  initialBillingCycle: SubscriptionBillingCycle
  accountName: string
  accountEmail: string
}

export function SubscriptionCheckoutPage({
  plans,
  currentPlanKey,
  initialPlanKey,
  initialBillingCycle,
  accountName,
  accountEmail,
}: SubscriptionCheckoutPageProps) {
  const billingEnabled = isBillingCheckoutEnabled()
  const [planKey, setPlanKey] = useState(initialPlanKey)
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>(
    normalizeBillingCycle(initialBillingCycle)
  )
  const [paymentMethod, setPaymentMethod] = useState<SubscriptionPaymentMethod>("card")
  const [payerName, setPayerName] = useState(accountName)
  const [mpesaPhone, setMpesaPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === planKey) ?? plans.find((plan) => plan.key === "pro") ?? plans[0],
    [planKey, plans]
  )

  const quote = useMemo(
    () => getSubscriptionBillingQuote(selectedPlan, billingCycle),
    [billingCycle, selectedPlan]
  )

  const planIsCurrent = currentPlanKey === selectedPlan.key

  const handleCheckout = async () => {
    if (!billingEnabled) {
      setError(getBillingNoticeCopy("subscription").error)
      return
    }

    setSubmitting(true)
    setError("")

    if (!payerName.trim()) {
      setError("Please enter the account holder name for this checkout.")
      setSubmitting(false)
      return
    }

    if (paymentMethod === "mpesa" && !mpesaPhone.trim()) {
      setError("Please enter the M-Pesa number that should receive the STK push.")
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/billing/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey: selectedPlan.key,
          billingCycle,
          paymentMethod,
          payerName,
          mpesaPhone: paymentMethod === "mpesa" ? mpesaPhone : "",
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not start secure checkout.")
        setSubmitting(false)
        return
      }

      window.location.href = data.url
    } catch {
      setError("We could not connect to the payment service. Please try again.")
      setSubmitting(false)
    }
  }

  const annualMonthlyEquivalent = selectedPlan.annualPriceUsd / 12
  const savings =
    selectedPlan.monthlyPriceUsd > 0
      ? Math.max(
          0,
          Math.round(
            ((selectedPlan.monthlyPriceUsd - annualMonthlyEquivalent) / selectedPlan.monthlyPriceUsd) * 100
          )
        )
      : 0

  const sectionClassName = "rounded-[28px] border p-6 sm:p-7"
  const sectionStyle = {
    borderColor: "var(--border-subtle)",
    background: "var(--surface)",
  } satisfies React.CSSProperties
  const mutedTextStyle = { color: "var(--text-secondary)" } satisfies React.CSSProperties
  const subtleTextStyle = { color: "var(--text-muted)" } satisfies React.CSSProperties
  const elevatedStyle = {
    borderColor: "color-mix(in srgb, var(--border-subtle) 70%, transparent)",
    background: "var(--surface-2)",
  } satisfies React.CSSProperties

  return (
    <div className="dashboard-page-shell" style={{ maxWidth: 1040 }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            style={{
              margin: "0 0 0.45rem",
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.8rem",
              fontWeight: 400,
              color: "var(--text-primary)",
            }}
          >
            Upgrade your plan
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.92rem",
              color: "var(--text-secondary)",
              lineHeight: 1.7,
            }}
          >
            Choose billing, review tax separately, then continue to secure card or M-Pesa checkout.
          </p>
        </div>
        <Link
          href="/dashboard/billing"
          className="rounded-full border px-4 py-2 text-sm font-semibold transition"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
        >
          Back to billing
        </Link>
      </div>

      {!billingEnabled ? (
        <div className="mb-6">
          <BillingPausedNotice context="subscription" />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className={sectionClassName} style={sectionStyle}>
            <div className="mb-5">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em]" style={subtleTextStyle}>
                Plan selection
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold" style={{ color: "var(--text-primary)" }}>Pick the plan that fits your team</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const active = plan.key === planKey
                return (
                  <button
                    key={plan.key}
                    type="button"
                    onClick={() => billingEnabled && setPlanKey(plan.key)}
                    className={`rounded-[22px] border p-5 text-left transition ${
                      active
                        ? "border-[rgba(200,245,90,0.45)] bg-[rgba(200,245,90,0.08)]"
                        : ""
                    }`}
                    style={active ? undefined : elevatedStyle}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={`h-5 w-5 rounded-full border flex items-center justify-center`} style={{ borderColor: active ? "#C8F55A" : "color-mix(in srgb, var(--text-primary) 28%, transparent)" }}>
                        {active ? <span className="h-2.5 w-2.5 rounded-full bg-[#C8F55A]" /> : null}
                      </div>
                      {plan.key === "pro" ? (
                        <span className="rounded-full bg-[rgba(200,245,90,0.12)] px-3 py-1 text-xs font-semibold text-[#C8F55A]">
                          Popular
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-5 text-[1.15rem] font-semibold" style={{ color: "var(--text-primary)" }}>{plan.name}</p>
                    <p className="mt-2 text-sm" style={mutedTextStyle}>
                      {Math.round(plan.commissionRate * 100)}% paid-ticket commission
                    </p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className={sectionClassName} style={sectionStyle}>
            <div className="mb-5">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em]" style={subtleTextStyle}>
                Billing cycle
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold" style={{ color: "var(--text-primary)" }}>{selectedPlan.name} plan</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(["monthly", "annual"] as SubscriptionBillingCycle[]).map((cycle) => {
                const active = billingCycle === cycle
                const price =
                  cycle === "annual" ? selectedPlan.annualPriceUsd : selectedPlan.monthlyPriceUsd
                return (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => billingEnabled && setBillingCycle(cycle)}
                    className={`rounded-[22px] border p-6 text-left transition ${
                      active
                        ? "border-[#C8F55A] bg-[rgba(200,245,90,0.08)]"
                        : ""
                    }`}
                    style={active ? undefined : elevatedStyle}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`h-6 w-6 rounded-full border flex items-center justify-center`} style={{ borderColor: active ? "#C8F55A" : "color-mix(in srgb, var(--text-primary) 28%, transparent)" }}>
                        {active ? <span className="h-3 w-3 rounded-full bg-[#C8F55A]" /> : null}
                      </div>
                      {cycle === "annual" && savings > 0 ? (
                        <span className="rounded-full bg-[rgba(200,245,90,0.12)] px-3 py-1 text-xs font-semibold text-[#C8F55A]">
                          Save {savings}%
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-6 text-[1.65rem] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {cycle === "monthly" ? "Monthly" : "Yearly"}
                    </p>
                    <p className="mt-2 text-[1.05rem]" style={{ color: "var(--text-secondary)" }}>
                      {formatUsd(price)}
                      {cycle === "monthly" ? "/month" : "/year"} + tax
                    </p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className={sectionClassName} style={sectionStyle}>
            <div className="mb-5">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em]" style={subtleTextStyle}>
                Payment method
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold" style={{ color: "var(--text-primary)" }}>Choose how you want to pay</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  key: "card" as const,
                  title: "Card checkout",
                  description: "Secure hosted checkout for Visa, Mastercard, and international cards charged in KES.",
                  icon: <CreditCard className="h-5 w-5" />,
                },
                {
                  key: "mpesa" as const,
                  title: "M-Pesa checkout",
                  description: "Secure mobile-money checkout for local payments in Kenya.",
                  icon: <Smartphone className="h-5 w-5" />,
                },
              ].map((option) => {
                const active = paymentMethod === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => billingEnabled && setPaymentMethod(normalizePaymentMethod(option.key))}
                    className={`rounded-[22px] border p-5 text-left transition ${
                      active
                        ? "border-[#C8F55A] bg-[rgba(200,245,90,0.08)]"
                        : ""
                    }`}
                    style={active ? undefined : elevatedStyle}
                  >
                    <div className="flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--text-primary) 5%, transparent)" }}>
                        {option.icon}
                      </span>
                      <div>
                        <p className="font-semibold">{option.title}</p>
                        <p className="mt-1 text-sm" style={mutedTextStyle}>{option.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 rounded-[20px] border border-[rgba(124,199,255,0.18)] bg-[rgba(124,199,255,0.06)] p-4 text-sm text-[#D8ECFF]">
              {paymentMethod === "card"
                ? "You will continue to a secure hosted payment page to enter your real card details. International cards are supported and settled in KES using today's billing rate."
                : "You will continue to a secure hosted payment page to complete M-Pesa checkout. The payable amount is shown in KES for mobile-money settlement."}
            </div>
          </section>

          <section className={sectionClassName} style={sectionStyle}>
            <div className="mb-5">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em]" style={subtleTextStyle}>
                Checkout details
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold" style={{ color: "var(--text-primary)" }}>
                {paymentMethod === "card" ? "Secure card checkout" : "M-Pesa checkout"}
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Account holder name</span>
                <input
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  disabled={!billingEnabled}
                  placeholder="Alpha Tech Solutions"
                  className="w-full rounded-[18px] border px-4 py-3 text-sm outline-none transition focus:border-[rgba(200,245,90,0.45)]"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                />
              </label>

              {paymentMethod === "mpesa" ? (
                <>
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>M-Pesa number</span>
                    <input
                      value={mpesaPhone}
                      onChange={(event) => setMpesaPhone(event.target.value)}
                      disabled={!billingEnabled}
                      inputMode="tel"
                      placeholder="07XX XXX XXX"
                      className="w-full rounded-[18px] border px-4 py-3 text-sm outline-none transition focus:border-[rgba(200,245,90,0.45)]"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                    />
                  </label>
                  <div className="sm:col-span-2 rounded-[20px] border p-4 text-sm" style={{ borderColor: "rgba(200,245,90,0.12)", background: "rgba(200,245,90,0.05)", color: "var(--text-secondary)" }}>
                    We will send the checkout prompt to this number after you continue. Use the Safaricom line that should approve the payment.
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2 rounded-[20px] border p-4" style={elevatedStyle}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Accepted cards</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Visa", "Mastercard", "American Express", "Discover"].map((brand) => (
                      <span
                        key={brand}
                        className="rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-6" style={mutedTextStyle}>
                    Your real card number, expiry date, and CVC are collected on the secure Paystack card page after you continue. That keeps EventSlot out of raw card handling while still supporting prepaid and postpaid cards.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-[28px] border p-6 sm:p-7" style={sectionStyle}>
          <div className="flex items-center gap-3 text-[#C8F55A]">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em]">Order details</p>
          </div>

          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{selectedPlan.name} plan</p>
              <p className="mt-1 text-sm" style={mutedTextStyle}>
                {billingCycle === "annual" ? "Annually" : "Monthly"}
              </p>
            </div>
            <p className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatUsd(billingCycle === "annual" ? selectedPlan.annualPriceUsd : selectedPlan.monthlyPriceUsd)}
            </p>
          </div>

          <div className="my-6 border-t" style={{ borderColor: "var(--border-subtle)" }} />

          <div className="space-y-4 text-[0.98rem]">
            <div className="flex items-center justify-between gap-4">
              <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatUsd(quote.subtotalUsd)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span style={{ color: "var(--text-secondary)" }}>Tax 16%</span>
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatUsd(quote.taxUsd)}</span>
            </div>
          </div>

          <div className="my-6 border-t" style={{ borderColor: "var(--border-subtle)" }} />

          <div className="flex items-center justify-between gap-4">
            <span className="text-[1.05rem] font-semibold" style={{ color: "var(--text-primary)" }}>Total due today</span>
            <span className="text-[1.5rem] font-semibold" style={{ color: "var(--text-primary)" }}>{formatUsd(quote.totalUsd)}</span>
          </div>

          <div className="mt-3 rounded-[18px] border p-4 text-sm" style={{ ...elevatedStyle, color: "var(--text-secondary)" }}>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{accountName}</p>
            <p className="mt-1">{accountEmail}</p>
            <p className="mt-3 text-[#C8F55A]">
              {paymentMethod === "mpesa"
                ? `M-Pesa settlement estimate: ${formatKes(quote.totalKes)}`
                : `Card checkout settles in KES today: ${formatKes(quote.totalKes)}`}
            </p>
          </div>

          {error ? (
            <div className="mt-5 rounded-[18px] border border-[rgba(255,107,107,0.24)] bg-[rgba(255,107,107,0.08)] px-4 py-3 text-sm text-[#FFB6B6]">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={submitting || planIsCurrent || !billingEnabled}
            className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold transition ${
              planIsCurrent || !billingEnabled
                ? "cursor-default border border-[rgba(200,245,90,0.18)] bg-[rgba(200,245,90,0.08)] text-[#C8F55A]"
                : "bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#d4ff68]"
            }`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {!billingEnabled
              ? "Coming soon"
              : planIsCurrent
              ? "You are already on this plan"
              : paymentMethod === "card"
                ? "Continue to secure card checkout"
                : "Continue to secure M-Pesa checkout"}
          </button>

          <p className="mt-4 text-center text-xs leading-6" style={{ color: "var(--text-muted)" }}>
            Secure checkout is hosted by our payment provider. Organizer ticket funds remain separate from EventSlot subscription revenue.
          </p>
        </aside>
      </div>
    </div>
  )
}
