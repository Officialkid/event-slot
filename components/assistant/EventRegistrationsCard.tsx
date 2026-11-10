"use client"

import Link from "next/link"

export interface RegistrationOverviewEvent {
  id: string
  slug: string
  title: string
  status: string
  capacity: number | null
  confirmedCount: number
  waitlistCount: number
  fillRate: number
  eventDate: string | null
}

interface EventRegistrationsCardProps {
  events: RegistrationOverviewEvent[]
  onSelectEventForInsights?: (title: string, slug: string) => void
}

export function EventRegistrationsCard({
  events,
  onSelectEventForInsights,
}: EventRegistrationsCardProps) {
  if (!events || events.length === 0) return null

  return (
    <div
      data-testid="event-registrations-card"
      className="mt-3 rounded-2xl border border-[#E2E8F0] dark:border-[#2A2A2A] bg-white dark:bg-[#111111] p-3 sm:p-4 text-xs text-[#0F172A] dark:text-[#F0EDE6] shadow-md space-y-3"
    >
      <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#262626] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#15803D]/10 text-[#15803D] dark:bg-[#C8F55A]/15 dark:text-[#C8F55A]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <span className="font-semibold text-xs text-[#0F172A] dark:text-white">
            Active Events Overview
          </span>
        </div>
        <span className="rounded-full bg-[#15803D]/10 text-[#15803D] dark:bg-[#C8F55A]/15 dark:text-[#C8F55A] px-2.5 py-0.5 text-[10px] font-bold">
          {events.length} {events.length === 1 ? "Event" : "Events"}
        </span>
      </div>

      <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-0.5">
        {events.map((ev) => {
          const hasCapacity = typeof ev.capacity === "number" && ev.capacity > 0
          const fill = Math.min(Math.max(ev.fillRate ?? 0, 0), 100)
          const formattedDate = ev.eventDate
            ? new Date(ev.eventDate).toLocaleDateString("en-KE", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            : null

          return (
            <div
              key={ev.id || ev.slug}
              className="rounded-xl border border-[#F1F5F9] dark:border-[#222222] bg-[#F8FAFC] dark:bg-[#181818] p-3 transition-all hover:border-[#CBD5E1] dark:hover:border-[#333333]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-xs text-[#0F172A] dark:text-white truncate">
                    {ev.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#64748B] dark:text-[#A1A1AA]">
                    {formattedDate && <span>📅 {formattedDate}</span>}
                    <span className="truncate">@{ev.slug}</span>
                  </div>
                </div>
                <span
                  className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    ev.status === "active"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  {ev.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-2.5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[#334155] dark:text-[#D4D4D8]">
                    {ev.confirmedCount}{" "}
                    {hasCapacity ? `/ ${ev.capacity} confirmed` : "confirmed attendee" + (ev.confirmedCount === 1 ? "" : "s")}
                  </span>
                  {hasCapacity && (
                    <span
                      className={`font-bold text-[10px] ${
                        fill >= 90
                          ? "text-emerald-600 dark:text-[#C8F55A]"
                          : fill >= 50
                          ? "text-blue-600 dark:text-sky-400"
                          : "text-[#64748B] dark:text-[#A1A1AA]"
                      }`}
                    >
                      {fill}% filled
                    </span>
                  )}
                </div>

                {hasCapacity && (
                  <div className="h-2 w-full rounded-full bg-[#E2E8F0] dark:bg-[#282828] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        fill >= 90
                          ? "bg-[#15803D] dark:bg-[#C8F55A]"
                          : fill >= 50
                          ? "bg-blue-600 dark:bg-sky-400"
                          : "bg-slate-400 dark:bg-neutral-500"
                      }`}
                      style={{ width: `${Math.max(fill, 4)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Waitlist chip if any */}
              {ev.waitlistCount > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-md px-2 py-0.5">
                  <span>⏳</span>
                  <span>{ev.waitlistCount} on waitlist</span>
                </div>
              )}

              {/* Action links */}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E2E8F0] dark:border-[#262626] pt-2 text-[11px]">
                <Link
                  href={`/dashboard/events/${ev.slug}`}
                  className="font-semibold text-[#15803D] dark:text-[#C8F55A] hover:underline flex items-center gap-1"
                >
                  Manage Event
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>

                {onSelectEventForInsights && (
                  <button
                    type="button"
                    onClick={() => onSelectEventForInsights(ev.title, ev.slug)}
                    className="text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white transition-colors"
                  >
                    Ask Insights →
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
