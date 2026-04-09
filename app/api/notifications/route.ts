import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get("unread") === "true"

  if (unreadOnly) {
    const count = await prisma.notification.count({
      where: { userId: session.user.id, read: false },
    })
    return NextResponse.json({ count })
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  // Resolve event slugs for notifications that have an eventId
  const eventIds = Array.from(new Set(notifications.map(n => n.eventId).filter(Boolean) as string[]))
  const events = eventIds.length > 0
    ? await prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, slug: true } })
    : []
  const slugMap = Object.fromEntries(events.map(e => [e.id, e.slug]))

  const mapped = notifications.map(n => ({
    ...n,
    eventSlug: n.eventId ? (slugMap[n.eventId] ?? null) : null,
  }))

  return NextResponse.json({ notifications: mapped })
}
