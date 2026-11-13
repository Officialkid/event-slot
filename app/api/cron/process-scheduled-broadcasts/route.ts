import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { getConfiguredMarketingFrom } from "@/lib/emailProvider"
import { env } from "@/lib/env"
import { APP_URL } from "@/lib/config"
import { renderBroadcastEmail, type BroadcastLayoutType } from "@/lib/emailTemplates"
import { isDeliverableEmail } from "@/lib/email/disposableDomains"

const EMAIL_FROM = getConfiguredMarketingFrom(env, "EventSlot <hello@eventsslot.com>")

type Recipient = { id: string; name: string | null; email: string }

/** Fetches deduplicated marketing subscribers from both registered users and event attendees. */
async function getSubscribedRecipients(): Promise<Recipient[]> {
  const [users, registrations] = await Promise.all([
    prisma.user.findMany({
      where: { suspended: false, email: { not: null }, marketingConsent: true },
      select: { id: true, name: true, email: true },
    }),
    prisma.registration.findMany({
      where: { consentMarketing: true, attendeeEmail: { not: null } },
      select: { id: true, attendeeEmail: true, answers: true },
      orderBy: { submittedAt: "desc" },
    }),
  ])

  const emailMap = new Map<string, Recipient>()

  for (const user of users) {
    if (!user.email) continue
    const clean = user.email.trim().toLowerCase()
    if (isDeliverableEmail(clean)) {
      emailMap.set(clean, {
        id: user.id,
        name: user.name,
        email: user.email.trim(),
      })
    }
  }

  for (const reg of registrations) {
    if (!reg.attendeeEmail) continue
    const clean = reg.attendeeEmail.trim().toLowerCase()
    if (!emailMap.has(clean) && isDeliverableEmail(clean)) {
      let attendeeName: string | null = null
      if (Array.isArray(reg.answers)) {
        const nameAns = (reg.answers as { questionId?: string; value?: string }[]).find(
          (a) => typeof a.value === "string" && a.value.trim().length > 1
        )
        if (nameAns?.value) attendeeName = nameAns.value.trim()
      }
      emailMap.set(clean, {
        id: `reg_${reg.id}`,
        name: attendeeName,
        email: reg.attendeeEmail.trim(),
      })
    }
  }

  return Array.from(emailMap.values())
}

/** Fetches all active platform users with deliverable email addresses. */
async function getAllPlatformUsers(): Promise<Recipient[]> {
  const users = await prisma.user.findMany({
    where: { suspended: false, email: { not: null } },
    select: { id: true, name: true, email: true },
  })

  return users
    .filter((u): u is { id: string; name: string | null; email: string } => Boolean(u.email && isDeliverableEmail(u.email)))
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email.trim(),
    }))
}

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

      // Resolve audience identically to immediate broadcast dispatch
      let validRecipients: Recipient[] = []
      if (broadcast.mode === "INDIVIDUAL" && Array.isArray(broadcast.specificUserIds)) {
        const recipients = await prisma.user.findMany({
          where: { id: { in: broadcast.specificUserIds as string[] }, suspended: false, email: { not: null } },
          select: { id: true, name: true, email: true },
        })
        validRecipients = recipients
          .filter((r): r is { id: string; name: string | null; email: string } => Boolean(r.email && isDeliverableEmail(r.email)))
          .map((r) => ({ id: r.id, name: r.name, email: r.email.trim() }))
      } else if (broadcast.mode === "ALL") {
        validRecipients = await getAllPlatformUsers()
      } else {
        validRecipients = await getSubscribedRecipients()
      }

      let sent = 0
      let failed = 0

      async function processRecipient(recipient: Recipient) {
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

        let attempts = 0
        let success = false
        let lastErrorMsg = ""

        while (attempts < 2 && !success) {
          attempts++
          try {
            await sendEmail({
              from: EMAIL_FROM,
              category: "marketing",
              unsubscribeUrl: `${APP_URL}/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
              to: recipient.email,
              subject: broadcast.subject,
              html: emailHtml,
            })
            success = true
            sent++

            // Reset bounce count on successful delivery for platform users
            if (!recipient.id.startsWith("reg_")) {
              await prisma.user.updateMany({
                where: { id: recipient.id, emailBounceCount: { gt: 0 } },
                data: { emailBounceCount: 0, bounceReason: null },
              })
            }
          } catch (err) {
            lastErrorMsg = err instanceof Error ? err.message : String(err)
            if (/429|too many|rate/i.test(lastErrorMsg) && attempts < 2) {
              await new Promise((r) => setTimeout(r, 1000 * attempts))
            } else {
              break
            }
          }
        }

        if (!success) {
          failed++
          console.error(`[cron/broadcast] Error delivering to ${recipient.email}:`, lastErrorMsg)

          // Bounce Shield: Auto-unsubscribe after 3 bounces or on permanent relay rejection
          if (!recipient.id.startsWith("reg_")) {
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
              console.error("[Bounce Shield] Failed to record bounce for user in cron:", updateErr)
            }
          }
        }
      }

      // Process recipients in batches of 10 concurrent connections with 200ms pacing between batches
      const BATCH_SIZE = 10
      for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
        const batch = validRecipients.slice(i, i + BATCH_SIZE)
        await Promise.allSettled(batch.map((r) => processRecipient(r)))
        if (i + BATCH_SIZE < validRecipients.length) {
          await new Promise((r) => setTimeout(r, 200))
        }
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

export async function POST(req: NextRequest) {
  return GET(req)
}
