import { APP_URL } from '@/lib/config'

type CalendarLinkParams = {
  title: string
  description: string
  location?: string | null
  startDate: Date
  endDate?: Date | null
  durationMins?: number
}

function pad(num: number) {
  return String(num).padStart(2, '0')
}

function formatGoogleDate(value: Date) {
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}Z`
}

function normalizeLineBreaks(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function escapeIcsText(value: string) {
  return normalizeLineBreaks(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function getDurationMins(startIso: string | Date | null | undefined, endIso: string | Date | null | undefined) {
  if (!startIso || !endIso) return 120
  const diff = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  return diff > 0 ? diff : 120
}

export function getCalendarEndDate(startDate: Date, endDate?: Date | null, durationMins = 120) {
  if (endDate && !Number.isNaN(endDate.getTime()) && endDate.getTime() > startDate.getTime()) {
    return endDate
  }
  return new Date(startDate.getTime() + durationMins * 60_000)
}

export function buildGoogleCalendarTemplateUrl(params: CalendarLinkParams) {
  const effectiveDuration = params.durationMins ?? getDurationMins(params.startDate, params.endDate)
  const endDate = getCalendarEndDate(params.startDate, params.endDate, effectiveDuration)
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${formatGoogleDate(params.startDate)}/${formatGoogleDate(endDate)}`,
    details: params.description,
  })
  if (params.location) query.set('location', params.location)
  return `https://calendar.google.com/calendar/render?${query.toString()}`
}

export function buildEventIcs(params: CalendarLinkParams & { uid: string; url?: string | null }) {
  const effectiveDuration = params.durationMins ?? getDurationMins(params.startDate, params.endDate)
  const endDate = getCalendarEndDate(params.startDate, params.endDate, effectiveDuration)
  const now = new Date()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventSlot//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(params.uid)}`,
    `DTSTAMP:${formatGoogleDate(now)}`,
    `DTSTART:${formatGoogleDate(params.startDate)}`,
    `DTEND:${formatGoogleDate(endDate)}`,
    `SUMMARY:${escapeIcsText(params.title)}`,
    `DESCRIPTION:${escapeIcsText(params.description)}`,
  ]

  if (params.location) lines.push(`LOCATION:${escapeIcsText(params.location)}`)
  if (params.url) lines.push(`URL:${escapeIcsText(params.url)}`)

  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Event reminder',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Event reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  )

  return `${lines.join('\r\n')}\r\n`
}

export function buildEventPublicUrl(eventSlug: string, organizerUsername?: string | null) {
  return organizerUsername ? `${APP_URL}/${organizerUsername}/${eventSlug}` : `${APP_URL}/join/${eventSlug}`
}
