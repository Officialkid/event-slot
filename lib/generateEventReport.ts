import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  PageNumber,
  Header,
  Footer,
  PageBreak,
  ImageRun,
  SimpleField,
} from 'docx'
import { format } from 'date-fns'
import { AIReportContent, generateAIReportContent } from './generateAIReportContent'
import { askAI } from './ai'

// ── Theme palette ─────────────────────────────────────────────────────────────

export type ReportTheme = 'eventslot' | 'navy' | 'forest' | 'wine' | 'graphite'

const THEMES: Record<ReportTheme, { banner: string; accent: string; sub: string }> = {
  eventslot:{ banner: '0A0A0A', accent: 'C8F55A', sub: '7AB648' },
  navy:     { banner: '1F3864', accent: 'FFFFFF', sub: 'B8CDE8' },
  forest:   { banner: '1B4332', accent: 'FFFFFF', sub: 'A8D5B8' },
  wine:     { banner: '4A0E2E', accent: 'FFFFFF', sub: 'E8B4CD' },
  graphite: { banner: '1C1C1C', accent: 'FFFFFF', sub: 'B8B8B8' },
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IQuestion {
  id: string
  label: string
  type: string
}

export interface IEvent {
  title: string
  slug: string
  organizerEmail: string
  confirmedCount: number
  waitlistCount: number
  capacity: number | null
  eventDate: string | null
  location: string | null
  deadline: string | null
  createdAt: string
  questions: IQuestion[]
}

export interface IRegistration {
  id: string
  answers: Array<{ questionId: string; value: string }>
  registrationNumber?: number | null
  submittedAt: string
  waitlistPosition?: number | null
}

export interface EventReportData {
  title: string
  slug: string
  organizerEmail: string
  organizerName: string
  eventDate: Date
  location: string
  registrationOpenDate: Date
  registrationDeadline: Date
  capacity: number
  totalRegistrations: number
  confirmedCount: number
  waitlistCount: number
  attendees: {
    name: string
    registrationNumber: number
    phone?: string
    registeredAt: Date
  }[]
  waitlist: {
    name: string
    position: number
    joinedAt: Date
  }[]
  dailyRegistrationCounts: { date: string; count: number }[]
  peakDate: string
  peakDayCount: number
  customQuestionResponses?: { question: string; answers: string[] }[]
  theme?: ReportTheme
}

type ActionItem = {
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  action: string
  owner: 'Organiser' | 'EventSlot platform'
  timeframe: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONTENT_WIDTH = 9026 // A4 content width in DXA (11906 - 1440*2)
const TABLE_WIDTH = CONTENT_WIDTH

function noBorder() {
  const b = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b }
}

function thinBorder() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' }
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b }
}

const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 }

function spacer(): Paragraph {
  return new Paragraph({ text: '' })
}

function fmt(iso: string | null | undefined, def = 'Not specified'): string {
  if (!iso) return def
  try { return format(new Date(iso), 'dd MMM yyyy') } catch { return def }
}

function fmtDateTime(iso: string): string {
  try { return format(new Date(iso), 'dd MMM yyyy HH:mm') } catch { return iso }
}

function fmtDay(iso: string): string {
  try { return format(new Date(iso), 'dd MMM yyyy') } catch { return iso }
}

function todayStr(): string {
  return format(new Date(), 'dd MMM yyyy')
}

function fmtLongDate(iso: string | null | undefined, def = 'Not specified'): string {
  if (!iso) return def
  try { return format(new Date(iso), 'd MMMM yyyy') } catch { return def }
}

function fmtDeadlineEAT(iso: string | null | undefined): string {
  if (!iso) return 'No deadline'
  try {
    const date = new Date(iso)
    const body = format(date, "d MMMM yyyy, HH:mm")
    return `${body} EAT`
  } catch {
    return 'No deadline'
  }
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim()
}

function findQuestionId(event: IEvent, opts: { type?: string; keywords?: string[] }): string | null {
  const keywords = (opts.keywords ?? []).map((k) => k.toLowerCase())
  const byType = opts.type
    ? event.questions.find((q) => q.type.toLowerCase() === opts.type?.toLowerCase())
    : undefined
  if (byType) return byType.id

  if (keywords.length > 0) {
    const byLabel = event.questions.find((q) => {
      const label = q.label.toLowerCase()
      return keywords.some((k) => label.includes(k))
    })
    if (byLabel) return byLabel.id
  }

  return null
}

function answerByQuestionId(reg: IRegistration, questionId: string | null): string {
  if (!questionId) return ''
  return normalizeText(reg.answers.find((a) => a.questionId === questionId)?.value)
}

function getAttendeeName(reg: IRegistration, event: IEvent): string {
  const id = findQuestionId(event, { type: 'text', keywords: ['full name', 'name'] })
  const byName = answerByQuestionId(reg, id)
  if (byName) return byName
  const fallback = normalizeText(reg.answers[0]?.value)
  return fallback || 'N/A'
}

function getAttendeePhone(reg: IRegistration, event: IEvent): string {
  const id = findQuestionId(event, { type: 'phone', keywords: ['phone', 'mobile', 'tel'] })
  return answerByQuestionId(reg, id)
}

function shouldShowPhoneColumn(event: IEvent, attendees: IRegistration[]): boolean {
  if (attendees.length === 0) return false
  const provided = attendees.filter((attendee) => {
    const phone = normalizeText(getAttendeePhone(attendee, event))
    return phone !== '' && phone.toUpperCase() !== 'N/A'
  }).length
  return provided / attendees.length >= 0.3
}

