/**
 * EventSlot Recruitment Formatting Utilities
 * Nairobi-localized date, time, and currency helpers
 */

export function formatNairobiDeadline(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return "Open until filled"
  const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal
  if (!d || isNaN(d.getTime())) return "Open until filled"

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d)
}

export function formatNairobiDate(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return "—"
  const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal
  if (!d || isNaN(d.getTime())) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d)
}
