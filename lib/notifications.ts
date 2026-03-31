import { prisma } from "@/lib/prisma"

export async function createNotification({
  userId,
  type,
  message,
  eventId,
}: {
  userId: string
  type: string
  message: string
  eventId?: string
}) {
  await prisma.notification.create({
    data: { userId, type, message, eventId },
  })
}
