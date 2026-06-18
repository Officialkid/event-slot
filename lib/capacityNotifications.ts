import prisma from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { sendOrganizerCapacity90Email, sendOrganizerCapacityFullEmail } from "@/lib/email"

const NOTIFICATION_THRESHOLDS = [0.25, 0.5, 0.75, 1]

function formatThresholdLabel(threshold: number) {
  return `${Math.round(threshold * 100)}%`
}

export async function sendEventCapacityMilestones(input: {
  eventId: string
  eventSlug: string
  eventTitle: string
  organizerId: string | null | undefined
  previousConfirmedCount: number
  capacity: number | null | undefined
  waitlistCount?: number
}) {
  const { organizerId, capacity } = input
  if (!organizerId || !capacity || capacity < 1) return

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      confirmedCount: true,
      waitlistCount: true,
      organizer: {
        select: {
          email: true,
          consentSystemEmails: true,
        },
      },
    },
  })

  if (!event) return

  const oldFill = input.previousConfirmedCount / capacity
  const newFill = event.confirmedCount / capacity

  for (const threshold of NOTIFICATION_THRESHOLDS) {
    if (!(oldFill < threshold && newFill >= threshold)) continue

    const percentage = formatThresholdLabel(threshold)
    const title = threshold >= 1 ? "Event Full" : `Capacity at ${percentage}`
    const message =
      threshold >= 1
        ? `Your event "${input.eventTitle}" is now full. ${event.waitlistCount} ${event.waitlistCount === 1 ? "person is" : "people are"} on the waitlist.`
        : `Your event "${input.eventTitle}" has reached ${percentage} of capacity (${event.confirmedCount}/${capacity}).`

    await createNotification({
      userId: organizerId,
      type: "EVENT",
      title,
      message,
      link: `/dashboard/events/${input.eventSlug}#capacity`,
    }).catch(() => {})

    if (event.organizer?.email && event.organizer.consentSystemEmails) {
      if (threshold >= 1) {
        await sendOrganizerCapacityFullEmail({
          to: event.organizer.email,
          eventTitle: input.eventTitle,
          waitlistCount: input.waitlistCount ?? event.waitlistCount,
        }).catch(() => {})
      } else if (threshold >= 0.75) {
        await sendOrganizerCapacity90Email({
          to: event.organizer.email,
          eventTitle: input.eventTitle,
          confirmedCount: event.confirmedCount,
          capacity,
        }).catch(() => {})
      }
    }
  }
}

export async function sendTierCapacityMilestones(input: {
  eventId: string
  eventSlug: string
  eventTitle: string
  organizerId: string | null | undefined
  tierId: string
  tierName: string
  previousSoldCount: number
  capacity: number
}) {
  const { organizerId, capacity } = input
  if (!organizerId || capacity < 1) return

  const tier = await prisma.ticketTier.findUnique({
    where: { id: input.tierId },
    select: {
      soldCount: true,
      waitlistCount: true,
      event: {
        select: {
          organizer: {
            select: {
              email: true,
              consentSystemEmails: true,
            },
          },
        },
      },
    },
  })

  if (!tier) return

  const oldFill = input.previousSoldCount / capacity
  const newFill = tier.soldCount / capacity

  for (const threshold of NOTIFICATION_THRESHOLDS) {
    if (!(oldFill < threshold && newFill >= threshold)) continue

    const percentage = formatThresholdLabel(threshold)
    const title = threshold >= 1 ? `${input.tierName} tier full` : `${input.tierName} tier at ${percentage}`
    const message =
      threshold >= 1
        ? `Your ${input.tierName} tier for "${input.eventTitle}" is now full.`
        : `Your ${input.tierName} tier for "${input.eventTitle}" has reached ${percentage} of capacity (${tier.soldCount}/${capacity}).`

    await createNotification({
      userId: organizerId,
      type: "EVENT",
      title,
      message,
      link: `/dashboard/events/${input.eventSlug}#capacity`,
    }).catch(() => {})

    if (tier.event.organizer?.email && tier.event.organizer.consentSystemEmails) {
      if (threshold >= 1) {
        await sendOrganizerCapacityFullEmail({
          to: tier.event.organizer.email,
          eventTitle: `${input.eventTitle} · ${input.tierName}`,
          waitlistCount: tier.waitlistCount,
        }).catch(() => {})
      } else if (threshold >= 0.75) {
        await sendOrganizerCapacity90Email({
          to: tier.event.organizer.email,
          eventTitle: `${input.eventTitle} · ${input.tierName}`,
          confirmedCount: tier.soldCount,
          capacity,
        }).catch(() => {})
      }
    }
  }
}