function getRegistrationNumberDisplay(reg: IRegistration, event: IEvent): string {
  const id = findQuestionId(event, {
    keywords: ['registration number', 'reg no', 'admission', 'student number', 'id number'],
  })
  const fromForm = answerByQuestionId(reg, id)
  if (fromForm) return fromForm
  if (reg.registrationNumber !== null && reg.registrationNumber !== undefined) {
    return String(reg.registrationNumber)
  }
  return 'N/A'
}

// ── Header / Footer ───────────────────────────────────────────────────────────

function makeHeader(eventTitle: string): Header {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: eventTitle,
            font: 'Arial',
            size: 18,
            color: '888888',
          }),
        ],
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
        spacing: { after: 80 },
      }),
    ],
  })
}

function makeFooter(eventTitle: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'C8F55A' } },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'EventSlot  ·  ',
            font: 'Arial',
            size: 16,
            color: '888888',
          }),
          new TextRun({
            text: 'Confidential  ·  ',
            font: 'Arial',
            size: 16,
            color: '888888',
          }),
          new TextRun({
            text: eventTitle,
            italics: true,
            font: 'Arial',
            size: 16,
            color: '888888',
          }),
          new TextRun({
            text: '  ·  Page ',
            font: 'Arial',
            size: 16,
            color: '888888',
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: 'Arial',
            size: 16,
            color: '888888',
          }),
          new TextRun({ text: ' of ', font: 'Arial', size: 16, color: '888888' }),
          new TextRun({ children: [new SimpleField('NUMPAGES')], font: 'Arial', size: 16, color: '888888' }),
        ],
        spacing: { before: 80 },
      }),
    ],
  })
}

// ── Cover Page ────────────────────────────────────────────────────────────────

function buildMetadataTable(event: IEvent): Table {
  const rows: [string, string][] = [
    ['Organiser Name', normalizeText((event as IEvent & { organizerName?: string }).organizerName) || 'Not specified'],
    ['Organiser', event.organizerEmail],
    ['Event Date', fmtLongDate(event.eventDate)],
    ['Location', event.location ?? 'Not specified'],
    ['Registration Deadline', fmtDeadlineEAT(event.deadline)],
    ['Report Generated', fmtLongDate(new Date().toISOString())],
  ]

  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: thinBorder(),
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2500, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: 'F5F5F5', color: 'auto' },
            margins: CELL_MARGINS,
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, bold: true, size: 20, color: '333333', font: 'Arial' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: TABLE_WIDTH - 2500, type: WidthType.DXA },
            margins: CELL_MARGINS,
            children: [
              new Paragraph({
                children: [new TextRun({ text: value, size: 20, color: '555555', font: 'Arial' })],
              }),
            ],
          }),
        ],
      }),
    ),
  })
}

function buildEventReportHeader(event: IEvent): (Paragraph | Table)[] {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: 'Event', bold: true, size: 36, color: '000000', font: 'Arial' }),
        new TextRun({ text: 'Slot', bold: true, size: 36, color: 'C8F55A', font: 'Arial' }),
      ],
      spacing: { before: 0, after: 120 },
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'C8F55A' } },
      spacing: { after: 120 },
      children: [new TextRun('')],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: event.title,
          bold: true,
          size: 44,
          color: '000000',
          font: 'Arial',
        }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'EVENT INTELLIGENCE REPORT',
          size: 20,
          color: '888888',
          allCaps: true,
          font: 'Arial',
        }),
      ],
      spacing: { after: 200 },
    }),
    buildMetadataTable(event),
    new Paragraph({
      spacing: { before: 140, after: 100 },
      children: [
        new TextRun({
          text: 'Confidentiality Notice: This report contains organiser and attendee operational data. It is confidential and must not be shared outside authorised stakeholders without lawful basis.',
          size: 18,
          color: '777777',
          italics: true,
          font: 'Arial',
        }),
      ],
      border: { left: { style: BorderStyle.SINGLE, size: 8, color: 'C8F55A', space: 140 } },
      indent: { left: 280 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

function fillRateColor(fillRate: number): string {
  if (fillRate >= 90) return '22C55E'
  if (fillRate >= 60) return 'C8F55A'
  if (fillRate >= 30) return 'F59E0B'
  return 'EF4444'
}

function fillRateLabel(fillRate: number): string {
  if (fillRate >= 90) return 'Near Capacity'
  if (fillRate >= 60) return 'Healthy'
  if (fillRate >= 30) return 'Moderate'
  return 'Low - Review Strategy'
}

function buildEventSnapshotRow(event: IEvent): Table {
  const totalRegistrations = event.confirmedCount + event.waitlistCount
  const hasCapacity = !!event.capacity && event.capacity > 0
  const fillRate = hasCapacity ? Math.round((event.confirmedCount / event.capacity!) * 100) : 0

  const stats: Array<{ value: string; label: string; color?: string }> = [
    { value: String(totalRegistrations), label: 'Total Registrations' },
    { value: String(event.confirmedCount), label: 'Confirmed' },
    { value: String(event.waitlistCount), label: 'On Waitlist' },
    { value: hasCapacity ? String(event.capacity) : 'Unlimited', label: 'Capacity' },
    {
      value: hasCapacity ? `${fillRate}%` : 'N/A',
      label: hasCapacity ? fillRateLabel(fillRate) : 'Capacity Needed',
      color: hasCapacity ? fillRateColor(fillRate) : 'E5E7EB',
    },
  ]

  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: noBorder(),
    columnWidths: [1805, 1805, 1805, 1805, 1806],
    rows: [
      new TableRow({
        children: stats.map(
          (stat) =>
            new TableCell({
              shading: { fill: stat.color ?? 'C8F55A', type: ShadingType.CLEAR, color: 'auto' },
              margins: { top: 180, bottom: 180, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: stat.value,
                      bold: true,
                      size: 52,
                      color: '000000',
                      font: 'Arial',
                    }),
                  ],
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: stat.label,
                      size: 18,
                      color: '1A1A1A',
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            })
        ),
      }),
    ],
  })
}

