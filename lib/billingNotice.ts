export type BillingNoticeContext =
  | "paidEventRegistration"
  | "eventPass"
  | "subscription"
  | "payg"

type BillingNoticeCopy = {
  eyebrow: string
  headline: string
  body: string
  error: string
}

const BILLING_NOTICE_COPY: Record<BillingNoticeContext, BillingNoticeCopy> = {
  paidEventRegistration: {
    eyebrow: "Paid event",
    headline: "Checkout is not live yet",
    body: "This event uses paid tickets, but checkout is still paused for now.",
    error: "Paid-event checkout is still being finalized, so paid registrations are paused for now.",
  },
  eventPass: {
    eyebrow: "One-time pass",
    headline: "Payments are coming soon",
    body: "Event-pass checkout is still being finalized, so premium pass payments remain paused for now.",
    error: "Event-pass checkout is still being finalized, so premium pass payments are paused for now.",
  },
  subscription: {
    eyebrow: "Subscription billing",
    headline: "Payments are coming soon",
    body: "Subscription checkout is still being finalized, so billing upgrades remain paused for now while access stays open.",
    error: "Subscription checkout is still being finalized, so billing upgrades are paused for now.",
  },
  payg: {
    eyebrow: "PAYG billing",
    headline: "Payments are coming soon",
    body: "PAYG overflow billing is still being finalized, so overage charging stays paused for now.",
    error: "PAYG overflow billing is still being finalized, so overage charging is paused for now.",
  },
}

export function getBillingNoticeCopy(context: BillingNoticeContext): BillingNoticeCopy {
  return BILLING_NOTICE_COPY[context]
}
