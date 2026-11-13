import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"
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
        layoutType: broadcast!.layoutType as BroadcastLayoutType,
        subject: broadcast!.subject,
        preheader: broadcast!.preheader,
        bannerUrl: broadcast!.bannerUrl,
        content: broadcast!.content,
        ctaText: broadcast!.ctaText,
        ctaUrl: broadcast!.ctaUrl,
        eventDateLabel: broadcast!.eventDateLabel,
        eventLocation: broadcast!.eventLocation,
        eventBadge: broadcast!.eventBadge,
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
            subject: broadcast!.subject,
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
        console.error(`[broadcast/send-now] Error sending to ${recipient.email}:`, lastErrorMsg)

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
            console.error("[Bounce Shield] Failed to record bounce for user:", updateErr)
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
