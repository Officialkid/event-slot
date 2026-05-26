import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import ConfirmationTicket from "@/components/tickets/ConfirmationTicket"
import type { TicketData } from "@/components/tickets/ConfirmationTicket"
import { APP_URL } from "@/lib/config"
import AddToCalendarButton from "@/components/AddToCalendarButton"
import { isCalendarConnected } from "@/lib/googleCalendar"

type EventQuestion = { id: string; type: string; label: string; required?: boolean }
type Answer = { questionId: string; value: string }

function extractField(answers: Answer[], questions: EventQuestion[], types: string[], labelHints: string[]): string | null {
  for (const type of types) {
    const q = questions.find((q) => q.type === type)
    if (q) {
      const val = answers.find((a) => a.questionId === q.id)?.value?.trim()
      if (val) return val
    }
  }
  for (const hint of labelHints) {
    const q = questions.find((q) => q.label.toLowerCase().includes(hint))
    if (q) {
      const val = answers.find((a) => a.questionId === q.id)?.value?.trim()
      if (val) return val
    }
  }
  return null
}

const BASE_URL = APP_URL

export default async function TicketSuccessPage({
  params,
}: {
  params: Promise<{ confirmationCode: string }>
}) {
  const { confirmationCode } = await params

  const registration = await prisma.registration.findUnique({
    where: { confirmationCode },
    include: {
      event: {
        select: {
          title: true,
          eventDate: true,
          location: true,
          questions: true,
          ticketsEnabled: true,
          slug: true,
          eventType: true,
          organizer: { select: { username: true } },
        },
      },
      ticket: true,
    },
  })

  if (!registration || registration.status !== "confirmed") {
    notFound()
  }

  const { event } = registration
  const questions = (event.questions as EventQuestion[]) ?? []
  const answers = (registration.answers as Answer[]) ?? []

  const attendeeName = extractField(answers, questions, ["text"], ["name"]) ?? ""
  const attendeeEmail = extractField(answers, questions, ["email"], ["email"]) ?? registration.attendeeEmail
  const attendeePhone = extractField(answers, questions, ["tel"], ["phone", "mobile"])

  const eventDate = event.eventDate
    ? new Date(event.eventDate).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null

  const ticket: TicketData = {
    confirmationCode,
    eventTitle: event.title,
    eventDate,
    eventLocation: event.location,
    attendeeName,
    attendeeEmail: attendeeEmail || null,
    attendeePhone: attendeePhone || null,
    verifyUrl: `${BASE_URL}/verify/${confirmationCode}`,
  }

  // Calendar add button data
  const session = await getServerSession(authOptions)
  const attendeeCalendarConnected = session?.user?.id
    ? await isCalendarConnected(session.user.id).catch(() => false)
    : false

  const eventSlug = event.slug
  const organizerUsername = event.organizer?.username
  const eventUrl = organizerUsername
    ? `${BASE_URL}/${organizerUsername}/${eventSlug}`
    : `${BASE_URL}/join/${eventSlug}`

  let staticGoogleUrl = ""
  if (event.eventDate) {
    const pad = (n: number) => String(n).padStart(2, "0")
    const fmtDate = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
      `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
    const start = new Date(event.eventDate)
    const end   = new Date(start.getTime() + 120 * 60_000)
    const details = `You're registered for ${event.title}!\n\nConfirmation: ${confirmationCode}\n\n${eventUrl}`
    staticGoogleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(event.title)}` +
      `&dates=${fmtDate(start)}/${fmtDate(end)}` +
      `&details=${encodeURIComponent(details)}` +
      (event.location ? `&location=${encodeURIComponent(event.location)}` : "")
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.25rem",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(200,245,90,0.12)",
            border: "1px solid rgba(200,245,90,0.3)",
            marginBottom: "1rem",
          }}
        >
          {/* Checkmark */}
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
            <path d="M2 8L8.5 14L20 2" stroke="#C8F55A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-instrument-serif, Georgia, serif)",
            fontSize: "1.9rem",
            fontWeight: 400,
            color: "#F0EDE6",
            margin: "0 0 0.5rem",
          }}
        >
          You&apos;re confirmed!
        </h1>
        <p
          style={{
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: "0.9rem",
            color: "rgba(240,237,230,0.5)",
            margin: 0,
          }}
        >
          Here is your ticket for <strong style={{ color: "rgba(240,237,230,0.85)" }}>{event.title}</strong>
        </p>
      </div>

      {/* Ticket */}
      {event.ticketsEnabled ? (
        <div style={{ width: "100%", maxWidth: 660 }}>
          <ConfirmationTicket ticket={ticket} />
          {registration.ticket?.scannedAt && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem 0.85rem",
                background: "rgba(239,68,68,0.12)",
                border: "0.5px solid rgba(239,68,68,0.35)",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#f87171",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                Ticket already scanned —{" "}
                {new Date(registration.ticket.scannedAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            maxWidth: 660,
            border: "0.5px solid rgba(240,237,230,0.1)",
            borderRadius: 12,
            padding: "1rem 1.1rem",
            background: "#141414",
          }}
        >
          <p style={{ margin: 0, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontSize: "0.9rem", fontWeight: 600 }}>
            Registration confirmed
          </p>
          <p style={{ margin: "0.45rem 0 0", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem" }}>
            Confirmation #{confirmationCode}
          </p>
          <p style={{ margin: "0.6rem 0 0", color: "rgba(240,237,230,0.38)", fontFamily: "var(--font-dm-sans)", fontSize: "0.76rem" }}>
            Tickets are currently disabled for this event. Keep your confirmation code for check-in.
          </p>
        </div>
      )}

      {/* ── Add to Calendar ── */}
      {event.eventDate && staticGoogleUrl && (
        <div style={{ width: "100%", maxWidth: 660, marginTop: "1.5rem" }}>
          <AddToCalendarButton
            eventSlug={eventSlug}
            eventTitle={event.title}
            isConnected={attendeeCalendarConnected}
            staticGoogleUrl={staticGoogleUrl}
            staticIcsUrl={`/api/events/${eventSlug}/calendar.ics`}
          />
        </div>
      )}
    </main>
  )
}
