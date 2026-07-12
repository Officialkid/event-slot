const FORCE_BILLING_COMING_SOON_MODE = true

export const PRICING_ROLLOUT_AT = new Date("2026-10-01T00:00:00+03:00")

export function isPricingRolloutActive(now: Date = new Date()) {
  if (FORCE_BILLING_COMING_SOON_MODE) return false
  return now.getTime() >= PRICING_ROLLOUT_AT.getTime()
}

export function isBillingCheckoutEnabled(now: Date = new Date()) {
  return isPricingRolloutActive(now)
}

export function isBillingComingSoonMode(now: Date = new Date()) {
  return !isBillingCheckoutEnabled(now)
}

export function getPricingRolloutLabel() {
  return "the full EventSlot payments launch"
}

export function getBillingComingSoonHeadline() {
  return "Payment system coming soon"
}
