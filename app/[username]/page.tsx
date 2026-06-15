import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { unstable_cache } from "next/cache"
import prisma from "@/lib/prisma"
import RegistrationForm from "../(attendee)/[username]/RegistrationForm"
import ConfirmAttendance from "@/components/attendance/ConfirmAttendance"
import EventInvitationCard from "@/components/events/EventInvitationCard"
import { JoinEventButton } from "@/components/JoinEventButton"
import { EventFAQDisplay } from "@/components/events/EventFAQDisplay"
import { WhatsAppFloatingButton } from "@/components/events/WhatsAppFloatingButton"
import { APP_URL } from "@/lib/config"
import { parseEventContact } from "@/lib/eventContact"

type EventQuestion = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
}

type PublicTicketTier = {
  id: string
  name: string
  priceKes: number
  capacity: number
  description?: string | null
  soldCount: number
  waitlistCount: number
  bundleSize: number
}

function toIsoOrNull(value: unknown): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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

const RESERVED = [
  "dashboard", "create", "signin", "signup", "pricing", "admin",
  "setup-username", "api", "verify-email", "billing", "settings",
  "my-events", "terms", "privacy", "feedback", "registration",
  "team", "clear-sw", "fonts",
]

const getUserMetaByUsername = unstable_cache(
  async (username: string) => prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { name: true, username: true },
  }),
  ["public-user-meta"],
  { revalidate: 60 }
)

const getEventMetaBySlug = unstable_cache(
  async (slug: string) => prisma.event.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      capacity: true,
      confirmedCount: true,
      organizerEmail: true,
      location: true,
      eventDate: true,
    },
  }),
  ["public-event-meta"],
  { revalidate: 60 }
)

const getPublicUserProfile = unstable_cache(
  async (username: string) => prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      name: true,
      username: true,
      createdAt: true,
      events: {
        where: {
          archived: false,
          status: "active",
        },
        select: {
          id: true,
          title: true,
          slug: true,
          eventDate: true,
          location: true,
          capacity: true,
          confirmedCount: true,
          deadline: true,
          imageUrl: true,
          description: true,
        },
        orderBy: { eventDate: "asc" },
      },
    },
  }),
  ["public-user-profile"],
  { revalidate: 60 }
)

