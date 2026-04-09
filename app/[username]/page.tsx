import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

const RESERVED = [
  "dashboard", "create", "signin", "signup", "pricing", "admin",
  "setup-username", "api", "verify-email", "billing", "settings",
  "my-events", "terms", "privacy", "feedback", "registration",
  "team", "clear-sw", "fonts",
]

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const { username } = params
  if (RESERVED.includes(username.toLowerCase())) return {}

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { name: true, username: true },
  })
  if (!user) return {}

  const displayName = user.name ?? user.username ?? "Organizer"
  return {
    title: `${displayName} — EventSlot`,
    description: `See upcoming events from ${displayName} on EventSlot.`,
  }
}

export default async function PublicProfilePage({
  params,
}: {
  params: { username: string }
}) {
  const { username } = params

  if (RESERVED.includes(username.toLowerCase())) notFound()

  const user = await prisma.user.findUnique({
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
  })

  if (!user) notFound()

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
