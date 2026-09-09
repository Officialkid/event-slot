/**
 * Recurring Events & Date/Time Decoupling Helpers
 */

export function computeNextOccurrenceDate(event: {
  eventDate?: Date | string | null
  isRecurring?: boolean | null
  recurrenceFrequency?: string | null
  recurrenceDayOfWeek?: number | null
}): Date {
  const baseDate = event.eventDate ? new Date(event.eventDate) : new Date()
  if (!event.isRecurring) {
    return baseDate
  }

  const targetDay = event.recurrenceDayOfWeek !== undefined && event.recurrenceDayOfWeek !== null
    ? event.recurrenceDayOfWeek
    : baseDate.getDay() // default to same day of week

  const now = new Date()
  const candidate = new Date(now)
  
  // Align candidate to target day of week
  const currentDay = candidate.getDay()
  let daysUntil = (targetDay - currentDay + 7) % 7
  
  // If target day is today, check if time has already passed
  if (daysUntil === 0) {
    const targetHours = baseDate.getHours()
    const targetMinutes = baseDate.getMinutes()
    if (now.getHours() > targetHours || (now.getHours() === targetHours && now.getMinutes() > targetMinutes)) {
      daysUntil = 7 // Move to next week
    }
  }

  candidate.setDate(candidate.getDate() + daysUntil)
  candidate.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0)
  return candidate
}

export function getRegistrationWindowStatus(event: {
  isRecurring?: boolean | null
  recurrenceFrequency?: string | null
  recurrenceDayOfWeek?: number | null
  registrationOpensDays?: number | null
  registrationOpensTime?: string | null
  deadline?: Date | string | null
  eventDate?: Date | string | null
}): {
  isOpen: boolean
  opensAt: Date | null
  nextOccurrence: Date | null
  label: string
} {
  if (!event.isRecurring) {
    if (event.deadline) {
      const isPast = new Date() > new Date(event.deadline)
      return {
        isOpen: !isPast,
        opensAt: null,
        nextOccurrence: event.eventDate ? new Date(event.eventDate) : null,
        label: isPast ? 'Registration Closed' : 'Registration Open',
      }
    }
    return {
      isOpen: true,
      opensAt: null,
      nextOccurrence: event.eventDate ? new Date(event.eventDate) : null,
      label: 'Registration Open',
    }
  }

  const nextOccurrence = computeNextOccurrenceDate(event)
  const opensDays = event.registrationOpensDays ?? 4
  const opensTimeStr = event.registrationOpensTime || '08:00'
  const [hours, mins] = opensTimeStr.split(':').map(Number)

  const windowOpensAt = new Date(nextOccurrence)
  windowOpensAt.setDate(windowOpensAt.getDate() - opensDays)
  windowOpensAt.setHours(isNaN(hours) ? 8 : hours, isNaN(mins) ? 0 : mins, 0, 0)

  const now = new Date()

  if (now < windowOpensAt) {
    const dayName = windowOpensAt.toLocaleDateString(undefined, { weekday: 'long' })
    const timeFormatted = windowOpensAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return {
      isOpen: false,
      opensAt: windowOpensAt,
      nextOccurrence,
      label: `Registration opens ${dayName} at ${timeFormatted}`,
    }
  }

  return {
    isOpen: true,
    opensAt: windowOpensAt,
    nextOccurrence,
    label: 'Registration Open for Upcoming Edition',
  }
}

export function formatEventDateTime(
  eventDate: Date | string | null | undefined,
  eventEndAt: Date | string | null | undefined,
  hasSpecificTime: boolean = true,
  isRecurring: boolean = false,
  recurrenceFrequency?: string | null
): string {
  if (!eventDate) return 'Date TBA'
  const start = new Date(eventDate)
  if (isNaN(start.getTime())) return 'Date TBA'

  const datePart = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  if (!hasSpecificTime) {
    const recurringTag = isRecurring ? ' • Recurring' : ''
    return `${datePart} • All Day / Flexible Time${recurringTag}`
  }

  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  let timePart = startTime

  if (eventEndAt) {
    const end = new Date(eventEndAt)
    if (!isNaN(end.getTime())) {
      const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      timePart = `${startTime} – ${endTime}`
    }
  }

  const recurringTag = isRecurring ? ` (Repeats ${recurrenceFrequency?.toLowerCase() || 'weekly'})` : ''
  return `${datePart} at ${timePart}${recurringTag}`
}
