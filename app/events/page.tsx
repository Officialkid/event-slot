import type { Metadata } from "next"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { APP_URL } from "@/lib/config"

export const metadata: Metadata = {
  title: "Events — EventSlot",
  description: "Browse public events on EventSlot and register with the existing EventSlot flow.",
  alternates: { canonical: `${APP_URL}/events` },
}

function formatEventDate(value: Date | null) {
  if (!value) return "Date to be announced"
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function EventsPage() {
  const now = new Date()
  const events = await prisma.event.findMany({
    where: {
      visibility: "PUBLIC",
      archived: false,
      status: "active",
      accessType: "REGISTRATION",
      OR: [
        { deadline: null },
        { deadline: { gt: now } },
      ],
      organizer: {
        is: {
          suspended: false,
        },
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      eventDate: true,
      location: true,
      imageUrl: true,
      isPaid: true,
    },
    orderBy: [
      { eventDate: "asc" },
      { createdAt: "desc" },
    ],
    take: 100,
  })

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8" style={{ background: "var(--page-bg)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-[0.78rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "#C8F55A" }}>
            Discover
          </p>
          <h1 className="text-[2.2rem] sm:text-[3rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
            Public events on EventSlot
          </h1>
          <p className="mt-3 text-[0.95rem]" style={{ color: "var(--text-secondary)" }}>
            Browse publicly listed events and jump straight into the existing registration experience.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <section
              className="rounded-[24px] border p-8 sm:p-10"
              style={{
                borderColor: "rgba(200,245,90,0.18)",
                background:
                  "radial-gradient(circle at top left, rgba(200,245,90,0.14), transparent 36%), var(--surface)",
              }}
            >
              <p className="mb-3 inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em]" style={{ background: "rgba(200,245,90,0.12)", color: "#C8F55A" }}>
                Discovery page
              </p>
              <h2 className="text-[1.7rem] sm:text-[2.2rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                There are no public events available right now
              </h2>
              <p className="mt-3 max-w-2xl text-[0.95rem] leading-7" style={{ color: "var(--text-secondary)" }}>
                This page is where EventSlot showcases events that organisers have chosen to make public. When a public event is published, visitors will see the poster, event name, date, location, and whether it is free or paid, then continue into the normal EventSlot registration page.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <h3 className="text-[0.82rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "#C8F55A" }}>For attendees</h3>
                  <p className="mt-2 text-[0.82rem] leading-6" style={{ color: "var(--text-secondary)" }}>
                    Discover open events in one place instead of relying only on shared links.
                  </p>
                </div>
                <div className="rounded-[18px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <h3 className="text-[0.82rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "#C8F55A" }}>For organisers</h3>
                  <p className="mt-2 text-[0.82rem] leading-6" style={{ color: "var(--text-secondary)" }}>
                    Mark an event as public and add a poster to make it discoverable here.
                  </p>
                </div>
                <div className="rounded-[18px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <h3 className="text-[0.82rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "#C8F55A" }}>Same registration flow</h3>
                  <p className="mt-2 text-[0.82rem] leading-6" style={{ color: "var(--text-secondary)" }}>
                    The Events page helps people discover events, but registration still happens on the existing event page.
                  </p>
                </div>
              </div>
            </section>

            <aside className="rounded-[24px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h3 className="text-[1.15rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                How public visibility works
              </h3>
              <div className="mt-5 space-y-4">
                <div className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "#C8F55A" }}>Public</p>
                  <p className="mt-2 text-[0.84rem] leading-6" style={{ color: "var(--text-secondary)" }}>
                    The event appears on this page and anyone can open the existing registration page.
                  </p>
                </div>
                <div className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "#C8F55A" }}>Private</p>
                  <p className="mt-2 text-[0.84rem] leading-6" style={{ color: "var(--text-secondary)" }}>
                    The event stays off public discovery and is only accessible through the shared registration link.
                  </p>
                </div>
                <p className="text-[0.78rem] leading-6" style={{ color: "var(--text-muted)" }}>
                  Public listings only show active public events. Private, archived, cancelled, and expired events are excluded automatically.
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-[18px] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div>
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "#C8F55A" }}>
                  Live listings
                </p>
                <h2 className="mt-2 text-[1.35rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                  Discover upcoming public events
                </h2>
                <p className="mt-2 text-[0.88rem]" style={{ color: "var(--text-secondary)" }}>
                  Every card below opens the event’s normal EventSlot registration page.
                </p>
              </div>
              <div className="inline-flex rounded-full px-4 py-2 text-[0.8rem] font-semibold" style={{ background: "rgba(200,245,90,0.12)", color: "#C8F55A" }}>
                {events.length} public {events.length === 1 ? "event" : "events"}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="overflow-hidden rounded-[18px] border"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <Link href={`/${event.slug}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        aspectRatio: "4 / 5",
                        background: event.imageUrl
                          ? "var(--surface-muted)"
                          : "linear-gradient(135deg, rgba(200,245,90,0.18), rgba(17,24,39,0.2))",
                        overflow: "hidden",
                      }}
                    >
                      {event.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : null}
                    </div>
                  </Link>

                  <div className="p-5">
                    <div className="mb-3 inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em]" style={{ background: "rgba(200,245,90,0.12)", color: "#C8F55A" }}>
                      {event.isPaid ? "Paid" : "Free"}
                    </div>
                    <h2 className="text-[1.2rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                      {event.title}
                    </h2>
                    <p className="mt-2 text-[0.82rem]" style={{ color: "var(--text-secondary)" }}>
                      {formatEventDate(event.eventDate)}
                    </p>
                    <p className="mt-1 min-h-[1.2rem] text-[0.82rem]" style={{ color: "var(--text-secondary)" }}>
                      {event.location || "Location to be announced"}
                    </p>
                    <Link
                      href={`/${event.slug}`}
                      className="mt-5 inline-flex rounded-full px-4 py-2 text-[0.82rem] font-semibold"
                      style={{ background: "#C8F55A", color: "#0A0A0A", textDecoration: "none" }}
                    >
                      Register
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