async function renderChartBuffer(config: unknown, width = 1200, height = 560): Promise<Buffer | null> {
  try {
    const url = `https://quickchart.io/chart?width=${width}&height=${height}&backgroundColor=white&c=${encodeURIComponent(
      JSON.stringify(config),
    )}`

    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

function buildDailyRegistrationCounts(
  attendees: IRegistration[],
  openDateIso: string,
  closeDateIso: string,
): Array<{ date: string; count: number }> {
  const countsByDay: Record<string, number> = {}

  for (const attendee of attendees) {
    const date = new Date(attendee.submittedAt)
    if (Number.isNaN(date.getTime())) continue
    const dateKey = format(date, 'yyyy-MM-dd')
    countsByDay[dateKey] = (countsByDay[dateKey] ?? 0) + 1
  }

  const safeOpen = new Date(openDateIso)
  const safeClose = new Date(closeDateIso)
  const start = safeOpen.getTime() <= safeClose.getTime() ? safeOpen : safeClose
  const end = safeOpen.getTime() <= safeClose.getTime() ? safeClose : safeOpen

  const rows: Array<{ date: string; count: number }> = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  while (cursor.getTime() <= end.getTime()) {
    const key = format(cursor, 'yyyy-MM-dd')
    rows.push({ date: format(cursor, 'd MMM'), count: countsByDay[key] ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  if (rows.length > 0) return rows

  return Object.entries(countsByDay)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, count]) => ({ date: format(new Date(date), 'd MMM'), count }))
}

function buildRegistrationTimelineConfig(
  dailyCounts: Array<{ date: string; count: number }>,
  openDateLabel: string,
  closeDateLabel: string,
): object {
  const peakDay = dailyCounts.reduce((max, day) => (day.count > max.count ? day : max), dailyCounts[0])

  return {
    type: 'bar',
    data: {
      labels: dailyCounts.map((d) => d.date),
      datasets: [
        {
          label: 'Registrations',
          data: dailyCounts.map((d) => d.count),
          backgroundColor: dailyCounts.map((d) =>
            d.date === peakDay.date ? '#C8F55A' : 'rgba(200,245,90,0.4)',
          ),
          borderColor: '#C8F55A',
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Daily Registration Activity',
          font: { size: 14, weight: 'bold' },
          color: '#000',
        },
        legend: { display: false },
        annotation: {
          annotations: {
            openDateLine: {
              type: 'line',
              xMin: openDateLabel,
              xMax: openDateLabel,
              borderColor: '#111111',
              borderDash: [4, 4],
              borderWidth: 1,
              label: {
                display: true,
                content: 'Registration Open',
                position: 'start',
                backgroundColor: 'rgba(255,255,255,0.85)',
                color: '#111111',
              },
            },
            closeDateLine: {
              type: 'line',
              xMin: closeDateLabel,
              xMax: closeDateLabel,
              borderColor: '#111111',
              borderDash: [4, 4],
              borderWidth: 1,
              label: {
                display: true,
                content: 'Registration Close',
                position: 'end',
                backgroundColor: 'rgba(255,255,255,0.85)',
                color: '#111111',
              },
            },
            peakLabel: {
              type: 'label',
              xValue: peakDay.date,
              yValue: peakDay.count + 0.5,
              content: [`Peak — ${peakDay.count} registrations`],
              color: '#000',
              font: { size: 11 },
              backgroundColor: 'rgba(255,255,255,0.9)',
            },
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
        x: { grid: { display: false } },
      },
    },
  }
}

async function buildRegistrationTimelineChart(
  attendees: IRegistration[],
  precomputedDailyCounts: Array<{ date: string; count: number }>,
  openDateIso: string,
  closeDateIso: string,
): Promise<{ chartBuffer: Buffer | null; dailyCounts: Array<{ date: string; count: number }> }> {
  const dailyCounts =
    precomputedDailyCounts.length > 0
      ? precomputedDailyCounts
      : buildDailyRegistrationCounts(attendees, openDateIso, closeDateIso)
  if (dailyCounts.length === 0) {
    return { chartBuffer: null, dailyCounts }
  }

  const openDateLabel = format(new Date(openDateIso), 'd MMM')
  const closeDateLabel = format(new Date(closeDateIso), 'd MMM')
  const config = buildRegistrationTimelineConfig(dailyCounts, openDateLabel, closeDateLabel)
  const chartBuffer = await renderChartBuffer(config, 1200, 520)

  return { chartBuffer, dailyCounts }
}

function timelineChartBlock(chartBuffer: Buffer | null): Paragraph[] {
  if (!chartBuffer) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Daily Registration Activity chart could not be rendered for this run.',
            font: 'Arial',
            size: 20,
            color: '777777',
          }),
        ],
      }),
    ]
  }

  return [
    new Paragraph({
      children: [
        new ImageRun({
          type: 'png',
          data: chartBuffer,
          transformation: { width: 980, height: 424 },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
    }),
  ]
}

function fallbackTimelineAnalysis(
  event: IEvent,
  peakDate: string,
  peakCount: number,
  peakPercent: number,
  velocityTrend: string,
  zeroDays: string,
): string {
  return `Registrations for ${event.title} peaked on ${peakDate} with ${peakCount} sign-ups (${peakPercent}% of total), which likely corresponds to a specific promotion or outreach push that day. The timeline shows ${velocityTrend}, while zero-registration days (${zeroDays}) indicate gaps where demand was not actively captured. For the next event, schedule your strongest promo burst 48-72 hours before the expected peak window and open registration earlier to extend high-intent conversion days.`
}

async function buildTimelineAnalysis(
  event: IEvent,
  dailyCounts: Array<{ date: string; count: number }>,
  openDateIso: string,
  closeDateIso: string,
): Promise<string> {
  if (dailyCounts.length === 0) {
    return 'No registration activity was recorded in the selected registration window. Open registration earlier and align campaign timing to build momentum before the event date. Add at least two reminder pushes across the window to avoid a flat intake period.'
  }

  const peakDay = dailyCounts.reduce((max, day) => (day.count > max.count ? day : max), dailyCounts[0])
  const totalRegistrations = dailyCounts.reduce((sum, day) => sum + day.count, 0)
  const peakPercent = totalRegistrations > 0 ? Math.round((peakDay.count / totalRegistrations) * 100) : 0
  const zeroDays = dailyCounts.filter((d) => d.count === 0).map((d) => d.date)
  const midpoint = Math.floor(dailyCounts.length / 2)
  const firstHalf = dailyCounts.slice(0, Math.max(1, midpoint))
  const secondHalf = dailyCounts.slice(Math.max(1, midpoint))
  const firstAvg = firstHalf.reduce((s, d) => s + d.count, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((s, d) => s + d.count, 0) / secondHalf.length
  const velocityTrend = secondAvg > firstAvg + 0.2 ? 'an accelerating registration velocity' : secondAvg < firstAvg - 0.2 ? 'a decelerating registration velocity' : 'a relatively flat registration velocity'
  const zeroDaysLabel = zeroDays.length > 0 ? zeroDays.join(', ') : 'none'

  const prompt = `Analyse the registration timeline for ${event.title}.\n\nData:\n- Registration window: ${fmtLongDate(openDateIso)} to ${fmtLongDate(closeDateIso)}\n- Daily counts: ${JSON.stringify(dailyCounts)}\n- Peak day: ${peakDay.date} with ${peakDay.count} registrations (${peakPercent}% of total)\n- Days with zero registrations: ${zeroDaysLabel}\n\nWrite a 3-sentence analysis that:\n1. States when the peak occurred and what it suggests (e.g. a specific promotion, email send, or social post that day)\n2. Notes the registration velocity trend (did it accelerate or decelerate?)\n3. Gives one specific, actionable suggestion for the organiser's next event\n\nDo NOT use generic phrases like \"indicating a potential risk\" or \"suggesting effective marketing efforts\". Be specific and direct.`

  const aiText = await askAI({
    system: 'You are an event growth analyst writing concise operational performance analysis.',
    prompt,
    taskType: 'qa',
    maxTokens: 220,
  })

  if (aiText && aiText.trim()) {
    return aiText.replace(/\s+/g, ' ').trim()
  }

  return fallbackTimelineAnalysis(event, peakDay.date, peakDay.count, peakPercent, velocityTrend, zeroDaysLabel)
}

function buildCapacityChartConfig(confirmed: number, capacity: number): object {
  const safeConfirmed = Math.max(0, Math.min(confirmed, capacity))
  const fillRate = Math.round((safeConfirmed / capacity) * 100)
  return {
    type: 'bar',
    data: {
      labels: ['Capacity'],
      datasets: [
        {
          label: 'Confirmed',
          data: [safeConfirmed],
          backgroundColor: '#C8F55A',
        },
        {
          label: 'Available',
          data: [Math.max(0, capacity - safeConfirmed)],
          backgroundColor: '#EEEEEE',
        },
      ],
    },
    options: {
      indexAxis: 'y',
      plugins: {
        title: {
          display: true,
          text: `Capacity Utilisation - ${fillRate}% Filled`,
          font: { size: 13, weight: 'bold' },
          color: '#000',
        },
        legend: {
          position: 'bottom',
          labels: { color: '#333' },
        },
      },
      scales: {
        x: { stacked: true, max: capacity, ticks: { color: '#555', precision: 0 } },
        y: { stacked: true, display: false },
      },
    },
  }
}

function buildCapacityCommentary(confirmed: number, capacity: number): string {
  const safeConfirmed = Math.max(0, Math.min(confirmed, capacity))
  const fillRate = Math.round((safeConfirmed / capacity) * 100)

  if (fillRate >= 90) {
    return `The event filled to ${fillRate}% capacity with ${safeConfirmed} confirmed attendees. Consider increasing capacity or introducing a waitlist as a standard feature for future editions.`
  }

  if (fillRate >= 50) {
    return `The event achieved ${fillRate}% capacity utilisation (${safeConfirmed} of ${capacity} slots). This is a healthy attendance level. Adjusting the capacity to ${Math.ceil(safeConfirmed * 1.2)} for the next edition would create natural scarcity while still accommodating growth.`
  }

  return `The event filled ${fillRate}% of available capacity (${safeConfirmed} of ${capacity} slots). This suggests the capacity ceiling of ${capacity} was set above current demand. Setting capacity to ${Math.ceil(safeConfirmed * 1.3)} for the next edition creates healthy demand signals and can activate waitlist behaviour, which increases perceived value and urgency.`
}

async function buildCapacityUtilisationChart(
  confirmed: number,
  capacity: number | null,
): Promise<{ chartBuffer: Buffer | null; label: string; commentary: string }> {
  if (!capacity || capacity <= 0) {
    return {
      chartBuffer: null,
      label: 'Capacity not configured for this event.',
      commentary:
        'This event has no fixed capacity limit configured, so utilisation cannot be measured. Set a clear capacity for the next edition to track fill performance and trigger waitlist behaviour at peak demand.',
    }
  }

  const safeConfirmed = Math.max(0, Math.min(confirmed, capacity))
  const fillRate = Math.round((safeConfirmed / capacity) * 100)
  const label = `${safeConfirmed} of ${capacity} slots filled (${fillRate}%)`
  const config = buildCapacityChartConfig(safeConfirmed, capacity)
  const chartBuffer = await renderChartBuffer(config, 1200, 280)
  const commentary = buildCapacityCommentary(safeConfirmed, capacity)

  return { chartBuffer, label, commentary }
}

function capacityChartBlock(chartBuffer: Buffer | null): Paragraph[] {
  if (!chartBuffer) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Capacity Utilisation chart could not be rendered for this run.',
            font: 'Arial',
            size: 20,
            color: '777777',
          }),
        ],
      }),
    ]
  }

  return [
    new Paragraph({
      children: [
        new ImageRun({
          type: 'png',
          data: chartBuffer,
          transformation: { width: 980, height: 220 },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
  ]
}

// ── Summary Page ──────────────────────────────────────────────────────────────

async function summaryPage(
  event: IEvent,
  attendees: IRegistration[],
  dailyRegistrationCounts: Array<{ date: string; count: number }>,
  openDateIso: string,
  closeDateIso: string,
): Promise<(Paragraph | Table)[]> {
  const { chartBuffer, dailyCounts } = await buildRegistrationTimelineChart(
    attendees,
    dailyRegistrationCounts,
    openDateIso,
    closeDateIso,
  )
  const timelineAnalysis = await buildTimelineAnalysis(event, dailyCounts, openDateIso, closeDateIso)
  const {
    chartBuffer: capacityChart,
    label: capacityLabel,
    commentary: capacityCommentary,
  } = await buildCapacityUtilisationChart(event.confirmedCount, event.capacity)

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Event Snapshot', font: 'Arial', bold: true, size: 32 })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Core registration performance at a glance.',
          font: 'Arial',
          size: 20,
          color: '555555',
        }),
      ],
      spacing: { after: 120 },
    }),
    buildEventSnapshotRow(event),
    spacer(),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: 'Registration Timeline', font: 'Arial', bold: true, size: 28 })],
    }),
    ...timelineChartBlock(chartBuffer),
    new Paragraph({
      children: [new TextRun({ text: timelineAnalysis, font: 'Arial', size: 20 })],
      spacing: { after: 220 },
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: 'Capacity & Fill Rate', font: 'Arial', bold: true, size: 28 })],
    }),
    ...capacityChartBlock(capacityChart),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: capacityLabel, font: 'Arial', size: 20, bold: true, color: '333333' })],
      spacing: { after: 80 },
    }),
    ...(event.capacity && event.capacity > 0
      ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `${Math.max(0, Math.min(event.confirmedCount, event.capacity))} confirmed`,
                font: 'Arial',
                size: 18,
                color: '555555',
              }),
              new TextRun({ text: '\t' }),
              new TextRun({
                text: `${event.capacity} capacity`,
                font: 'Arial',
                size: 18,
                color: '555555',
              }),
            ],
            tabStops: [{ type: AlignmentType.RIGHT, position: CONTENT_WIDTH }],
            spacing: { after: 140 },
          }),
        ]
      : []),
    new Paragraph({
      children: [new TextRun({ text: capacityCommentary, font: 'Arial', size: 20 })],
      spacing: { after: 240 },
    }),
    new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }),
  ]
}

