import prisma from "@/lib/prisma"
import { getPaidEventCommissionRate } from "@/lib/paidEventCommission"
import { normalizePlanKey, type PlanKey } from "@/lib/effectivePlanPolicy"
import { isBillingComingSoonMode } from "@/lib/pricingRollout"
import {
  getEventPassExpiryDate,
  getOneTimePassQuote,
  normalizeOneTimePassTier,
  type OneTimePassTier,
} from "@/lib/oneTimePassCatalog"

export type EffectiveEventPlanSource = "event_pass" | "subscription" | "free"

export type EffectiveEventPlan = {
  planKey: PlanKey
  source: EffectiveEventPlanSource
  commissionRate: number
  eventPassTier: OneTimePassTier | null
  eventPassStatus: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED" | null
  eventPassExpiresAt: Date | null
}

export const EVENT_SCOPED_PLAN_FEATURES = [
  "hasWaitlist",
  "hasPdfTickets",
  "hasQrCheckin",
  "hasBasicAnalytics",
  "hasFullAnalytics",
  "hasAiInsights",
  "hasAiReports",
  "hasEmailCampaigns",
  "hasCustomBranding",
  "hasCustomDomain",
  "hasFaqSystem",
  "hasRecurringEvents",
  "hasApiAccess",
  "hasPrioritySupport",
] as const

export type EventScopedPlanFeature = (typeof EVENT_SCOPED_PLAN_FEATURES)[number]

function normalizePassTierEnum(value: string | null | undefined): OneTimePassTier | null {
  return normalizeOneTimePassTier(value)
}

export async function syncEventPassStatusForEvent(eventId: string, now: Date = new Date()) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      archived: true,
      status: true,
      eventDate: true,
      eventEndAt: true,
      eventPass: {
        select: {
          id: true,
          status: true,
          expiresAt: true,
        },
      },
    },
  })

  if (!event?.eventPass) return null

  const expiry = getEventPassExpiryDate(event.eventDate, event.eventEndAt)
  const normalizedStatus = (event.status ?? "").trim().toLowerCase()
  const shouldCancel = event.archived || normalizedStatus === "cancelled" || normalizedStatus === "archived"

  if (shouldCancel && event.eventPass.status !== "CANCELLED") {
    return prisma.eventPass.update({
      where: { id: event.eventPass.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        expiresAt: now,
      },
    })
  }

  if (event.eventPass.status === "ACTIVE") {
    if (expiry && expiry.getTime() <= now.getTime()) {
      return prisma.eventPass.update({
        where: { id: event.eventPass.id },
        data: {
          status: "EXPIRED",
          expiresAt: expiry,
        },
      })
    }

    if (
      expiry &&
      (!event.eventPass.expiresAt || event.eventPass.expiresAt.getTime() !== expiry.getTime())
    ) {
      return prisma.eventPass.update({
        where: { id: event.eventPass.id },
        data: {
          expiresAt: expiry,
        },
      })
    }
  }

  return null
}

export async function getEffectiveEventPlan(eventId: string, organizerId: string | null | undefined): Promise<EffectiveEventPlan> {
  if (isBillingComingSoonMode()) {
    return {
      planKey: "business",
      source: "subscription",
      commissionRate: 0,
      eventPassTier: null,
      eventPassStatus: null,
      eventPassExpiresAt: null,
    }
  }

  await syncEventPassStatusForEvent(eventId).catch(() => null)

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizerId: true,
      eventPass: {
        select: {
          tier: true,
          status: true,
          expiresAt: true,
        },
      },
    },
  })

  const organizer = organizerId
    ? await prisma.user.findUnique({
        where: { id: organizerId },
        select: { plan: true },
      })
    : null

  const passTier = normalizePassTierEnum(event?.eventPass?.tier)
  if (event?.eventPass?.status === "ACTIVE" && passTier) {
    return {
      planKey: passTier,
      source: "event_pass",
      commissionRate: getOneTimePassQuote(passTier).commissionRate,
      eventPassTier: passTier,
      eventPassStatus: "ACTIVE",
      eventPassExpiresAt: event.eventPass.expiresAt ?? null,
    }
  }

  const subscriptionPlan = normalizePlanKey(organizer?.plan)
  if (subscriptionPlan !== "free") {
    return {
      planKey: subscriptionPlan,
      source: "subscription",
      commissionRate: getPaidEventCommissionRate(subscriptionPlan),
      eventPassTier: passTier,
      eventPassStatus: event?.eventPass?.status ?? null,
      eventPassExpiresAt: event?.eventPass?.expiresAt ?? null,
    }
  }

  return {
    planKey: "free",
    source: "free",
    commissionRate: getPaidEventCommissionRate("free"),
    eventPassTier: passTier,
    eventPassStatus: event?.eventPass?.status ?? null,
    eventPassExpiresAt: event?.eventPass?.expiresAt ?? null,
  }
}

export async function canUseEventScopedFeature(eventId: string, organizerId: string | null | undefined, feature: EventScopedPlanFeature) {
  const effectivePlan = await getEffectiveEventPlan(eventId, organizerId)
  const plan = await prisma.plan.findUnique({
    where: { name: effectivePlan.planKey },
    select: { [feature]: true, name: true },
  })

  return {
    allowed: Boolean(plan?.[feature]),
    effectivePlan,
  }
}
