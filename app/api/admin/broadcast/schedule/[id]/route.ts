import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"
import { sendEmail } from "@/lib/email"
import { getConfiguredEmailFrom } from "@/lib/emailProvider"
import { env } from "@/lib/env"
import { renderBroadcastEmail, type BroadcastLayoutType } from "@/lib/emailTemplates"

const EMAIL_FROM = getConfiguredEmailFrom(env, "EventSlot <hello@eventsslot.com>")

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.scheduledBroadcast.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 })
    }

    if (existing.status === "SENDING") {
      return NextResponse.json({ error: "Cannot cancel a broadcast currently being sent" }, { status: 400 })
    }

    await prisma.scheduledBroadcast.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Scheduled broadcast cancelled." })
  } catch (error) {
    console.error("[schedule/broadcast DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete scheduled broadcast" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const broadcast = await prisma.scheduledBroadcast.findUnique({
      where: { id },
    })

    if (!broadcast) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 })
    }

    if (broadcast.status === "SENDING") {
      return NextResponse.json({ error: "Broadcast is already sending" }, { status: 400 })
    }

    // Mark as SENDING
    await prisma.scheduledBroadcast.update({
      where: { id },
      data: { status: "SENDING" },
    })

    // Resolve audience
    let recipients: { id: string; name: string | null; email: string | null }[] = []
    if (broadcast.mode === "INDIVIDUAL" && Array.isArray(broadcast.specificUserIds)) {
      recipients = await prisma.user.findMany({
        where: { id: { in: broadcast.specificUserIds as string[] }, suspended: false, email: { not: null } },
        select: { id: true, name: true, email: true },
      })
    } else {
      const where = broadcast.mode === "SUBSCRIBED"
        ? { suspended: false, email: { not: null }, marketingConsent: true }
        : { suspended: false, email: { not: null } }
      recipients = await prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true },
      })
    }

    const validRecipients = recipients.filter(
      (r): r is { id: string; name: string | null; email: string } => Boolean(r.email && r.email.includes("@"))
    )

    let sent = 0
    let failed = 0

    for (const recipient of validRecipients) {
      const emailHtml = renderBroadcastEmail({
        layoutType: broadcast.layoutType as BroadcastLayoutType,
        subject: broadcast.subject,
        preheader: broadcast.preheader,
        bannerUrl: broadcast.bannerUrl,
        content: broadcast.content,
        ctaText: broadcast.ctaText,
        ctaUrl: broadcast.ctaUrl,
        eventDateLabel: broadcast.eventDateLabel,
        eventLocation: broadcast.eventLocation,
        eventBadge: broadcast.eventBadge,
        recipientName: recipient.name,
        userId: recipient.id,
      })

      try {
        await sendEmail({
          from: EMAIL_FROM,
          to: recipient.email,
          subject: broadcast.subject,
          html: emailHtml,
        })
        sent++
      } catch (err) {
        failed++
        console.error(`[broadcast/send-now] Error sending to ${recipient.email}:`, err)
      }

      // Small pacing delay
      await new Promise((r) => setTimeout(r, 200))
    }

    await prisma.scheduledBroadcast.update({
      where: { id },
      data: {
        status: failed === validRecipients.length && validRecipients.length > 0 ? "FAILED" : "SENT",
        sentAt: new Date(),
        sentCount: sent,
        failedCount: failed,
      },
    })

    return NextResponse.json({
      success: true,
      sent,
      failed,
      message: `Broadcast executed: ${sent} sent, ${failed} failed.`,
    })
  } catch (error) {
    console.error("[schedule/broadcast send-now] Error:", error)
    return NextResponse.json({ error: "Failed to dispatch broadcast" }, { status: 500 })
  }
}
