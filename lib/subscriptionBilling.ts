import type { SubscriptionPlanDefinition } from "@/lib/subscriptionPlans"

export const SUBSCRIPTION_TAX_RATE = 0.16
export const DEFAULT_KES_USD_RATE = 130

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
