"use client"

import { useEffect, useMemo, useState } from "react"
import EventInvitationCard from "@/components/events/EventInvitationCard"
import { EventFAQDisplay } from "@/components/events/EventFAQDisplay"
import PublicEventTopBar from "@/components/events/PublicEventTopBar"
import WalkInCheckinForm from "@/components/events/WalkInCheckinForm"
import { WhatsAppFloatingButton } from "@/components/events/WhatsAppFloatingButton"
import { parseEventContact } from "@/lib/eventContact"

type WalkInEventPageProps = {
  event: {
    slug: string
    title: string
    description: string | null
    accessType: "REGISTRATION" | "WALK_IN"
    eventDate: Date | string | null
    eventEndAt?: Date | string | null
    location: string | null
    communityLink?: string | null
    imageUrl?: string | null
    status: string
    faqEnabled?: boolean
    whatsappNumber?: string | null
    faqs?: { id: string; question: string; answer: string }[]
    organizer?: {
      name: string | null
      plan?: string | null
      pioneerBadge?: { id: string } | null
    } | null
  }
}

type WalkInStatusResponse = {
  eventTitle: string
  status: "ACTIVE" | "NOT_STARTED" | "ENDED"
  dayNumber: number | null
  totalDays: number
  dayLabel: string
  countToday: number
}

function formatEventDateLabel(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default function PublicWalkInEventPage({ event }: WalkInEventPageProps) {
  const [statusData, setStatusData] = useState<WalkInStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/walkin/${event.slug}/status`, { cache: "no-store" })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Unable to load event status.")
        }
        if (!cancelled) setStatusData(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load event status.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadStatus()
    return () => {
      cancelled = true
    }
  }, [event.slug])

  const parsedContact = parseEventContact(event.whatsappNumber ?? null)
  const eventDateLabel = formatEventDateLabel(event.eventDate)
  const dayTitle = useMemo(() => {
    if (!statusData?.dayNumber || statusData.totalDays <= 1) return null
    return `Day ${statusData.dayNumber} of ${statusData.totalDays}`
  }, [statusData])
  const showBranding = !event.organizer?.plan || event.organizer.plan === "free"

  return (
    <main className="min-h-screen px-4 py-8 pb-24 sm:px-6 sm:py-10 sm:pb-12" style={{ background: "var(--page-bg)" }}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
        <PublicEventTopBar />
        <EventInvitationCard
          title={event.title}
          description={event.description}
          eventDate={event.eventDate ? new Date(event.eventDate) : null}
          location={event.location}
          imageUrl={event.imageUrl}
          organizerName={event.organizer?.name ?? null}
          organizerIsPioneer={Boolean(event.organizer?.pioneerBadge)}
          confirmedCount={0}
          status={event.status}
          accessType="WALK_IN"
          walkInOpenToday={statusData?.status === "ACTIVE"}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <section className="space-y-4">
            {event.faqEnabled && event.faqs && event.faqs.length > 0 ? (
              <div className="rounded-[18px] border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <EventFAQDisplay faqs={event.faqs} />
              </div>
            ) : null}

            <div className="rounded-[18px] border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#C8F55A]">
                Walk-in access
              </p>

              {loading ? (
                <div className="mt-4 space-y-3">
                  <div className="h-4 w-40 animate-pulse rounded" style={{ background: "var(--border)" }} />
                  <div className="h-12 animate-pulse rounded-[14px]" style={{ background: "var(--surface-muted)" }} />
                  <div className="h-12 animate-pulse rounded-[14px]" style={{ background: "var(--surface-muted)" }} />
                </div>
              ) : error ? (
                <p className="mt-4 text-[0.92rem] text-[#FF6B6B]">{error}</p>
              ) : statusData?.status === "ACTIVE" ? (
                <WalkInCheckinForm
                  event={{
                    slug: event.slug,
                    title: event.title,
                    location: event.location,
                    eventDate: eventDateLabel ?? null,
                    eventEndAt: event.eventEndAt ? String(event.eventEndAt) : null,
                    communityLink: event.communityLink ?? null,
                    organizerName: event.organizer?.name ?? null,
                  }}
                  dayLabel={statusData.dayLabel}
                  dayTitle={dayTitle}
                  showBranding={showBranding}
                  onCheckinComplete={(result) => {
                    setStatusData((current) => current
                      ? {
                          ...current,
                          countToday: result.todayCount,
                          dayNumber: result.day.index,
                          totalDays: result.day.total,
                          dayLabel: result.day.label,
                        }
                      : current)
                  }}
                />
              ) : statusData?.status === "NOT_STARTED" ? (
                <div className="mt-4 rounded-[18px] border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
                  <h2 className="text-[1.5rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                    {event.title}
                  </h2>
                  <p className="mt-4 text-[1rem]" style={{ color: "var(--text-secondary)" }}>This event hasn&apos;t started yet.</p>
                  <p className="mt-2 text-[0.92rem]" style={{ color: "var(--text-muted)" }}>
                    Check-in opens on {statusData.dayLabel}.
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-[18px] border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
                  <h2 className="text-[1.5rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                    {event.title}
                  </h2>
                  <p className="mt-4 text-[1rem]" style={{ color: "var(--text-secondary)" }}>This event has ended.</p>
                  <p className="mt-2 text-[0.92rem]" style={{ color: "var(--text-muted)" }}>
                    Thanks to everyone who attended.
                  </p>
                  <a
                    href="https://www.eventsslot.com"
                    className="mt-5 inline-flex rounded-full border border-[rgba(200,245,90,0.26)] px-5 py-2.5 text-[0.88rem] font-medium text-[#C8F55A]"
                  >
                    Visit eventsslot.com
                  </a>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="rounded-[18px] border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                Today
              </p>
              <h3 className="mt-3 text-[1.4rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                {statusData?.dayLabel ?? "Loading..."}
              </h3>
              <p className="mt-2 text-[0.92rem]" style={{ color: "var(--text-muted)" }}>
                {statusData?.status === "ACTIVE"
                  ? statusData.totalDays > 1 && statusData.dayNumber
                    ? `Currently on day ${statusData.dayNumber} of ${statusData.totalDays}.`
                    : "Check-in is open for today."
                  : statusData?.status === "NOT_STARTED"
                    ? "Share the link ahead of time and attendees can check in on the event day."
                    : "Check-in is now closed for this event."}
              </p>
            </div>
          </aside>
        </div>
      </div>

      {parsedContact ? (
        <WhatsAppFloatingButton
          contactNumber={parsedContact.number}
          contactMode={parsedContact.mode}
          eventTitle={event.title}
          eventDate={eventDateLabel}
        />
      ) : null}
    </main>
  )
}
