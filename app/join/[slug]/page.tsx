import React from "react"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import prisma from "@/lib/prisma"
import { VirtualEventAccessPortal } from "@/components/events/VirtualEventAccessPortal"
import { buildGoogleCalendarTemplateUrl, buildEventPublicUrl } from "@/lib/calendarLinks"
import { APP_URL } from "@/lib/config"

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ticket?: string }>
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { title: true, eventType: true },
  })

  if (!event || event.eventType !== "VIRTUAL") {
    return { title: "Join Event | EventSlot" }
  }

  return {
    title: `Join ${event.title} | EventSlot Virtual Access`,
    description: `Secure access portal for ${event.title}.`,
  }
}

export default async function VirtualJoinPage(props: PageProps) {
  const { slug } = await props.params
  const searchParams = await props.searchParams
  const ticketCode = searchParams.ticket?.trim() || null

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      archived: true,
      eventType: true,
      eventDate: true,
      eventEndAt: true,
      joinOpensAt: true,
      location: true,
      organizer: { select: { username: true, name: true } },
    },
  })

  if (!event) notFound()

  // If physical event, redirect to normal public event page
  if (event.eventType !== "VIRTUAL") {
    const publicUrl = buildEventPublicUrl(event.slug, event.organizer?.username)
    redirect(publicUrl)
  }

  const isCancelled = event.status === "cancelled" || event.archived
  const now = new Date()
  const eventEnd = event.eventEndAt
    ? new Date(event.eventEndAt)
    : event.eventDate
    ? new Date(new Date(event.eventDate).getTime() + 4 * 60 * 60 * 1000)
    : null
  const isEnded = eventEnd ? now > eventEnd : false

  const googleCalUrl = event.eventDate
    ? buildGoogleCalendarTemplateUrl({
        title: event.title,
        description: `Join virtual event via EventSlot:\n${APP_URL}/join/${event.slug}${ticketCode ? `?ticket=${ticketCode}` : ""}`,
        location: "Online - Virtual Event",
        startDate: new Date(event.eventDate),
        endDate: eventEnd,
      })
    : null

  const icsUrl = `${APP_URL}/api/events/${event.slug}/calendar.ics`

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-page, #09090b)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem 3rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 500, margin: "0 auto" }} className="space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-1.5">
          <a
            href="https://www.eventsslot.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xl font-extrabold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Event<span style={{ color: "#15803d" }}>Slot</span>
          </a>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-instrument-serif, Georgia, serif)" }}
          >
            {event.title}
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Organized by {event.organizer?.name || "EventSlot Organizer"}
          </p>
        </div>

        {/* Portal card */}
        <VirtualEventAccessPortal
          eventId={event.id}
          eventSlug={event.slug}
          eventTitle={event.title}
          eventType={event.eventType}
          startDate={event.eventDate}
          endDate={event.eventEndAt}
          opensAt={event.joinOpensAt}
          initialTicketCode={ticketCode}
          isEventCancelled={isCancelled}
          isEventEnded={isEnded}
          calendarUrl={googleCalUrl}
          icsUrl={icsUrl}
        />
      </div>
    </main>
  )
}
