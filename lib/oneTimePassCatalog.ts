import { DEFAULT_KES_USD_RATE } from "@/lib/subscriptionBilling"
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans"

export type OneTimePassTier = "standard" | "pro" | "business"
export type EventPassStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED"

const PASS_FEATURE_SUMMARIES: Record<OneTimePassTier, string[]> = {
  standard: [
    "PDF tickets and QR check-in",
    "Basic analytics for this event",
    "Standard commission for paid tickets",
  ],
  pro: [
    "Full analytics and AI reports for this event",
    "Advanced event tools and lower commission",
    "Best for premium one-off launches",
  ],
  business: [
    "Business-tier event tooling for this event",
    "Lowest commission on paid tickets",
    "Best for large productions and agency delivery",
  ],
}

function roundUsd(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function normalizeOneTimePassTier(value: string | null | undefined): OneTimePassTier | null {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "standard" || normalized === "pro" || normalized === "business") {
    return normalized
  }
  return null
}

export function getOneTimePassQuote(
  tier: OneTimePassTier,
  exchangeRate: number = DEFAULT_KES_USD_RATE
) {
  const plan = SUBSCRIPTION_PLANS.find((entry) => entry.key === tier)
  if (!plan) {
    throw new Error(`Unsupported one-time pass tier: ${tier}`)
  }

  const priceUsd = roundUsd(plan.monthlyPriceUsd / 4)
  const priceKes = Math.ceil(priceUsd * exchangeRate)

  return {
    tier,
    name: `${plan.name} Pass`,
    priceUsd,
    priceKes,
    exchangeRate,
    commissionRate: plan.commissionRate,
    features: PASS_FEATURE_SUMMARIES[tier],
    monthlyReferenceUsd: plan.monthlyPriceUsd,
    expiryRule: "Expires when the event ends",
  }
}

export function getOneTimePassTiers(exchangeRate: number = DEFAULT_KES_USD_RATE) {
  return (["standard", "pro", "business"] as const).map((tier) => getOneTimePassQuote(tier, exchangeRate))
}

export function getEventPassExpiryDate(eventDate: Date | null | undefined, eventEndAt: Date | null | undefined) {
  return eventEndAt ?? eventDate ?? null
}
