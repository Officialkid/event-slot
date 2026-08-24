import type { Metadata } from "next"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { APP_URL } from "@/lib/config"
import PublicEventShareButton from "@/components/events/PublicEventShareButton"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Events — EventSlot",
  description: "Browse public events on EventSlot and register with the existing EventSlot flow.",
  alternates: { canonical: `${APP_URL}/events` },
}

function formatEventDate(value: Date | null, endValue?: Date | null) {
  if (!value) return "Date to be announced"

  const formatFull = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  if (!endValue || value.toDateString() === endValue.toDateString()) {
    return formatFull(value)
  }

  return `${formatFull(value)} to ${formatFull(endValue)}`
}

type EventsSearchParams = Promise<{
  q?: string
  date?: string
  window?: string
  sort?: string
}>

type DateRange = {
  start: Date
  end: Date
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function parseDateInput(value?: string): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getDateWindowRange(windowKey: string, now: Date): DateRange | null {
  const today = startOfDay(now)

  switch (windowKey) {
    case "today":
      return { start: today, end: endOfDay(today) }
    case "this-week": {
      const day = today.getDay()
      const offset = (day + 6) % 7
      const start = startOfDay(new Date(today.getTime() - offset * 24 * 60 * 60 * 1000))
      const end = endOfDay(new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000))
      return { start, end }
    }
    case "this-month": {
      const start = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1))
      const end = endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0))
      return { start, end }
    }
    case "next-30-days": {
      const start = today
      const end = endOfDay(new Date(today.getTime() + 29 * 24 * 60 * 60 * 1000))
      return { start, end }
    }
    default:
      return null
  }
}

function buildRangeFilter(range: DateRange): Prisma.EventWhereInput {
  return {
    OR: [
      {
        eventDate: {
          gte: range.start,
          lte: range.end,
        },
      },
      {
        eventEndAt: {
          gte: range.start,
          lte: range.end,
        },
      },
      {
        AND: [
          {
            eventDate: {
              lte: range.start,
            },
          },
          {
            eventEndAt: {
              gte: range.end,
            },
          },
        ],
      },
    ],
  }
}

function getSortOrder(sortKey: string): Prisma.EventOrderByWithRelationInput[] {
  switch (sortKey) {
    case "latest":
      return [{ eventDate: "desc" }, { createdAt: "desc" }]
    case "alphabetical":
      return [{ title: "asc" }, { createdAt: "desc" }]
    case "newest":
      return [{ createdAt: "desc" }]
    case "soonest":
    default:
      return [{ eventDate: "asc" }, { createdAt: "desc" }]
  }
}

function buildEventsPageHref(params: {
  q?: string
  date?: string
  window?: string
  sort?: string
}) {
  const query = new URLSearchParams()

  if (params.q) query.set("q", params.q)
  if (params.date) query.set("date", params.date)
  if (params.window && params.window !== "all") query.set("window", params.window)
  if (params.sort && params.sort !== "soonest") query.set("sort", params.sort)

  const queryString = query.toString()
  return queryString ? `/events?${queryString}` : "/events"
}

