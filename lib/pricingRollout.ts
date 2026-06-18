export const PRICING_ROLLOUT_AT = new Date("2026-06-22T00:00:00+03:00")

export function isPricingRolloutActive(now: Date = new Date()) {
  return now.getTime() >= PRICING_ROLLOUT_AT.getTime()
}

export function getPricingRolloutLabel() {
  return "22 June 2026, 12:00 AM EAT"
}
