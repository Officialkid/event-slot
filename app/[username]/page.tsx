import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { unstable_cache } from "next/cache"
import prisma from "@/lib/prisma"
import RegistrationForm from "../(attendee)/[username]/RegistrationForm"
import ConfirmAttendance from "@/components/attendance/ConfirmAttendance"
import EventInvitationCard from "@/components/events/EventInvitationCard"

type EventQuestion = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
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
      location: true,
      communityLink: true,
      imageUrl: true,
      status: true,
      organizer: { select: { name: true, plan: true, suspended: true } },
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

  const user = await getUserMetaByUsername(username)
  if (!user) {
    const event = await getEventMetaBySlug(username)
    if (!event) return {}
    const spotsLeft = event.capacity !== null ? Math.max(0, event.capacity - event.confirmedCount) : null
    const base = process.env.NEXTAUTH_URL ?? ""
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
  const userCanonical = `${process.env.NEXTAUTH_URL ?? ""}/${username}`
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

  const user = await getPublicUserProfile(username)

  if (!user) {
    const event = await getEventBySlug(username)
    if (!event) notFound()

    if (event.deadline && new Date(event.deadline) < new Date()) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
          <div className="mx-auto max-w-[480px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-10 text-center">
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
          <div className="mx-auto max-w-[480px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-10 text-center">
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
    const maxAttendees = (event.organizer?.plan === 'pro' || event.organizer?.plan === 'business') ? 20 : 3
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
        <div className="mx-auto max-w-[1040px]">
          {/* Invitation card */}
          <EventInvitationCard
            title={event.title}
            description={event.description}
            eventDate={event.eventDate}
            location={event.location}
            imageUrl={event.imageUrl}
            organizerName={event.organizer?.name ?? null}
            capacity={event.capacity}
            confirmedCount={event.confirmedCount}
            status={event.status}
            deadline={event.deadline}
          />

          {/* Form + lookup grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-8 items-start">
            {/* Registration form */}
            <RegistrationForm
              event={{ ...event, slug: username, questions: event.questions as EventQuestion[], organizerName: event.organizer?.name ?? null }}
              showBranding={showBranding}
              maxAttendees={maxAttendees}
            />

            {/* Already Registered? lookup panel */}
            <ConfirmAttendance eventId={event.id} />
          </div>
        </div>
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

        {/* Follow button — coming soon */}
        <button
          disabled
          title="Coming soon"
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
                        height: 140,
                        overflow: "hidden",
                        background: "#0A0A0A",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
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
