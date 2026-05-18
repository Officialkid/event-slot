import { prisma } from "@/lib/prisma"
import { creditTokens } from "@/lib/tokens"

export async function markEventCompleted(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organizer: { select: { id: true, email: true, plan: true } } },
  })

  if (!event) throw new Error("Event not found")

  // Calculate expiry: 30 days from now for Free tier, null (never expires) for Pro/Business
  const isFree = event.organizer?.plan === "free"
  const expiresAt = isFree
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    : null // Pro/Business — never expires

  await prisma.event.update({
    where: { id: eventId },
    data: {
      status: "COMPLETED",
      expiresAt,
    },
  })

  if (event.organizerId) {
    const completedCount = await prisma.event.count({
      where: {
        organizerId: event.organizerId,
        status: "COMPLETED",
      },
    })

    if (completedCount === 1) {
      await creditTokens(
        event.organizerId,
        20,
        "BONUS",
        "First event completed - free report tokens",
        eventId
      )

      await prisma.notification.create({
        data: {
          userId: event.organizerId,
          type: "PLATFORM",
          title: "Your first report is on us!",
          message: `Your event "${event.title}" has ended. We've added 20 free tokens to your account - download your full AI event report at no cost. Go to your event dashboard to generate it.`,
          link: `/dashboard/events/${event.slug}`,
        },
      })
    }
  }

  return { eventId, expiresAt, userPlan: event.organizer?.plan }
}