// ── Registration Table ────────────────────────────────────────────────────────

function confirmedAttendeesTable(event: IEvent, registrations: IRegistration[]): Table {
  const showPhone = shouldShowPhoneColumn(event, registrations)
  const numberColW = 520
  const nameColW = showPhone ? 1900 : 2300
  const regNoColW = showPhone ? 2100 : 2500
  const phoneColW = showPhone ? 1800 : 0
  const dateColW = TABLE_WIDTH - (numberColW + nameColW + regNoColW + phoneColW)
  const headerShading = { type: ShadingType.CLEAR, fill: '1F3864', color: 'auto' }

  const headerTitles = showPhone
    ? ['#', 'Name', 'Registration Number', 'Phone Number', 'Registration Day']
    : ['#', 'Name', 'Registration Number', 'Registration Day']
  const headerWidths = showPhone
    ? [numberColW, nameColW, regNoColW, phoneColW, dateColW]
    : [numberColW, nameColW, regNoColW, dateColW]

  const headerCells = headerTitles.map((title, i) =>
    new TableCell({
      width: { size: headerWidths[i], type: WidthType.DXA },
      margins: CELL_MARGINS,
      shading: headerShading,
      children: [
        new Paragraph({
          children: [new TextRun({ text: title, font: 'Arial', size: 20, bold: true, color: 'FFFFFF' })],
        }),
      ],
    })
  )

  const rows = registrations.map((reg, idx) => {
    const rowShading = idx % 2 === 1
      ? { type: ShadingType.CLEAR, fill: 'F5F5F5', color: 'auto' }
      : { type: ShadingType.CLEAR, fill: 'FFFFFF', color: 'auto' }

    const values = [
      String(idx + 1),
      getAttendeeName(reg, event),
      getRegistrationNumberDisplay(reg, event),
      ...(showPhone
        ? [normalizeText(getAttendeePhone(reg, event)) || 'Not provided']
        : []),
      fmtDay(reg.submittedAt),
    ]

    return new TableRow({
      children: values.map((value, i) =>
        new TableCell({
          width: { size: headerWidths[i], type: WidthType.DXA },
          margins: CELL_MARGINS,
          shading: rowShading,
          children: [
            new Paragraph({
              children: [new TextRun({ text: value || 'N/A', font: 'Arial', size: 20 })],
            }),
          ],
        })
      ),
    })
  })

  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: thinBorder(),
    columnWidths: headerWidths,
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...rows],
  })
}

