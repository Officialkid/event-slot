import type { SubscriptionPlanDefinition } from "@/lib/subscriptionPlans"

export const SUBSCRIPTION_TAX_RATE = 0.16
export const DEFAULT_KES_USD_RATE = 130
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 3

export type SubscriptionBillingCycle = "monthly" | "annual"
export type SubscriptionPaymentMethod = "card" | "mpesa"

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function normalizeBillingCycle(value: string | null | undefined): SubscriptionBillingCycle {
  return value === "annual" ? "annual" : "monthly"
}

export function normalizePaymentMethod(value: string | null | undefined): SubscriptionPaymentMethod {
  return value === "mpesa" ? "mpesa" : "card"
}

export function getSubscriptionBillingQuote(
  plan: Pick<SubscriptionPlanDefinition, "monthlyPriceUsd" | "annualPriceUsd">,
  billingCycle: SubscriptionBillingCycle,
  exchangeRate: number = DEFAULT_KES_USD_RATE
) {
  const subtotalUsd = billingCycle === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd
  const taxUsd = roundCurrency(subtotalUsd * SUBSCRIPTION_TAX_RATE)
  const totalUsd = roundCurrency(subtotalUsd + taxUsd)

  const subtotalKes = Math.ceil(subtotalUsd * exchangeRate)
  const taxKes = Math.ceil(taxUsd * exchangeRate)
  const totalKes = subtotalKes + taxKes

  return {
    exchangeRate,
    subtotalUsd,
    taxUsd,
    totalUsd,
    subtotalKes,
    taxKes,
    totalKes,
  }
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatKes(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Checks whether an expired or failed subscription is currently within its grace period.
 */
export function isSubscriptionInGracePeriod(
  periodEnd: Date | string | null | undefined,
  graceDays = SUBSCRIPTION_GRACE_PERIOD_DAYS,
  now = new Date()
): boolean {
  if (!periodEnd) return false
  const end = new Date(periodEnd)
  if (isNaN(end.getTime())) return false

  const graceExpiry = new Date(end)
  graceExpiry.setDate(graceExpiry.getDate() + graceDays)

  return now.getTime() >= end.getTime() && now.getTime() <= graceExpiry.getTime()
}

/**
 * Calculates start and end dates for a recurring billing period.
 */
export function calculateNextBillingPeriod(
  startDate: Date = new Date(),
  billingCycle: SubscriptionBillingCycle = "monthly"
): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(startDate)
  const periodEnd = new Date(startDate)

  if (billingCycle === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  return { periodStart, periodEnd }
}

/**
 * Validates that webhook payment amount minor units match expected amount within 1 minor unit tolerance (rounding).
 */
export function verifySubscriptionPaymentAmount(
  expectedMinor: number,
  actualMinor: number
): boolean {
  return Math.abs(expectedMinor - actualMinor) <= 1
}
