export type SubscriptionPlanDefinition = {
  key: "free" | "standard" | "pro" | "business"
  name: string
  monthlyPriceUsd: number
  annualPriceUsd: number
  attendeesPerEvent: string
  waitlistCap: string
  activeEvents: string
  organizerSeats: string
  dataRetention: string
  commissionRate: number
  highlights: string[]
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDefinition[] = [
  {
    key: "free",
    name: "Free",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    attendeesPerEvent: "50",
    waitlistCap: "None",
    activeEvents: "1",
    organizerSeats: "1",
    dataRetention: "14 days",
    commissionRate: 0.10,
    highlights: [
      "Best for first-time organisers",
      "One active event at a time",
      "Good for testing EventSlot with a small audience",
    ],
  },
  {
    key: "standard",
    name: "Standard",
    monthlyPriceUsd: 9,
    annualPriceUsd: 90,
    attendeesPerEvent: "200",
    waitlistCap: "100",
    activeEvents: "5",
    organizerSeats: "3",
    dataRetention: "90 days",
    commissionRate: 0.08,
    highlights: [
      "PDF tickets and QR check-in",
      "Basic analytics and 1 AI insight each month",
      "A solid fit for solo organisers running regular events",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPriceUsd: 25,
    annualPriceUsd: 250,
    attendeesPerEvent: "1,000",
    waitlistCap: "500",
    activeEvents: "20",
    organizerSeats: "10",
    dataRetention: "1 year",
    commissionRate: 0.05,
    highlights: [
      "Full analytics, AI reports, and email campaigns",
      "Custom branding and event FAQ system",
      "Designed to be the default home for active communities",
    ],
  },
  {
    key: "business",
    name: "Business",
    monthlyPriceUsd: 69,
    annualPriceUsd: 690,
    attendeesPerEvent: "Unlimited",
    waitlistCap: "Unlimited",
    activeEvents: "Unlimited",
    organizerSeats: "30",
    dataRetention: "Indefinite",
    commissionRate: 0.03,
    highlights: [
      "Custom domain, recurring events, API access",
      "Priority support for teams and agencies",
      "Built for organisations managing many events at once",
    ],
  },
]

export function getSubscriptionPlan(plan: string | null | undefined) {
  const key = (plan ?? "free").trim().toLowerCase()
  return SUBSCRIPTION_PLANS.find((entry) => entry.key === key) ?? SUBSCRIPTION_PLANS[0]
}

export function formatCommissionRate(rate: number) {
  return `${Math.round(rate * 100)}%`
}
