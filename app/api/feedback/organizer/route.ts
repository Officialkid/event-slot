import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { notificationId, eventId, rating, message } = await req.json()

    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 })
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const event = eventId
      ? await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } })
      : null

    await prisma.organizerFeedback.create({
      data: {
        organizerId: session.user.id,
        type: "general",
        subject: event?.title ? `Feedback on: ${event.title}` : "General feedback",
        rating,
        message: message.trim(),
      },
    })

    await prisma.message.create({
      data: {
        senderName: session.user.name ?? null,
        senderEmail: session.user.email ?? null,
        eventId: eventId ?? null,
        eventTitle: event?.title ?? null,
        type: "organizer",
        rating,
        body: message.trim(),
      },
    })

    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId, userId: session.user.id },
        data: { read: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[feedback/organizer] POST error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
