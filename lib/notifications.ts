import { prisma } from "@/lib/prisma"
import type { NotificationType } from "@prisma/client"

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: {
  userId: string
  type?: NotificationType
  title: string
  message: string
  link?: string
}) {
  await prisma.notification.create({
    data: { userId, type: type ?? "EVENT", title, message, link },
  })
}
