import { prisma } from "@/lib/prisma"

export interface EventInsights {
  eventTitle: string
  totalRegistrations: number
  capacity: number
  fillRate: number
  waitlistCount: number
  status: string
  registrationOpen: boolean
  startDate: Date
  endDate: Date | null
  registrationDeadline: Date | null
  dailyRegistrations: { date: string; count: number }[]
  peakDay: string | null
  peakCount: number
  quietDays: string[]
  bestHourToShare: string | null
  registrationVelocity: "fast" | "moderate" | "slow" | "stalled"
  suggestions: string[]
}

type RegistrationLite = {
  status: string
  submittedAt: Date
}

function getEATDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Nairobi",
  }).format(date)
}

function getEATHour(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-KE", {
    hour: "numeric",
    hour12: false,
    timeZone: "Africa/Nairobi",
  }).formatToParts(date)
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0"
  const hour = Number.parseInt(hourPart, 10)
  return Number.isNaN(hour) ? 0 : hour
}

function formatHour12(hour24: number): string {
  if (hour24 === 0) return "12:00 AM"
  if (hour24 === 12) return "12:00 PM"
  if (hour24 > 12) return `${hour24 - 12}:00 PM`
  return `${hour24}:00 AM`
}

function isConfirmed(status: string): boolean {
  const s = status.toLowerCase()
  return s === "confirmed"
}

function isWaitlisted(status: string): boolean {
  const s = status.toLowerCase()
  return s === "waitlisted" || s === "waitlist"
}

export async function getEventInsights(
  eventId: string,
  requestingUserId: string
): Promise<EventInsights | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      registrations: {
        where: {
          status: {
            in: ["CONFIRMED", "WAITLISTED", "confirmed", "waitlisted", "WAITLIST"],
          },
        },
        select: { status: true, submittedAt: true },
        orderBy: { submittedAt: "asc" },
      },
    },
  })

  if (!event) return null
  if (event.organizerId !== requestingUserId) return null

  const registrations = event.registrations as RegistrationLite[]
  const confirmed = registrations.filter((r) => isConfirmed(r.status))
  const waitlisted = registrations.filter((r) => isWaitlisted(r.status))

  const capacity = event.capacity ?? 0
  const fillRate = capacity > 0 ? Math.round((confirmed.length / capacity) * 100) : 0

  const dailyMap: Record<string, number> = {}
  const hourMap: Record<number, number> = {}

  for (const reg of confirmed) {
    const day = getEATDayLabel(reg.submittedAt)
    const hour = getEATHour(reg.submittedAt)
    dailyMap[day] = (dailyMap[day] ?? 0) + 1
    hourMap[hour] = (hourMap[hour] ?? 0) + 1
  }

  const dailyEntries = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

  const peakEntry = dailyEntries.reduce(
    (max, current) => (current.count > max.count ? current : max),
    { date: "", count: 0 }
  )

  const quietDays = dailyEntries.filter((d) => d.count <= 1).map((d) => d.date)

  const peakHourEntry = Object.entries(hourMap).reduce(
    (max, current) => {
      const currentCount = Number(current[1])
      return currentCount > max.count ? { hour: Number(current[0]), count: currentCount } : max
    },
    { hour: -1, count: 0 }
  )

  const bestHourToShare = peakHourEntry.hour >= 0 ? formatHour12(peakHourEntry.hour) : null

  const now = new Date()
  const registrationOpenDate = event.createdAt
  const daysSinceOpen = Math.max(
    1,
    Math.floor((now.getTime() - registrationOpenDate.getTime()) / 86400000)
  )
  const avgPerDay = confirmed.length / daysSinceOpen

  const registrationVelocity: EventInsights["registrationVelocity"] =
    avgPerDay >= 10
      ? "fast"
      : avgPerDay >= 3
        ? "moderate"
        : avgPerDay >= 1
          ? "slow"
          : "stalled"

  const suggestions: string[] = []

  if (capacity > 0 && fillRate >= 90 && waitlisted.length === 0) {
    suggestions.push(
      `Your event is ${fillRate}% full. Consider increasing capacity to capture more interest.`
    )
  }

  if (capacity > 0 && fillRate < 30 && daysSinceOpen > 3) {
    suggestions.push(
      `Fill rate is ${fillRate}%. Share the registration link again - your peak registration hour was ${bestHourToShare ?? "evening"}.`
    )
  }

  if (waitlisted.length > 0) {
    suggestions.push(
      `You have ${waitlisted.length} people on the waitlist. Increasing capacity will automatically promote them.`
    )
  }

  if (registrationVelocity === "stalled") {
    suggestions.push(
      "Registrations have slowed. A reminder post or message to your audience often triggers a spike."
    )
  }

  if (bestHourToShare) {
    suggestions.push(
      `Your registrations peak around ${bestHourToShare} EAT - best time to share your link for maximum impact.`
    )
  }

  return {
    eventTitle: event.title,
    totalRegistrations: confirmed.length,
    capacity,
    fillRate,
    waitlistCount: waitlisted.length,
    status: event.status,
    registrationOpen:
      event.status.toLowerCase() === "active" &&
      !event.archived &&
      (!event.deadline || now < event.deadline),
    startDate: event.eventDate ?? event.createdAt,
    endDate: event.deadline ?? null,
    registrationDeadline: event.deadline ?? null,
    dailyRegistrations: dailyEntries,
    peakDay: peakEntry.date || null,
    peakCount: peakEntry.count,
    quietDays,
    bestHourToShare,
    registrationVelocity,
    suggestions,
  }
}

export async function getOrganizerEventSummaries(userId: string) {
  const events = await prisma.event.findMany({
    where: { organizerId: userId },
    select: {
      id: true,
      title: true,
      status: true,
      capacity: true,
      eventDate: true,
      _count: {
        select: {
          registrations: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return events.map((event) => {
    const capacity = event.capacity ?? 0
    const registrations = event._count.registrations
    const fillRate = capacity > 0 ? Math.round((registrations / capacity) * 100) : 0

    return {
      id: event.id,
      title: event.title,
      status: event.status,
      registrations,
      capacity,
      fillRate,
      startDate: event.eventDate,
    }
  })
}
