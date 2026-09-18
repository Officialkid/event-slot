import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import { sendEmail } from "@/lib/email"
import { env } from "@/lib/env"
import { getConfiguredMarketingFrom } from "@/lib/emailProvider"
import { APP_URL } from "@/lib/config"
import { renderBroadcastEmail, type BroadcastLayoutType } from "@/lib/emailTemplates"

const EMAIL_FROM = getConfiguredMarketingFrom(env, "EventSlot <hello@eventsslot.com>")

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const mode = req.nextUrl.searchParams.get("mode") || "SUBSCRIBED"

    const where = mode === "SUBSCRIBED"
      ? { marketingConsent: true, email: { not: null }, suspended: false }
      : { email: { not: null }, suspended: false }

    const [recipientCount, scheduled] = await Promise.all([
      prisma.user.count({ where }),
      prisma.scheduledBroadcast.findMany({
        orderBy: { scheduledFor: "desc" },
        take: 20,
      }),
    ])

    return NextResponse.json({
      recipientCount,
      scheduled,
    })
  } catch (error) {
    console.error("[Marketing Broadcast GET error]", error)
    return NextResponse.json({ error: "Failed to load broadcast stats" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canSendBroadcast")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await req.json()
    const {
      title,
      subject,
      content,
      layoutType = "PROMOTIONAL_HERO",
      preheader,
      bannerUrl,
      ctaText,
      ctaUrl,
      eventDateLabel,
      eventLocation,
      eventBadge,
      mode = "SUBSCRIBED",
      isTest = false,
      testEmail,
      scheduleFor,
    } = body

    if (!subject?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Subject and content are required." }, { status: 400 })
    }

    // 1. Test Email Send
    if (isTest) {
      const destination = (testEmail || auth.context.email).trim()
      const testHtml = renderBroadcastEmail({
        layoutType: layoutType as BroadcastLayoutType,
        subject: `[TEST] ${subject}`,
        preheader,
        bannerUrl,
        content,
        ctaText,
        ctaUrl,
        eventDateLabel,
        eventLocation,
        eventBadge,
        userId: auth.context.userId,
        recipientName: auth.context.name || "Marketer",
      })

      await sendEmail({
        from: EMAIL_FROM,
        to: destination,
        subject: `[TEST] ${subject}`,
        html: testHtml,
        category: "marketing",
        unsubscribeUrl: `${APP_URL}/unsubscribe?test=true`,
      })

      return NextResponse.json({
        success: true,
        message: `Test email sent to ${destination}`,
      })
    }

    // 2. Schedule for Future Date
    if (scheduleFor) {
      const targetDate = new Date(scheduleFor)
      if (isNaN(targetDate.getTime()) || targetDate <= new Date()) {
        return NextResponse.json({ error: "Scheduled date must be in the future." }, { status: 400 })
      }

      const scheduled = await prisma.scheduledBroadcast.create({
        data: {
          title: title?.trim() || subject.trim(),
          subject: subject.trim(),
          layoutType,
          preheader: preheader?.trim() || null,
          bannerUrl: bannerUrl?.trim() || null,
          content: content.trim(),
          ctaText: ctaText?.trim() || null,
          ctaUrl: ctaUrl?.trim() || null,
          eventDateLabel: eventDateLabel?.trim() || null,
          eventLocation: eventLocation?.trim() || null,
          eventBadge: eventBadge?.trim() || null,
          mode,
          scheduledFor: targetDate,
          createdById: auth.context.userId,
          status: "SCHEDULED",
        },
      })

      await prisma.marketingAuditLog.create({
        data: {
          actorId: auth.context.userId,
          actorEmail: auth.context.email,
          action: "BROADCAST_SCHEDULED",
          entityType: "CONTENT",
          entityId: scheduled.id,
          metadata: { subject, scheduledFor: targetDate },
        },
      })

      return NextResponse.json({
        success: true,
        message: `Broadcast scheduled for ${targetDate.toLocaleString()}`,
        broadcast: scheduled,
      })
    }

    // 3. Immediate Live Broadcast (Dispatches to subscribers)
    const where = mode === "SUBSCRIBED"
      ? { marketingConsent: true, email: { not: null }, suspended: false }
      : { email: { not: null }, suspended: false }

    const recipients = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true },
    })

    let sentCount = 0
    let failedCount = 0

    for (const recipient of recipients) {
      if (!recipient.email) continue
      try {
        const html = renderBroadcastEmail({
          layoutType: layoutType as BroadcastLayoutType,
          subject,
          preheader,
          bannerUrl,
          content,
          ctaText,
          ctaUrl,
          eventDateLabel,
          eventLocation,
          eventBadge,
          userId: recipient.id,
          recipientName: recipient.name || "there",
        })

        await sendEmail({
          from: EMAIL_FROM,
          to: recipient.email,
          subject,
          html,
          category: "marketing",
          unsubscribeUrl: `${APP_URL}/api/email/unsubscribe?id=${recipient.id}`,
        })

        sentCount++
      } catch {
        failedCount++
      }
    }

    await prisma.marketingAuditLog.create({
      data: {
        actorId: auth.context.userId,
        actorEmail: auth.context.email,
        action: "BROADCAST_SENT",
        entityType: "CONTENT",
        metadata: { subject, sentCount, failedCount, mode },
      },
    })

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      message: `Broadcast sent to ${sentCount} recipients.`,
    })
  } catch (error) {
    console.error("[Marketing Broadcast POST error]", error)
    return NextResponse.json({ error: "Failed to process broadcast" }, { status: 500 })
  }
}
