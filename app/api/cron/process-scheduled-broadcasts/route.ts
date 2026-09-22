import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { getConfiguredMarketingFrom } from "@/lib/emailProvider"
import { env } from "@/lib/env"
import { APP_URL } from "@/lib/config"
import { renderBroadcastEmail, type BroadcastLayoutType } from "@/lib/emailTemplates"
import { isDeliverableEmail } from "@/lib/email/disposableDomains"

const EMAIL_FROM = getConfiguredMarketingFrom(env, "EventSlot <hello@eventsslot.com>")

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET?.trim()

    // Validate cron secret if configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()

    // Find any broadcast that is SCHEDULED and due
    const dueBroadcasts = await prisma.scheduledBroadcast.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: now },
      },
      take: 5,
    })

    if (dueBroadcasts.length === 0) {
      return NextResponse.json({ message: "No scheduled broadcasts due at this time.", processed: 0 })
    }

    const results = []

    for (const broadcast of dueBroadcasts) {
      // Mark as SENDING to prevent duplicate pickup
      await prisma.scheduledBroadcast.update({
        where: { id: broadcast.id },
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
        (r): r is { id: string; name: string | null; email: string } => Boolean(r.email && isDeliverableEmail(r.email))
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
            category: "marketing",
            unsubscribeUrl: `${APP_URL}/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
            to: recipient.email,
            subject: broadcast.subject,
            html: emailHtml,
          })
          sent++

          // Reset bounce count on successful delivery
          await prisma.user.updateMany({
            where: { id: recipient.id, emailBounceCount: { gt: 0 } },
            data: { emailBounceCount: 0, bounceReason: null },
          })
        } catch (err) {
          failed++
          const lastErrorMsg = err instanceof Error ? err.message : String(err)
          console.error(`[cron/broadcast] Error delivering to ${recipient.email}:`, lastErrorMsg)

          // Bounce Shield: Auto-unsubscribe after 3 bounces or on permanent relay rejection
          try {
            const user = await prisma.user.findUnique({
              where: { id: recipient.id },
              select: { id: true, emailBounceCount: true },
            })
            if (user) {
              const nextBounceCount = (user.emailBounceCount ?? 0) + 1
              const isHardFailure = /relay access denied|mailbox unavailable|550|554|user unknown|recipient rejected/i.test(lastErrorMsg)
              const shouldUnsubscribe = nextBounceCount >= 3 || isHardFailure

              await prisma.user.update({
                where: { id: user.id },
                data: {
                  emailBounceCount: nextBounceCount,
                  lastBouncedAt: new Date(),
                  bounceReason: lastErrorMsg.slice(0, 255),
                  ...(shouldUnsubscribe ? { marketingConsent: false } : {}),
                },
              })

              if (shouldUnsubscribe) {
                console.warn(`[Bounce Shield] Auto-unsubscribed ${recipient.email} after ${nextBounceCount} failure(s): ${lastErrorMsg}`)
              }
            }
          } catch (updateErr) {
            console.error('[Bounce Shield] Failed to record bounce for user in cron:', updateErr)
          }
        }

        // 200ms pacing delay between recipients
        await new Promise((r) => setTimeout(r, 200))
      }

      await prisma.scheduledBroadcast.update({
        where: { id: broadcast.id },
        data: {
          status: failed === validRecipients.length && validRecipients.length > 0 ? "FAILED" : "SENT",
          sentAt: new Date(),
          sentCount: sent,
          failedCount: failed,
        },
      })

      results.push({ id: broadcast.id, subject: broadcast.subject, sent, failed })
    }

    return NextResponse.json({
      success: true,
      processed: dueBroadcasts.length,
      results,
    })
  } catch (error) {
    console.error("[cron/process-scheduled-broadcasts] Error:", error)
    return NextResponse.json({ error: "Failed to process broadcasts" }, { status: 500 })
  }
}