const getEventBySlug = unstable_cache(
  async (slug: string) => prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      description: true,
      capacity: true,
      confirmedCount: true,
      questions: true,
      deadline: true,
      organizerEmail: true,
      createdAt: true,
      eventDate: true,
      joinOpensAt: true,
      eventType: true,
      location: true,
      communityLink: true,
      imageUrl: true,
      status: true,
      isPaid: true,
      faqEnabled: true,
      whatsappNumber: true,
      ticketTiers: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          priceKes: true,
          capacity: true,
          description: true,
          soldCount: true,
          waitlistCount: true,
          bundleSize: true,
        },
      },
      faqs: { orderBy: { order: 'asc' }, select: { id: true, question: true, answer: true } },
      organizer: { select: { name: true, plan: true, suspended: true, pioneerBadge: { select: { id: true } } } },
    },
  }),
  ["public-event-detail"],
  { revalidate: 60 }
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  if (RESERVED.includes(username.toLowerCase())) return {}

  let user: Awaited<ReturnType<typeof getUserMetaByUsername>> = null
  try {
    user = await getUserMetaByUsername(username)
  } catch {
    return {}
  }

  if (!user) {
    let event: Awaited<ReturnType<typeof getEventMetaBySlug>> = null
    try {
      event = await getEventMetaBySlug(username)
    } catch {
      return {}
    }
    if (!event) return {}
    const spotsLeft = event.capacity !== null ? Math.max(0, event.capacity - event.confirmedCount) : null
    const base = APP_URL
    const canonical = `${base}/${username}`
    const ogUrl = `${base}/api/og?title=${encodeURIComponent(event.title)}&organizer=${encodeURIComponent(event.organizerEmail)}${spotsLeft !== null ? `&spots=${spotsLeft}` : ""}`
    const spotsText = spotsLeft !== null ? ` ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left.` : ""
    const locationText = event.location ? ` at ${event.location}` : ""
    const richDescription =
      event.description ??
      `Register for ${event.title}${locationText}. Powered by EventSlot — the event registration platform with built-in waitlist management.${spotsText}`
    return {
      title: `${event.title} — EventSlot`,
      description: richDescription,
      alternates: { canonical },
      openGraph: {
        title: event.title,
        description: richDescription,
        url: canonical,
        images: [{ url: ogUrl, width: 1200, height: 630, alt: event.title }],
        type: "website",
      },
      twitter: { card: "summary_large_image", title: event.title, description: richDescription, images: [ogUrl] },
    }
  }

  const displayName = user.name ?? user.username ?? "Organizer"
  const userCanonical = `${APP_URL}/${username}`
  return {
    title: `${displayName} — EventSlot`,
    description: `See upcoming events from ${displayName} on EventSlot — the online event registration platform.`,
    alternates: { canonical: userCanonical },
  }
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  if (RESERVED.includes(username.toLowerCase())) notFound()

  let user: Awaited<ReturnType<typeof getPublicUserProfile>> = null
  try {
    user = await getPublicUserProfile(username)
  } catch {
    notFound()
  }

  if (!user) {
    let event: Awaited<ReturnType<typeof getEventBySlug>> = null
    try {
      event = await getEventBySlug(username)
    } catch {
      notFound()
    }
    if (!event) notFound()

    if (event.deadline && new Date(event.deadline) < new Date()) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
          <div className="mx-auto max-w-[480px] rounded-xl border border-[#2A2A2A] bg-[#141414] p-10 text-center">
            <h1 className="text-[1.4rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              Registration closed
            </h1>
            <p className="mt-3 text-[0.9rem] font-[300] text-[rgba(240,237,230,0.45)]">
              Registration for this event is closed.
            </p>
            <span className="mt-4 inline-flex rounded-full border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] px-3 py-1 text-[0.7rem] text-[#FF6B6B]">
              Closed
            </span>
          </div>
        </div>
      )
    }

    if (event.status === "closed") {
      return (
        <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
          <div className="mx-auto max-w-[480px] rounded-xl border border-[#2A2A2A] bg-[#141414] p-10 text-center">
            <h1 className="text-[1.4rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              {event.title}
            </h1>
            <p className="mt-3 text-[0.9rem] font-[300] text-[rgba(240,237,230,0.45)]">
              Unfortunately the slots are full and registration is not available at this time.
            </p>
            <span className="mt-4 inline-flex rounded-full border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] px-3 py-1 text-[0.7rem] text-[#FF6B6B]">
              Closed
            </span>
          </div>
        </div>
      )
    }

    if (event.organizer?.suspended) {
      return (
        <main style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", fontSize: "0.9rem" }}>
            This event is currently unavailable.
          </p>
        </main>
      )
    }

    try { await prisma.eventView.create({ data: { eventId: event.id } }) } catch { /* silent */ }

    const showBranding = !event.organizer || event.organizer.plan === "free"
    const maxAttendees = 3
    // Typed local refs for new FAQ/WhatsApp fields (Prisma types may be stale in TS server)
    const eventFaqs = (event as unknown as { faqs: { id: string; question: string; answer: string }[] }).faqs ?? []
    const eventWhatsapp = (event as unknown as { whatsappNumber: string | null }).whatsappNumber ?? null
    const parsedContact = parseEventContact(eventWhatsapp)
    const eventDateLabel = formatEventDateLabel(event.eventDate)
    const hasWhatsapp = Boolean(parsedContact?.number)
    return (
      <div className={`min-h-screen bg-[#0A0A0A] px-4 py-8 sm:py-10 ${hasWhatsapp ? "pb-24" : ""}`}>
        <div className="mx-auto max-w-[1120px]">
          {/* Invitation card */}
          <EventInvitationCard
            title={event.title}
            description={event.description}
            eventDate={event.eventDate}
            location={event.location}
            imageUrl={event.imageUrl}
            organizerName={event.organizer?.name ?? null}
            organizerIsPioneer={Boolean(event.organizer?.pioneerBadge)}
            capacity={event.capacity}
            confirmedCount={event.confirmedCount}
            status={event.status}
            deadline={event.deadline}
          />

          {/* Form + lookup grid */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-7 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8 items-start">
            {/* Registration form */}
            <section className="space-y-3">
              {/* FAQ — shown above the form if enabled */}
              {event.faqEnabled && eventFaqs.length > 0 && (
                <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-6">
                  <EventFAQDisplay faqs={eventFaqs} />
                </div>
              )}
              <p className="text-xs text-[#C8F55A] font-semibold uppercase tracking-wider mb-2">✦ Registration</p>
              <RegistrationForm
                event={{
                  ...event,
                  slug: username,
                  questions: event.questions as EventQuestion[],
                  organizerName: event.organizer?.name ?? null,
                  deadline: toIsoOrNull(event.deadline),
                  eventDate: toIsoOrNull(event.eventDate),
                  isPaid: event.isPaid,
                  ticketTiers: event.ticketTiers as PublicTicketTier[],
                }}
                showBranding={showBranding}
                maxAttendees={maxAttendees}
                compactHeader
              />
            </section>

            {/* Already Registered? lookup panel */}
            <section className="space-y-3 lg:sticky lg:top-6">
              <p className="text-xs text-[#C8F55A] font-semibold uppercase tracking-wider mb-2">✦ Attendance Lookup</p>
              <ConfirmAttendance eventSlug={username} />
              {event.eventType === "VIRTUAL" && event.eventDate && (
                <JoinEventButton
                  eventId={event.id}
                  eventType={event.eventType}
                  startDate={event.eventDate}
                  endDate={null}
                  opensAt={event.joinOpensAt}
                />
              )}
            </section>
          </div>
        </div>
        {parsedContact && (
          <WhatsAppFloatingButton
            contactNumber={parsedContact.number}
            contactMode={parsedContact.mode}
            eventTitle={event.title}
            eventDate={eventDateLabel}
          />
        )}
      </div>
    )
  }

  const displayName = user.name ?? user.username ?? "Organizer"
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("")

  const now = new Date()
  const activeEvents = user.events.filter(
    (e) => !e.deadline || new Date(e.deadline) > now
  )

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "3rem 1.25rem 5rem",
      }}
    >
      {/* Profile header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          marginBottom: "2.5rem",
        }}
      >
        {/* Initials circle */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(200,245,90,0.12)",
            border: "0.5px solid rgba(200,245,90,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.4rem",
            fontWeight: 600,
            color: "#C8F55A",
            fontFamily: "var(--font-dm-sans)",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.75rem",
              color: "#F0EDE6",
              margin: "0 0 0.25rem",
              fontWeight: 400,
            }}
          >
            {displayName}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.82rem",
              color: "rgba(240,237,230,0.4)",
              margin: 0,
            }}
          >
            @{user.username}
          </p>
        </div>

        {/* Follow button */}
        <button
          disabled
          title="Follow"
          style={{
            background: "transparent",
            border: "0.5px solid rgba(240,237,230,0.15)",
            borderRadius: 100,
            padding: "0.5rem 1.25rem",
            fontSize: "0.82rem",
            color: "rgba(240,237,230,0.3)",
            cursor: "not-allowed",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Follow
        </button>
      </div>

      {/* Divider */}
      <div
        style={{
          borderTop: "0.5px solid rgba(240,237,230,0.07)",
          marginBottom: "2rem",
        }}
      />

      {/* Events section */}
      <h2
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: "0.78rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(240,237,230,0.35)",
          margin: "0 0 1.25rem",
        }}
      >
        Upcoming Events
        {activeEvents.length > 0 && (
          <span
            style={{
              marginLeft: "0.625rem",
              background: "rgba(200,245,90,0.1)",
              color: "#C8F55A",
              borderRadius: 100,
              padding: "0.1rem 0.5rem",
              fontSize: "0.72rem",
            }}
          >
            {activeEvents.length}
          </span>
        )}
      </h2>

      {activeEvents.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1rem",
            color: "rgba(240,237,230,0.3)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.9rem",
          }}
        >
          No upcoming events right now.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {activeEvents.map((event) => {
            const spotsLeft =
              event.capacity != null
                ? Math.max(0, event.capacity - event.confirmedCount)
                : null
            const pct =
              event.capacity && event.capacity > 0
                ? Math.min(100, (event.confirmedCount / event.capacity) * 100)
                : 0

            return (
              <Link
                key={event.id}
                href={`/${event.slug}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    background: "#141414",
                    border: "0.5px solid rgba(240,237,230,0.08)",
                    borderRadius: 14,
                    overflow: "hidden",
                    transition: "border-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.borderColor =
                      "rgba(240,237,230,0.18)"
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.borderColor =
                      "rgba(240,237,230,0.08)"
                  }}
                >
                  {/* Optional image */}
                  {event.imageUrl && (
                    <div
                      style={{
                        width: "100%",
                        overflow: "hidden",
                        backgroundColor: "#0A0A0A",
                        lineHeight: 0,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        style={{
                          width: "100%",
                          height: "auto",
                          maxHeight: "480px",
                          objectFit: "contain",
                          objectPosition: "center top",
                          display: "block",
                        }}
                      />
                    </div>
                  )}

                  <div style={{ padding: "1.125rem" }}>
                    <h3
                      style={{
                        fontFamily: "var(--font-instrument-serif)",
                        fontSize: "1.1rem",
                        color: "#F0EDE6",
                        margin: "0 0 0.375rem",
                        fontWeight: 400,
                        lineHeight: 1.3,
                      }}
                    >
                      {event.title}
                    </h3>

                    {/* Date & location */}
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "0.78rem",
                        color: "rgba(240,237,230,0.45)",
                        margin: "0 0 0.875rem",
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {event.eventDate && (
                        <span>
                          {new Date(event.eventDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {event.eventDate && event.location && (
                        <span style={{ opacity: 0.4 }}>·</span>
                      )}
                      {event.location && <span>{event.location}</span>}
                    </p>

                    {/* Slot bar */}
                    {event.capacity != null && (
                      <div style={{ marginBottom: "0.875rem" }}>
                        <div
                          style={{
                            height: 3,
                            background: "rgba(240,237,230,0.08)",
                            borderRadius: 100,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background:
                                pct >= 90 ? "#ff6b6b" : pct >= 60 ? "#ffaa00" : "#C8F55A",
                              borderRadius: 100,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <p
                          style={{
                            fontFamily: "var(--font-dm-sans)",
                            fontSize: "0.72rem",
                            color: "rgba(240,237,230,0.35)",
                            margin: "0.3rem 0 0",
                          }}
                        >
                          {spotsLeft === 0
                            ? "Fully booked"
                            : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
                        </p>
                      </div>
                    )}

                    {/* CTA */}
                    <div
                      style={{
                        display: "inline-block",
                        padding: "0.4rem 1rem",
                        background: "rgba(200,245,90,0.1)",
                        color: "#C8F55A",
                        borderRadius: 100,
                        fontSize: "0.78rem",
                        fontFamily: "var(--font-dm-sans)",
                        fontWeight: 500,
                      }}
                    >
                      Register →
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
