import { prisma } from "@/lib/prisma"

export async function markEventCompleted(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organizer: true },
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

  return { eventId, expiresAt, userPlan: event.organizer?.plan }
}