export default async function EventsPage({ searchParams }: { searchParams: EventsSearchParams }) {
  const now = new Date()
  const resolvedSearchParams = await searchParams
  const query = resolvedSearchParams.q?.trim() ?? ""
  const selectedDate = resolvedSearchParams.date?.trim() ?? ""
  const selectedWindow = resolvedSearchParams.window?.trim() || "all"
  const selectedSort = resolvedSearchParams.sort?.trim() || "soonest"
  const exactDate = parseDateInput(selectedDate)
  const activeRange = exactDate
    ? { start: startOfDay(exactDate), end: endOfDay(exactDate) }
    : getDateWindowRange(selectedWindow, now)
  const activeFiltersCount = [query, selectedDate, selectedWindow !== "all"].filter(Boolean).length
  const andFilters: Prisma.EventWhereInput[] = [
    {
      OR: [
        { deadline: null },
        { deadline: { gt: now } },
      ],
    },
    {
      OR: [
        { organizerId: null },
        {
          organizer: {
            is: {
              suspended: false,
            },
          },
        },
      ],
    },
  ]
  const where: Prisma.EventWhereInput = {
    visibility: "PUBLIC",
    archived: false,
    status: "active",
    accessType: "REGISTRATION",
    AND: andFilters,
  }

  if (query) {
    andFilters.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { location: { contains: query, mode: "insensitive" } },
      ],
    })
  }

  if (activeRange) {
    andFilters.push(buildRangeFilter(activeRange))
  }

  const events = await prisma.event.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      eventDate: true,
      eventEndAt: true,
      location: true,
      imageUrl: true,
      isPaid: true,
    },
    orderBy: getSortOrder(selectedSort),
    take: 100,
  })

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8" style={{ background: "var(--page-bg)" }}>
      <div className="mx-auto max-w-6xl">
        <div className={`max-w-3xl ${events.length === 0 ? "mb-8" : "mb-5"}`}>
          <p
            className={`font-semibold uppercase tracking-[0.18em] ${events.length === 0 ? "mb-2 text-[0.78rem]" : "mb-1 text-[0.72rem]"}`}
            style={{ color: "#C8F55A" }}
          >
            Discover
          </p>
          <h1
            className={events.length === 0 ? "text-[2.2rem] sm:text-[3rem]" : "text-[1.8rem] leading-tight sm:text-[2.35rem]"}
            style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}
          >
            Public events on EventSlot
          </h1>
          <p
            className={events.length === 0 ? "mt-3 text-[0.95rem]" : "mt-2 max-w-2xl text-[0.88rem] leading-7 sm:text-[0.95rem]"}
            style={{ color: "var(--text-secondary)" }}
          >
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
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border px-4 py-4 sm:px-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div>
                <p className="text-[0.76rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "#C8F55A" }}>
                  Live listings
                </p>
                <p className="mt-2 text-[0.84rem] sm:text-[0.88rem]" style={{ color: "var(--text-secondary)" }}>
                  Search, filter, and open the normal EventSlot registration page for any public event.
                </p>
              </div>
              <div className="inline-flex rounded-full px-4 py-2 text-[0.8rem] font-semibold" style={{ background: "rgba(200,245,90,0.12)", color: "#C8F55A" }}>
                {events.length} public {events.length === 1 ? "event" : "events"}
              </div>
            </div>

            <form
              method="get"
              className="grid gap-3 rounded-[20px] border p-4 sm:p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.72fr)_minmax(0,0.72fr)_minmax(0,0.72fr)]"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <label className="block">
                <span className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.1em]" style={{ color: "#C8F55A" }}>
                  Search
                </span>
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Search by event name or location"
                  className="w-full rounded-[14px] border px-4 py-3 text-[0.92rem] outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.1em]" style={{ color: "#C8F55A" }}>
                  Exact date
                </span>
                <input
                  type="date"
                  name="date"
                  defaultValue={selectedDate}
                  className="w-full rounded-[14px] border px-4 py-3 text-[0.92rem] outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.1em]" style={{ color: "#C8F55A" }}>
                  Time window
                </span>
                <select
                  name="window"
                  defaultValue={selectedWindow}
                  className="w-full rounded-[14px] border px-4 py-3 text-[0.92rem] outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                >
                  <option value="all">All upcoming events</option>
                  <option value="today">Today</option>
                  <option value="this-week">This week</option>
                  <option value="this-month">This month</option>
                  <option value="next-30-days">Next 30 days</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.1em]" style={{ color: "#C8F55A" }}>
                  Sort
                </span>
                <select
                  name="sort"
                  defaultValue={selectedSort}
                  className="w-full rounded-[14px] border px-4 py-3 text-[0.92rem] outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                >
                  <option value="soonest">Soonest first</option>
                  <option value="latest">Latest event date</option>
                  <option value="newest">Newest listing</option>
                  <option value="alphabetical">A to Z</option>
                </select>
              </label>

              <div className="flex flex-wrap items-end gap-3 lg:col-span-4">
                <button
                  type="submit"
                  className="inline-flex rounded-full px-5 py-3 text-[0.84rem] font-semibold"
                  style={{ background: "#C8F55A", color: "#0A0A0A", border: "none" }}
                >
                  Apply filters
                </button>
                <Link
                  href="/events"
                  className="inline-flex rounded-full border px-5 py-3 text-[0.84rem] font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}
                >
                  Clear
                </Link>
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-[0.82rem]" style={{ color: "var(--text-secondary)" }}>
                {activeFiltersCount > 0
                  ? `Showing ${events.length} result${events.length === 1 ? "" : "s"} for your current filters.`
                  : `Showing ${events.length} public event${events.length === 1 ? "" : "s"} right now.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {query ? (
                  <Link
                    href={buildEventsPageHref({ date: selectedDate, window: selectedWindow, sort: selectedSort })}
                    className="inline-flex rounded-full border px-3 py-1.5 text-[0.76rem] font-semibold"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}
                  >
                    Search: {query}
                  </Link>
                ) : null}
                {selectedDate ? (
                  <Link
                    href={buildEventsPageHref({ q: query, window: selectedWindow, sort: selectedSort })}
                    className="inline-flex rounded-full border px-3 py-1.5 text-[0.76rem] font-semibold"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}
                  >
                    Date: {selectedDate}
                  </Link>
                ) : null}
                {selectedWindow !== "all" ? (
                  <Link
                    href={buildEventsPageHref({ q: query, date: selectedDate, sort: selectedSort })}
                    className="inline-flex rounded-full border px-3 py-1.5 text-[0.76rem] font-semibold"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}
                  >
                    Window: {selectedWindow.replaceAll("-", " ")}
                  </Link>
                ) : null}
              </div>
            </div>

            {events.length === 0 ? (
              <section className="rounded-[20px] border p-8 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <h3 className="text-[1.4rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                  No public events match those filters
                </h3>
                <p className="mx-auto mt-3 max-w-2xl text-[0.9rem] leading-7" style={{ color: "var(--text-secondary)" }}>
                  Try clearing the exact date, changing the time window, or searching with a shorter event name or location.
                </p>
                <div className="mt-5">
                  <Link
                    href="/events"
                    className="inline-flex rounded-full px-5 py-3 text-[0.84rem] font-semibold"
                    style={{ background: "#C8F55A", color: "#0A0A0A", textDecoration: "none" }}
                  >
                    Reset filters
                  </Link>
                </div>
              </section>
            ) : (
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
                        {formatEventDate(event.eventDate, event.eventEndAt)}
                      </p>
                      <p className="mt-1 min-h-[1.2rem] text-[0.82rem]" style={{ color: "var(--text-secondary)" }}>
                        {event.location || "Location to be announced"}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/${event.slug}`}
                          className="inline-flex rounded-full px-4 py-2 text-[0.82rem] font-semibold"
                          style={{ background: "#C8F55A", color: "#0A0A0A", textDecoration: "none" }}
                        >
                          Register
                        </Link>
                        <PublicEventShareButton title={event.title} url={`${APP_URL}/${event.slug}`} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