function buildKdpaNotice(): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 80 },
    children: [
      new TextRun({
        text: 'Data Protection Notice: This attendee list contains personal data processed under the Kenya Data Protection Act (2019). This document is confidential. Do not share, copy, or distribute attendee personal data without a lawful basis.',
        size: 18,
        color: '888888',
        italics: true,
        font: 'Arial',
      }),
    ],
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'C8F55A', space: 200 } },
    indent: { left: 400 },
  })
}

// ── Confirmed Page ────────────────────────────────────────────────────────────

function confirmedPage(event: IEvent, confirmed: IRegistration[]): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({ text: 'Confirmed Attendees', font: 'Arial', bold: true, size: 32 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${confirmed.length} confirmed registration${confirmed.length !== 1 ? 's' : ''} as of ${todayStr()}`,
          font: 'Arial',
          size: 20,
          color: '555555',
        }),
      ],
      spacing: { after: 200 },
    }),
  ]

  if (confirmed.length === 0) {
    items.push(
      new Paragraph({
        children: [new TextRun({ text: 'No confirmed registrations.', font: 'Arial', size: 20, italics: true })],
      })
    )
  } else {
    items.push(confirmedAttendeesTable(event, confirmed))
  }

  items.push(buildKdpaNotice())

  items.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }))
  return items
}

// ── Waitlist Page ─────────────────────────────────────────────────────────────

function buildWaitlistCommentary(confirmedCount: number, capacity: number | null): string {
  if (!capacity || capacity <= 0) {
    return 'No waitlist was generated for this event. Because no fixed capacity was configured, overflow demand could not be measured as a formal waitlist signal. For future editions, set a clear capacity threshold to capture excess demand and create urgency through visible waitlist dynamics.'
  }

  const safeConfirmed = Math.max(0, Math.min(confirmedCount, capacity))
  const fillRate = Math.round((safeConfirmed / capacity) * 100)

  if (fillRate < 50) {
    return `No waitlist was generated for this event. With ${capacity - safeConfirmed} slots remaining unfilled, demand did not exceed capacity. For future editions, consider setting a lower initial capacity to create scarcity - this naturally builds a waitlist, which increases perceived demand and drives registrations.`
  }

  if (fillRate < 90) {
    return 'No waitlist was generated. The event is approaching healthy capacity. A waitlist typically activates when fill rate exceeds 85-90%. At current growth trajectory, the next edition may trigger waitlist behaviour naturally.'
  }

  return 'No waitlist was generated despite near-full capacity. Consider opening registration earlier for the next edition to capture overflow demand into a formal waitlist.'
}

function waitlistPage(event: IEvent, waitlist: IRegistration[]): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Waitlist', font: 'Arial', bold: true, size: 32 })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${waitlist.length} ${waitlist.length !== 1 ? 'people' : 'person'} on the waitlist`,
          font: 'Arial',
          size: 20,
          color: '555555',
        }),
      ],
      spacing: { after: 200 },
    }),
  ]

  if (waitlist.length === 0) {
    items.push(
      new Paragraph({
        children: [
          new TextRun({
            text: buildWaitlistCommentary(event.confirmedCount, event.capacity),
            font: 'Arial',
            size: 20,
            color: '555555',
          }),
        ],
      })
    )
  } else {
    items.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Current waitlist count: ${waitlist.length}`,
            font: 'Arial',
            size: 20,
          }),
        ],
      })
    )
  }

  items.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }))
  return items
}

function buildPostEventActions(data: EventReportData): ActionItem[] {
  const actions: ActionItem[] = []
  const capacity = Math.max(1, data.capacity)
  const fillRate = (data.confirmedCount / capacity) * 100
  const totalRegistrations = Math.max(1, data.totalRegistrations)
  const peakDayCount = data.peakDayCount

  actions.push({
    priority: 'HIGH',
    action: `Send post-event thank-you email to all ${data.confirmedCount} confirmed attendees within 48 hours`,
    owner: 'Organiser',
    timeframe: 'Within 2 days',
  })

  if (fillRate < 50) {
    actions.push({
      priority: 'HIGH',
      action: `Set capacity to ${Math.max(1, Math.ceil(data.confirmedCount * 1.3))} for the next edition to create healthy demand`,
      owner: 'Organiser',
      timeframe: 'Before publishing next event',
    })
  }

  if (fillRate > 80) {
    actions.push({
      priority: 'MEDIUM',
      action: `Plan next edition with capacity of ${Math.ceil(capacity * 1.5)} - current demand supports growth`,
      owner: 'Organiser',
      timeframe: 'Within 30 days',
    })
  }

  if (peakDayCount / totalRegistrations > 0.6) {
    actions.push({
      priority: 'MEDIUM',
      action: 'Schedule 2 reminder emails during the registration window to distribute sign-ups more evenly',
      owner: 'Organiser',
      timeframe: 'Implement for next event',
    })
  }

  if (data.waitlistCount === 0 && fillRate < 70) {
    actions.push({
      priority: 'LOW',
      action: `Consider reducing capacity to ${Math.max(1, Math.ceil(data.confirmedCount))} to naturally generate a waitlist and increase perceived demand`,
      owner: 'EventSlot platform',
      timeframe: 'Review before next event',
    })
  }

  if (!actions.some((item) => item.priority === 'LOW')) {
    actions.push({
      priority: 'LOW',
      action: 'Keep registration analytics and reminder automation active to maintain conversion consistency across editions',
      owner: 'EventSlot platform',
      timeframe: 'Ongoing',
    })
  }

  return actions
}

function priorityLabel(priority: ActionItem['priority']): string {
  if (priority === 'HIGH') return '🔴 High'
  if (priority === 'MEDIUM') return '🟡 Medium'
  return '🟢 Low'
}

function buildPostEventActionsSection(data: EventReportData): (Paragraph | Table)[] {
  const actions = buildPostEventActions(data)
  const widths = [1300, 4300, 1700, TABLE_WIDTH - (1300 + 4300 + 1700)]

  const table = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: thinBorder(),
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['Priority', 'Action', 'Owner', 'Timeframe'].map((title, index) =>
          new TableCell({
            width: { size: widths[index], type: WidthType.DXA },
            margins: CELL_MARGINS,
            shading: { type: ShadingType.CLEAR, fill: '0F0F0F', color: 'auto' },
            children: [
              new Paragraph({
                children: [new TextRun({ text: title, font: 'Arial', size: 20, bold: true, color: 'FFFFFF' })],
              }),
            ],
          }),
        ),
      }),
      ...actions.map((item, index) =>
        new TableRow({
          children: [priorityLabel(item.priority), item.action, item.owner, item.timeframe].map((value, colIndex) =>
            new TableCell({
              width: { size: widths[colIndex], type: WidthType.DXA },
              margins: CELL_MARGINS,
              shading:
                index % 2 === 1
                  ? { type: ShadingType.CLEAR, fill: 'F8F8F8', color: 'auto' }
                  : { type: ShadingType.CLEAR, fill: 'FFFFFF', color: 'auto' },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: value, font: 'Arial', size: 19, color: '1F1F1F' })],
                }),
              ],
            }),
          ),
        }),
      ),
    ],
  })

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Recommended Next Steps', font: 'Arial', bold: true, size: 32 })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Action plan generated from event performance to guide the next execution cycle.',
          font: 'Arial',
          size: 20,
          color: '555555',
        }),
      ],
      spacing: { after: 140 },
    }),
    table,
    new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }),
  ]
}

function buildEventScoreBreakdown(data: EventReportData): { table: Table; totalScore: number } {
  const capacity = Math.max(1, data.capacity)
  const fillRate = (data.confirmedCount / capacity) * 100
  const peakDayCount = data.peakDayCount
  const totalRegistrations = Math.max(1, data.totalRegistrations)
  const peakConcentration = (peakDayCount / totalRegistrations) * 100

  const setupScore =
    [data.eventDate, data.location, data.registrationDeadline].filter((value) => !!value && String(value).trim().length > 0).length >= 3
      ? 8
      : 6

  const categories: Array<{ name: string; score: number; benchmark: string; actual: string }> = [
    {
      name: 'Attendance Rate',
      score: fillRate >= 80 ? 10 : fillRate >= 60 ? 8 : fillRate >= 40 ? 6 : fillRate >= 20 ? 4 : 2,
      benchmark: '80%+ = 10, 60-79% = 8, 40-59% = 6, 20-39% = 4, <20% = 2',
      actual: `${Math.round(fillRate)}%`,
    },
    {
      name: 'Registration Distribution',
      score: peakConcentration < 50 ? 10 : peakConcentration < 70 ? 7 : 4,
      benchmark: 'Spread across days = 10, 1 day dominant = 4',
      actual: `${Math.round(peakConcentration)}% on peak day`,
    },
    {
      name: 'Waitlist Generation',
      score: data.waitlistCount > 0 ? 10 : fillRate > 70 ? 6 : 3,
      benchmark: 'Waitlist generated = 10, Near capacity = 6, Low fill = 3',
      actual: `${data.waitlistCount} on waitlist`,
    },
    {
      name: 'Setup Quality',
      score: setupScore,
      benchmark: 'All fields complete, clear description, appropriate capacity',
      actual: setupScore >= 8 ? 'Adequate' : 'Needs setup cleanup',
    },
  ]

  const totalScore = Math.round(categories.reduce((sum, category) => sum + category.score, 0) / categories.length)

  const widths = [1900, 900, 3600, TABLE_WIDTH - (1900 + 900 + 3600)]
  const table = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: thinBorder(),
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['Category', 'Score', 'Benchmark', 'Actual'].map((title, index) =>
          new TableCell({
            width: { size: widths[index], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: '0F0F0F', color: 'auto' },
            margins: CELL_MARGINS,
            children: [
              new Paragraph({
                children: [new TextRun({ text: title, font: 'Arial', size: 20, bold: true, color: 'FFFFFF' })],
              }),
            ],
          }),
        ),
      }),
      ...categories.map((category, rowIndex) =>
        new TableRow({
          children: [
            category.name,
            String(category.score),
            category.benchmark,
            category.actual,
          ].map((value, index) =>
            new TableCell({
              width: { size: widths[index], type: WidthType.DXA },
              shading:
                rowIndex % 2 === 1
                  ? { type: ShadingType.CLEAR, fill: 'F8F8F8', color: 'auto' }
                  : { type: ShadingType.CLEAR, fill: 'FFFFFF', color: 'auto' },
              margins: CELL_MARGINS,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: value, font: 'Arial', size: 19, color: '1F1F1F' })],
                }),
              ],
            }),
          ),
        }),
      ),
    ],
  })

  return { table, totalScore }
}

function aiInsightsPage(
  aiContent: AIReportContent,
  palette: { banner: string; accent: string; sub: string },
  data: EventReportData,
): (Paragraph | Table)[] {
  const sectionRows: Array<{ title: string; text: string }> = [
    { title: '1. Event Overview', text: aiContent.eventOverview },
    { title: '2. Executive Summary', text: aiContent.executiveSummary },
    { title: '3. Strengths', text: aiContent.strengths },
    { title: '4. Weaknesses & Risks', text: aiContent.weaknessesAndRisks },
    { title: '5. Audience Profile', text: aiContent.audienceProfile },
    { title: '6. Registration Behaviour', text: aiContent.registrationBehaviour },
    { title: '7. Competitive Positioning', text: aiContent.competitivePositioning },
    { title: '8. Waitlist Analysis', text: aiContent.waitlistAnalysis },
    { title: '9. Recommendations', text: aiContent.recommendations },
  ]

  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'AI Strategic Intelligence', font: 'Arial', bold: true, size: 32, color: palette.banner })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Professional strategic narrative generated from live event registration and waitlist data.',
          font: 'Arial',
          size: 20,
          color: '4A4A4A',
        }),
      ],
      spacing: { after: 220 },
    }),
  ]

  const { table: scoreTable, totalScore } = buildEventScoreBreakdown(data)

  for (const section of sectionRows) {
    const paragraphs = section.text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line, font: 'Arial', size: 20, color: '1F1F1F' })],
            spacing: { after: 120 },
          })
      )

    blocks.push(
      new Table({
        width: { size: TABLE_WIDTH, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 6, color: palette.sub },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DFDFDF' },
          left: { style: BorderStyle.SINGLE, size: 6, color: palette.sub },
          right: { style: BorderStyle.SINGLE, size: 2, color: 'DFDFDF' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: TABLE_WIDTH, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: '0F0F0F', color: 'auto' },
                margins: { top: 130, bottom: 130, left: 220, right: 220 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: section.title, font: 'Arial', size: 21, bold: true, color: palette.accent })],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: TABLE_WIDTH, type: WidthType.DXA },
                margins: { top: 140, bottom: 140, left: 220, right: 220 },
                children: paragraphs.length > 0
                  ? paragraphs
                  : [
                      new Paragraph({
                        children: [new TextRun({ text: 'No section content available.', font: 'Arial', size: 20, italics: true })],
                      }),
                    ],
              }),
            ],
          }),
        ],
      }),
      spacer()
    )
  }

  blocks.push(
    new Table({
      width: { size: TABLE_WIDTH, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: palette.sub },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: palette.sub },
        left: { style: BorderStyle.SINGLE, size: 8, color: palette.sub },
        right: { style: BorderStyle.SINGLE, size: 8, color: palette.sub },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: '0A0A0A', color: 'auto' },
              margins: { top: 180, bottom: 180, left: 220, right: 220 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: '10. Overall Score', font: 'Arial', size: 22, bold: true, color: palette.accent })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${totalScore}/10`, font: 'Arial', size: 30, bold: true, color: 'FFFFFF' })],
                  spacing: { before: 80 },
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    spacer(),
    scoreTable,
    spacer(),
    new Paragraph({
      children: [
        new TextRun({
          text: aiContent.overallScore,
          font: 'Arial',
          size: 20,
          color: '333333',
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true })
  )

  return blocks
}

function footerNotePage(): Paragraph[] {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: 'About This Report', font: 'Arial', bold: true, size: 28 })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `This report was automatically generated by EventSlot on ${todayStr()}.`,
          font: 'Arial',
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'It reflects registration data at the time of download.',
          font: 'Arial',
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'EventSlot — Smart Event Registration | eventslot.co',
          font: 'Arial',
          size: 20,
          color: '888888',
        }),
      ],
    }),
  ]
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateEventReport(data: EventReportData): Promise<Buffer> {
  const event: IEvent & { organizerName: string } = {
    title: data.title,
    slug: data.slug,
    organizerEmail: data.organizerEmail,
    organizerName: data.organizerName,
    confirmedCount: data.confirmedCount,
    waitlistCount: data.waitlistCount,
    capacity: data.capacity,
    eventDate: data.eventDate.toISOString(),
    location: data.location,
    deadline: data.registrationDeadline.toISOString(),
    createdAt: data.registrationOpenDate.toISOString(),
    questions: [
      { id: 'name', label: 'Full Name', type: 'text' },
      { id: 'phone', label: 'Phone Number', type: 'phone' },
      { id: 'registration-number', label: 'Registration Number', type: 'text' },
    ],
  }

  const confirmed: IRegistration[] = data.attendees.map((attendee, index) => ({
    id: `confirmed-${index + 1}`,
    answers: [
      { questionId: 'name', value: attendee.name },
      { questionId: 'phone', value: attendee.phone ?? '' },
      { questionId: 'registration-number', value: String(attendee.registrationNumber) },
    ],
    registrationNumber: attendee.registrationNumber,
    submittedAt: attendee.registeredAt.toISOString(),
  }))

  const waitlist: IRegistration[] = data.waitlist.map((item, index) => ({
    id: `waitlist-${index + 1}`,
    answers: [{ questionId: 'name', value: item.name }],
    registrationNumber: null,
    submittedAt: item.joinedAt.toISOString(),
    waitlistPosition: item.position,
  }))

  const aiContent = await generateAIReportContent({ event, confirmed, waitlist })
  const theme = data.theme ?? 'eventslot'
  const palette = THEMES[theme] ?? THEMES.eventslot
  const timelineAttendees = [...confirmed, ...waitlist]
  const summarySections = await summaryPage(
    event,
    timelineAttendees,
    data.dailyRegistrationCounts,
    data.registrationOpenDate.toISOString(),
    data.registrationDeadline.toISOString(),
  )
  const postEventActionsSections = buildPostEventActionsSection(data)
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 24 },
        },
        heading1: {
          run: { font: 'Arial', bold: true, size: 32 },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
        },
        heading2: {
          run: { font: 'Arial', bold: true, size: 28 },
          paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 },
        },
      },
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        headers: {
          first: new Header({ children: [new Paragraph({ text: '' })] }),
          default: makeHeader(event.title),
        },
        footers: { default: makeFooter(event.title) },
        children: [
          ...buildEventReportHeader(event),
          ...summarySections,
          ...aiInsightsPage(aiContent, palette, data),
          ...confirmedPage(event, confirmed),
          ...waitlistPage(event, waitlist),
          ...postEventActionsSections,
          ...footerNotePage(),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}
