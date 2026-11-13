import type { Metadata } from "next"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import {
  Calendar,
  MapPin,
  Search,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  ArrowRight,
  Compass,
} from "lucide-react"
import prisma from "@/lib/prisma"
import { APP_URL } from "@/lib/config"
import PublicEventShareButton from "@/components/events/PublicEventShareButton"
import { FollowButton } from "@/components/following/FollowButton"
import { computeNextOccurrenceDate, getRegistrationWindowStatus } from "@/lib/recurringEvents"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Events — Discover Public Events on EventSlot",
  description: "Browse upcoming events, conferences, and meetups on EventSlot. Register instantly with zero friction.",
  alternates: { canonical: `${APP_URL}/events` },
}

function formatEventDate(value: Date | null, endValue?: Date | null) {
  if (!value) return "Date to be announced"

  const formatFull = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  if (!endValue || value.toDateString() === endValue.toDateString()) {
    return formatFull(value)
  }

  return `${formatFull(value)} — ${formatFull(endValue)}`
}

function getEventDateBadgeParts(value: Date | null) {
  if (!value) {
    return { month: "TBA", day: "--", weekday: "" }
  }
  const date = new Date(value)
  return {
    month: date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString("en-GB", { day: "numeric" }),
    weekday: date.toLocaleDateString("en-GB", { weekday: "short" }),
  }
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
        { isRecurring: true },
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
    andFilters.push({
      OR: [
        { isRecurring: true },
        buildRangeFilter(activeRange),
      ],
    })
  } else {
    // Default discovery: strictly show upcoming events or recurring rolling events
    andFilters.push({
      OR: [
        { isRecurring: true },
        { eventEndAt: { gte: now } },
        {
          AND: [
            { eventEndAt: null },
            {
              OR: [
                { eventDate: { gte: startOfDay(now) } },
                { eventDate: null },
              ],
            },
          ],
        },
      ],
    })
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
      isRecurring: true,
      recurrenceFrequency: true,
      recurrenceDayOfWeek: true,
      registrationOpensDays: true,
      registrationOpensTime: true,
      deadline: true,
      organizerName: true,
      organizerId: true,
      organizer: {
        select: {
          username: true,
          name: true,
          image: true,
          showFollowerCountPublicly: true,
          _count: {
            select: { followers: true },
          },
        },
      },
    },
    orderBy: getSortOrder(selectedSort),
    take: 100,
  })

  // Quick filter options
  const filterTabs = [
    { label: "All Upcoming", window: "all" },
    { label: "Today", window: "today" },
    { label: "This Week", window: "this-week" },
    { label: "This Month", window: "this-month" },
    { label: "Next 30 Days", window: "next-30-days" },
  ]

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: "var(--page-bg)" }}>
      <div className="mx-auto max-w-6xl">
        {/* Header Section */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-wider bg-emerald-100/80 text-[#166534] dark:bg-emerald-950/50 dark:text-[#C8F55A] dark:border dark:border-emerald-800/40">
              <Sparkles className="h-3 w-3" />
              Discover Events
            </div>
            <h1
              className="mt-3 text-[2rem] leading-tight sm:text-[2.6rem] font-medium"
              style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}
            >
              Public events on EventSlot
            </h1>
            <p className="mt-2 text-[0.92rem] leading-6" style={{ color: "var(--text-secondary)" }}>
              Browse upcoming experiences, reserve your spot in seconds, and follow active event organizers.
            </p>
          </div>

          <div className="shrink-0">
            <span className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[0.82rem] font-medium shadow-xs" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
              <Compass className="h-4 w-4 text-[#166534] dark:text-[#C8F55A]" />
              <strong className="text-[var(--text-primary)]">{events.length}</strong> public {events.length === 1 ? "event" : "events"} available
            </span>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-8 space-y-3">
          <form
            method="get"
            className="rounded-[20px] border p-4 sm:p-5 shadow-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
              {/* Search text input */}
              <div className="sm:col-span-2 lg:col-span-5">
                <label className="mb-1.5 flex items-center gap-1.5 text-[0.74rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <Search className="h-3.5 w-3.5 text-[#166534] dark:text-[#C8F55A]" />
                  Search
                </label>
                <div className="relative">
                  <input
                    type="search"
                    name="q"
                    defaultValue={query}
                    placeholder="Search by event title or city/venue..."
                    className="w-full rounded-[14px] border px-4 py-2.5 text-[0.92rem] outline-none transition-colors focus:border-[#166534] dark:focus:border-[#C8F55A]"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              {/* Exact date */}
              <div className="sm:col-span-1 lg:col-span-3">
                <label className="mb-1.5 flex items-center gap-1.5 text-[0.74rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <Calendar className="h-3.5 w-3.5 text-[#166534] dark:text-[#C8F55A]" />
                  Specific Date
                </label>
                <input
                  type="date"
                  name="date"
                  defaultValue={selectedDate}
                  className="w-full rounded-[14px] border px-3.5 py-2.5 text-[0.9rem] outline-none transition-colors focus:border-[#166534] dark:focus:border-[#C8F55A]"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                />
              </div>

              {/* Sort Order */}
              <div className="sm:col-span-1 lg:col-span-2">
                <label className="mb-1.5 flex items-center gap-1.5 text-[0.74rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#166534] dark:text-[#C8F55A]" />
                  Sort
                </label>
                <select
                  name="sort"
                  defaultValue={selectedSort}
                  className="w-full rounded-[14px] border px-3 py-2.5 text-[0.9rem] outline-none transition-colors focus:border-[#166534] dark:focus:border-[#C8F55A]"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                >
                  <option value="soonest">Soonest first</option>
                  <option value="latest">Latest event date</option>
                  <option value="newest">Newest listing</option>
                  <option value="alphabetical">A to Z</option>
                </select>
              </div>

              {/* Hidden window input for preserving tab state on manual search */}
              <input type="hidden" name="window" value={selectedWindow} />

              {/* Actions */}
              <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 px-4 text-[0.86rem] font-semibold text-white shadow-xs transition-all active:scale-95"
                  style={{ background: "#166534" }}
                >
                  <Search className="h-3.5 w-3.5" />
                  Apply
                </button>
                {activeFiltersCount > 0 && (
                  <Link
                    href="/events"
                    className="inline-flex items-center justify-center rounded-full border p-2.5 text-[0.84rem] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                    title="Clear filters"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>

            {/* Quick Filter Window Pills */}
            <div className="mt-4 pt-3.5 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "var(--border)" }}>
              <span className="text-[0.75rem] font-medium text-[var(--text-muted)] mr-1">Time frame:</span>
              {filterTabs.map((tab) => {
                const isActive = selectedWindow === tab.window && !selectedDate
                const href = buildEventsPageHref({
                  q: query,
                  window: tab.window,
                  sort: selectedSort,
                })

                return (
                  <Link
                    key={tab.window}
                    href={href}
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-[0.78rem] font-medium transition-all ${
                      isActive
                        ? "bg-[#166534] text-white shadow-xs dark:bg-[#C8F55A] dark:text-[#0A0A0A]"
                        : "border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-zinc-400 bg-[var(--surface-2)]"
                    }`}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </div>
          </form>

          {/* Active Filter Tags Bar */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border px-4 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-[0.82rem] text-[var(--text-secondary)] m-0">
                Found <strong className="text-[var(--text-primary)]">{events.length}</strong> matching event{events.length === 1 ? "" : "s"}.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {query ? (
                  <Link
                    href={buildEventsPageHref({ date: selectedDate, window: selectedWindow, sort: selectedSort })}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.75rem] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span>Search: {query}</span>
                    <span className="text-xs opacity-60">×</span>
                  </Link>
                ) : null}
                {selectedDate ? (
                  <Link
                    href={buildEventsPageHref({ q: query, window: selectedWindow, sort: selectedSort })}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.75rem] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span>Date: {selectedDate}</span>
                    <span className="text-xs opacity-60">×</span>
                  </Link>
                ) : null}
                <Link
                  href="/events"
                  className="text-[0.75rem] font-semibold text-[#166534] dark:text-[#C8F55A] hover:underline ml-1"
                >
                  Clear all
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Event Grid or Empty State */}
        {events.length === 0 ? (
          <div className="rounded-[24px] border p-10 sm:p-14 text-center max-w-2xl mx-auto" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100/70 text-[#166534] dark:bg-emerald-950/50 dark:text-[#C8F55A]">
              <Calendar className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-[1.6rem] sm:text-[1.9rem] font-medium" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
              {activeFiltersCount > 0 ? "No events match those filters" : "No public events available right now"}
            </h2>
            <p className="mx-auto mt-2.5 max-w-md text-[0.92rem] leading-6" style={{ color: "var(--text-secondary)" }}>
              {activeFiltersCount > 0
                ? "Try searching with broader terms, clearing the specific date, or switching the time frame to 'All Upcoming'."
                : "Check back shortly or explore past public listings once organizers publish new upcoming events."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {activeFiltersCount > 0 && (
                <Link
                  href="/events"
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[0.84rem] font-semibold text-white shadow-xs transition-all active:scale-95"
                  style={{ background: "#166534" }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset all filters
                </Link>
              )}
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-[0.84rem] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                Back to home
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const effectiveDate = event.isRecurring
                ? computeNextOccurrenceDate({
                    eventDate: event.eventDate,
                    isRecurring: event.isRecurring,
                    recurrenceFrequency: event.recurrenceFrequency,
                    recurrenceDayOfWeek: event.recurrenceDayOfWeek,
                  })
                : event.eventDate
              const dateParts = getEventDateBadgeParts(effectiveDate)
              const windowStatus = event.isRecurring
                ? getRegistrationWindowStatus({
                    isRecurring: event.isRecurring,
                    recurrenceFrequency: event.recurrenceFrequency,
                    recurrenceDayOfWeek: event.recurrenceDayOfWeek,
                    registrationOpensDays: event.registrationOpensDays,
                    registrationOpensTime: event.registrationOpensTime,
                    deadline: event.deadline,
                    eventDate: event.eventDate,
                  })
                : null

              return (
                <article
                  key={event.id}
                  className="group flex flex-col overflow-hidden rounded-[20px] border shadow-xs transition-all duration-300 hover:shadow-md hover:border-emerald-600/30"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  {/* Poster Image with Floating Calendar Date & Pricing Badges */}
                  <div className="relative aspect-[16/10] sm:aspect-[4/5] overflow-hidden bg-[var(--surface-muted)]">
                    <Link href={`/${event.slug}`} className="block h-full w-full">
                      {event.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-800/10 via-zinc-800/5 to-zinc-900/10">
                          <Calendar className="h-12 w-12 text-zinc-400/40" />
                        </div>
                      )}
                    </Link>

                    {/* Calendar Date Badge (Top Left) */}
                    <div className="absolute top-3 left-3 flex flex-col items-center justify-center w-12 h-14 rounded-xl bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md shadow-md text-center py-1 px-1 border border-black/5 dark:border-white/10 pointer-events-none">
                      <span className="text-[0.62rem] font-bold uppercase tracking-wider text-[#166534] dark:text-[#C8F55A] leading-tight">
                        {dateParts.month}
                      </span>
                      <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 leading-tight">
                        {dateParts.day}
                      </span>
                    </div>

                    {/* Paid / Free Badge & Recurring Badge (Top Right) */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none">
                      {event.isRecurring && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-bold shadow-xs backdrop-blur-md bg-emerald-950/85 text-[#C8F55A] border border-emerald-500/40">
                          🔄 {event.recurrenceFrequency === "BIWEEKLY" ? "Bi-weekly" : event.recurrenceFrequency === "MONTHLY" ? "Monthly" : "Weekly"}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-bold shadow-xs backdrop-blur-md border ${
                          event.isPaid
                            ? "bg-amber-500/90 text-white border-amber-600/40"
                            : "bg-white/95 text-[#166534] dark:bg-zinc-900/90 dark:text-[#C8F55A] border-black/5 dark:border-white/10"
                        }`}
                      >
                        {event.isPaid ? "Paid" : "Free"}
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="flex flex-1 flex-col p-5">
                    {/* Event Title */}
                    <Link href={`/${event.slug}`} className="group-hover:text-[#166534] dark:group-hover:text-[#C8F55A] transition-colors">
                      <h2
                        className="text-[1.25rem] font-medium line-clamp-2 leading-snug"
                        style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}
                      >
                        {event.title}
                      </h2>
                    </Link>

                    {/* Date & Location Rows */}
                    <div className="mt-3 space-y-1.5 text-[0.82rem] text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#166534] dark:text-[#C8F55A]" />
                        <span className="truncate">
                          {event.isRecurring
                            ? `${formatEventDate(effectiveDate)} • Rolling ${event.recurrenceFrequency?.toLowerCase() || "weekly"}`
                            : formatEventDate(event.eventDate, event.eventEndAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#166534] dark:text-[#C8F55A]" />
                        <span className="truncate">{event.location || "Location to be announced"}</span>
                      </div>
                    </div>

                    {/* Window Status / Notify Me Banner for Recurring Events */}
                    {event.isRecurring && windowStatus && !windowStatus.isOpen && (
                      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-[0.76rem] text-amber-700 dark:text-amber-300">
                        <div className="flex items-center gap-1.5 truncate font-medium">
                          <span>⏳</span>
                          <span className="truncate">{windowStatus.label}</span>
                        </div>
                        <Link
                          href={`/${event.slug}`}
                          className="shrink-0 font-bold underline hover:no-underline text-emerald-700 dark:text-[#C8F55A]"
                        >
                          Notify me
                        </Link>
                      </div>
                    )}

                    {/* Organizer Row + Quick Follow */}
                    {(event.organizerName || event.organizer?.name) && (
                      <div
                        className="mt-4 pt-3.5 flex items-center justify-between gap-2 border-t"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div className="min-w-0 pr-1">
                          <p className="text-[0.66rem] uppercase tracking-wider text-[var(--text-muted)] m-0">Organized by</p>
                          <p className="text-[0.82rem] font-semibold text-[var(--text-primary)] truncate m-0">
                            {event.organizerName || event.organizer?.name}
                          </p>
                        </div>
                        {(event.organizer?.username || event.organizerId) && (
                          <div className="shrink-0">
                            <FollowButton
                              size="sm"
                              organiserUsername={event.organizer?.username || event.organizerId || ""}
                              organiserName={event.organizerName || event.organizer?.name || "Organizer"}
                              initialFollowerCount={event.organizer?._count?.followers}
                              showFollowerCountPublicly={event.organizer?.showFollowerCountPublicly}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Footer */}
                    <div className="mt-4 pt-3 flex items-center gap-2 border-t" style={{ borderColor: "var(--border)" }}>
                      <Link
                        href={`/${event.slug}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-2 px-4 text-[0.84rem] font-semibold text-white shadow-xs transition-all active:scale-95"
                        style={{ background: "#166534" }}
                      >
                        <span>Register</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <PublicEventShareButton title={event.title} url={`${APP_URL}/${event.slug}`} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
