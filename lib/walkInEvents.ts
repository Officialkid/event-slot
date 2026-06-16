const WALK_IN_TIME_ZONE = "Africa/Nairobi"

function formatInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function getWalkInDayKey(date: Date, timeZone = WALK_IN_TIME_ZONE) {
  return formatInTimeZone(date, timeZone)
}

export function dayKeyToDate(dayKey: string) {
  return new Date(`${dayKey}T00:00:00.000Z`)
}

export function getTodayWalkInDate(now = new Date(), timeZone = WALK_IN_TIME_ZONE) {
  return dayKeyToDate(getWalkInDayKey(now, timeZone))
}

export function getEventStartDayKey(eventDate: Date | string | null | undefined, timeZone = WALK_IN_TIME_ZONE) {
  if (!eventDate) return null
  return getWalkInDayKey(eventDate instanceof Date ? eventDate : new Date(eventDate), timeZone)
}

export function getEventEndDayKey(
  eventDate: Date | string | null | undefined,
  eventEndAt: Date | string | null | undefined,
  timeZone = WALK_IN_TIME_ZONE
) {
  if (eventEndAt) {
    return getWalkInDayKey(eventEndAt instanceof Date ? eventEndAt : new Date(eventEndAt), timeZone)
  }
  if (eventDate) {
    return getWalkInDayKey(eventDate instanceof Date ? eventDate : new Date(eventDate), timeZone)
  }
  return null
}

export function isWalkInOpenToday(params: {
  eventDate: Date | string | null | undefined
  eventEndAt: Date | string | null | undefined
  now?: Date
  timeZone?: string
}) {
  const { eventDate, eventEndAt, now = new Date(), timeZone = WALK_IN_TIME_ZONE } = params
  const startDay = getEventStartDayKey(eventDate, timeZone)
  const endDay = getEventEndDayKey(eventDate, eventEndAt, timeZone)
  if (!startDay || !endDay) return false
  const today = getWalkInDayKey(now, timeZone)
  return today >= startDay && today <= endDay
}

export function getWalkInDayRange(params: {
  eventDate: Date | string | null | undefined
  eventEndAt: Date | string | null | undefined
  timeZone?: string
}) {
  const { eventDate, eventEndAt, timeZone = WALK_IN_TIME_ZONE } = params
  const startDay = getEventStartDayKey(eventDate, timeZone)
  const endDay = getEventEndDayKey(eventDate, eventEndAt, timeZone)
  if (!startDay || !endDay) return []

  const days: string[] = []
  let cursor = dayKeyToDate(startDay)
  const finalDay = dayKeyToDate(endDay)
  while (cursor.getTime() <= finalDay.getTime()) {
    days.push(getWalkInDayKey(cursor, "UTC"))
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }
  return days
}

export function getWalkInDayPosition(params: {
  dayKey: string
  eventDate: Date | string | null | undefined
  eventEndAt: Date | string | null | undefined
  timeZone?: string
}) {
  const { dayKey, eventDate, eventEndAt, timeZone = WALK_IN_TIME_ZONE } = params
  const days = getWalkInDayRange({ eventDate, eventEndAt, timeZone })
  const index = days.findIndex((entry) => entry === dayKey)
  if (index === -1) return null
  return {
    index: index + 1,
    total: days.length,
  }
}

export function formatWalkInDayLabel(dayKey: string, timeZone = WALK_IN_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dayKeyToDate(dayKey))
}

export function formatWalkInLongDayLabel(dayKey: string, timeZone = WALK_IN_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dayKeyToDate(dayKey))
}

export function formatWalkInShortDayLabel(dayKey: string, timeZone = WALK_IN_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dayKeyToDate(dayKey))
}

export function getWalkInTimeZone() {
  return WALK_IN_TIME_ZONE
}
