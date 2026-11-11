import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { computeNextOccurrenceDate, getRegistrationWindowStatus } from "@/lib/recurringEvents"
import { sendEmail } from "@/lib/email"
import { APP_URL } from "@/lib/config"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await props.params
    const slug = params.slug.toLowerCase().trim()
    const body = await req.json().catch(() => ({}))
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!rawEmail || !rawEmail.includes("@") || !rawEmail.includes(".")) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      )
    }

    const event = await prisma.event.findFirst({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        isRecurring: true,
        recurrenceFrequency: true,
        recurrenceDayOfWeek: true,
        registrationOpensDays: true,
        registrationOpensTime: true,
        eventDate: true,
        deadline: true,
        organizerName: true,
      },
    })

    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    const nextOccurrence = computeNextOccurrenceDate({
      eventDate: event.eventDate,
      isRecurring: event.isRecurring,
      recurrenceFrequency: event.recurrenceFrequency,
      recurrenceDayOfWeek: event.recurrenceDayOfWeek,
    })

    const windowStatus = getRegistrationWindowStatus({
      isRecurring: event.isRecurring,
      recurrenceFrequency: event.recurrenceFrequency,
      recurrenceDayOfWeek: event.recurrenceDayOfWeek,
      registrationOpensDays: event.registrationOpensDays,
      registrationOpensTime: event.registrationOpensTime,
      deadline: event.deadline,
      eventDate: event.eventDate,
    })

    // Upsert or record registration with status 'notify_on_open'
    const existing = await prisma.registration.findFirst({
      where: {
        eventId: event.id,
        attendeeEmail: rawEmail,
        status: "notify_on_open",
        occurrenceDate: nextOccurrence,
      },
    })

    if (!existing) {
      await prisma.registration.create({
        data: {
          eventId: event.id,
          status: "notify_on_open",
          attendeeEmail: rawEmail,
          occurrenceDate: nextOccurrence,
          answers: {
            notifyOnOpen: true,
            windowOpensAt: windowStatus.opensAt?.toISOString() || null,
            targetOccurrence: nextOccurrence.toISOString(),
          },
          consentTransactional: true,
          source: "notify_me_banner",
        },
      })
    }

    // Send confirmation email
    const openNotice = windowStatus.opensAt
      ? `${windowStatus.opensAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} at ${windowStatus.opensAt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`
      : "soon"

    try {
      await sendEmail({
        to: rawEmail,
        subject: `Priority Alert Confirmed: ${event.title}`,
        category: "transactional",
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
            <div style="display: inline-block; background: #15803D; color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 16px;">
              Registration Alert Confirmed
            </div>
            <h2 style="font-size: 20px; font-weight: 800; margin: 0 0 12px; color: #0F172A;">You're on the priority list for ${event.title}!</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
              Registration for the upcoming edition opens on <strong>${openNotice}</strong>. We will send you an instant email alert the exact minute slots open so you can grab your ticket before capacity runs out.
            </p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 700;">Event Link</p>
              <a href="${APP_URL}/${event.slug}" style="color: #15803D; font-weight: 700; text-decoration: none; word-break: break-all;">
                ${APP_URL}/${event.slug}
              </a>
            </div>
            <p style="font-size: 12px; color: #94A3B8; margin: 0;">
              Organized by ${event.organizerName || "Event Organizer"} on EventSlot.
            </p>
          </div>
        `,
      })
    } catch (err) {
      console.warn("[NotifyOpen] Confirmation email dispatch failed, subscription recorded:", err)
    }

    return NextResponse.json({
      success: true,
      message: `You're on the priority list! We'll email you the moment registration opens on ${openNotice}.`,
    })
  } catch (error) {
    console.error("[NotifyOpen Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
