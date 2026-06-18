import { isPricingRolloutActive } from "@/lib/pricingRollout"

export type PlanKey = "free" | "standard" | "pro" | "business"

export type EffectivePlanPolicy = {
  key: PlanKey
  displayName: string
  maxAttendeesPerEvent: number
  maxActiveEvents: number
  maxWaitlistPerEvent: number
  hasWaitlist: boolean
  hasPayg: boolean
  pricingActive: boolean
}

const ACTIVE_PLAN_POLICIES: Record<PlanKey, Omit<EffectivePlanPolicy, "pricingActive">> = {
  free: {
    key: "free",
    displayName: "Free",
    maxAttendeesPerEvent: 55,
    maxActiveEvents: 1,
    maxWaitlistPerEvent: 0,
    hasWaitlist: false,
    hasPayg: true,
  },
  standard: {
    key: "standard",
    displayName: "Standard",
    maxAttendeesPerEvent: 200,
    maxActiveEvents: 5,
    maxWaitlistPerEvent: 100,
    hasWaitlist: true,
    hasPayg: true,
  },
  pro: {
    key: "pro",
    displayName: "Pro",
    maxAttendeesPerEvent: 1000,
    maxActiveEvents: 20,
    maxWaitlistPerEvent: 500,
    hasWaitlist: true,
    hasPayg: true,
  },
  business: {
    key: "business",
    displayName: "Business",
    maxAttendeesPerEvent: -1,
    maxActiveEvents: -1,
    maxWaitlistPerEvent: -1,
    hasWaitlist: true,
    hasPayg: true,
  },
}

const OPEN_ACCESS_POLICY: Omit<EffectivePlanPolicy, "pricingActive"> = {
  key: "business",
  displayName: "Open Access",
  maxAttendeesPerEvent: -1,
  maxActiveEvents: -1,
  maxWaitlistPerEvent: -1,
  hasWaitlist: true,
  hasPayg: true,
}

export function normalizePlanKey(plan: string | null | undefined): PlanKey {
  const value = (plan ?? "free").trim().toLowerCase()
  if (value === "standard" || value === "pro" || value === "business") return value
  return "free"
}

export function getEffectivePlanPolicy(plan: string | null | undefined, now: Date = new Date()): EffectivePlanPolicy {
  const pricingActive = isPricingRolloutActive(now)
  if (!pricingActive) {
    return {
      ...OPEN_ACCESS_POLICY,
      pricingActive,
    }
  }

  const key = normalizePlanKey(plan)
  return {
    ...ACTIVE_PLAN_POLICIES[key],
    pricingActive,
  }
}

export function getNextPlanKey(plan: string | null | undefined): PlanKey | null {
  const key = normalizePlanKey(plan)
  if (key === "free") return "standard"
  if (key === "standard") return "pro"
  if (key === "pro") return "business"
  return null
}
