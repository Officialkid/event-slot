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
} from 'docx'
import { format } from 'date-fns'

// ── Theme palette ─────────────────────────────────────────────────────────────

export type ReportTheme = 'navy' | 'forest' | 'wine' | 'graphite'

const THEMES: Record<ReportTheme, { banner: string; accent: string; sub: string }> = {
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

function todayStr(): string {
  return format(new Date(), 'dd MMM yyyy')
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
  return answerByQuestionId(reg, id) || 'N/A'
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
            text: 'EventSlot',
            font: 'Arial',
            size: 18,
            color: '888888',
          }),
          new TextRun({
            text: '\t' + eventTitle,
            font: 'Arial',
            size: 18,
            color: '888888',
          }),
        ],
        tabStops: [{ type: AlignmentType.RIGHT, position: CONTENT_WIDTH }],
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
        children: [
          new TextRun({
            text: `Confidential — ${eventTitle}`,
            font: 'Arial',
            size: 18,
            color: '888888',
          }),
          new TextRun({
            text: '\tPage ',
            font: 'Arial',
            size: 18,
            color: '888888',
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: 'Arial',
            size: 18,
            color: '888888',
          }),
        ],
        tabStops: [{ type: AlignmentType.RIGHT, position: CONTENT_WIDTH }],
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
        spacing: { before: 80 },
      }),
    ],
  })
}

// ── Cover Page ────────────────────────────────────────────────────────────────

function coverPage(event: IEvent, palette: { banner: string; accent: string; sub: string }): (Paragraph | Table)[] {
  const bannerFill = { type: ShadingType.CLEAR, fill: palette.banner, color: 'auto' }
  const dividerFill = { type: ShadingType.CLEAR, fill: palette.sub, color: 'auto' }

  const subtitleChildren: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'Event Report', font: 'Arial', size: 24, color: palette.sub })],
    }),
  ]

  // Full-width colored banner table (brand + title + subtitle)
  const bannerTable = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: noBorder(),
    rows: [
      // Brand row
      new TableRow({
        children: [
          new TableCell({
            width: { size: TABLE_WIDTH, type: WidthType.DXA },
            shading: bannerFill,
            borders: noBorder(),
            margins: { top: 520, bottom: 0, left: 560, right: 560 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'EventSlot', font: 'Arial', size: 18, color: palette.sub }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Event title row
      new TableRow({
        children: [
          new TableCell({
            width: { size: TABLE_WIDTH, type: WidthType.DXA },
            shading: bannerFill,
            borders: noBorder(),
            margins: { top: 180, bottom: 180, left: 560, right: 560 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: event.title, font: 'Arial', bold: true, size: 56, color: palette.accent }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Subtitle row
      new TableRow({
        children: [
          new TableCell({
            width: { size: TABLE_WIDTH, type: WidthType.DXA },
            shading: bannerFill,
            borders: noBorder(),
            margins: { top: 0, bottom: 520, left: 560, right: 560 },
            children: subtitleChildren,
          }),
        ],
      }),
      // Thin accent stripe
      new TableRow({
        children: [
          new TableCell({
            width: { size: TABLE_WIDTH, type: WidthType.DXA },
            shading: dividerFill,
            borders: noBorder(),
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
          }),
        ],
      }),
    ],
  })

  // Info table — labels in theme color, values in dark grey
  const infoRows: [string, string][] = [
    ['Organizer', event.organizerEmail],
    ['Date generated', todayStr()],
    ['Event date', fmt(event.eventDate)],
    ['Location', event.location ?? 'Not specified'],
    ['Registration deadline', fmt(event.deadline, 'No deadline')],
  ]

  const labelW = 2400
  const valueW = TABLE_WIDTH - labelW

  const infoTable = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: noBorder(),
    rows: infoRows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: labelW, type: WidthType.DXA },
            margins: { top: 120, bottom: 120, left: 0, right: 280 },
            borders: noBorder(),
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, font: 'Arial', size: 20, bold: true, color: palette.banner })],
              }),
            ],
          }),
          new TableCell({
            width: { size: valueW, type: WidthType.DXA },
            margins: { top: 120, bottom: 120, left: 280, right: 0 },
            borders: { ...noBorder(), left: { style: BorderStyle.SINGLE, size: 4, color: palette.sub } },
            children: [
              new Paragraph({
                children: [new TextRun({ text: value, font: 'Arial', size: 20, color: '111111' })],
              }),
            ],
          }),
        ],
      })
    ),
  })

  return [
    bannerTable,
    spacer(),
    spacer(),
    infoTable,
    new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }),
  ]
}

// ── Summary Page ──────────────────────────────────────────────────────────────

function summaryPage(event: IEvent): (Paragraph | Table)[] {
  const fillRate =
    event.capacity && event.capacity > 0
      ? `${Math.round((event.confirmedCount / event.capacity) * 100)}%`
      : 'N/A'

  const col1 = 3500
  const col2 = TABLE_WIDTH - col1

  const statsRows: [string, string][] = [
    ['Total registrations', String(event.confirmedCount + event.waitlistCount)],
    ['Confirmed attendees', String(event.confirmedCount)],
    ['Waitlist', String(event.waitlistCount)],
    ['Capacity', event.capacity ? String(event.capacity) : 'Unlimited'],
    ['Fill rate', fillRate],
  ]

  const statsTable = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: thinBorder(),
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: col1, type: WidthType.DXA },
            margins: CELL_MARGINS,
            shading: { type: ShadingType.CLEAR, fill: 'D5E8F0', color: 'auto' },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Metric', font: 'Arial', size: 20, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: col2, type: WidthType.DXA },
            margins: CELL_MARGINS,
            shading: { type: ShadingType.CLEAR, fill: 'D5E8F0', color: 'auto' },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Value', font: 'Arial', size: 20, bold: true })],
              }),
            ],
          }),
        ],
      }),
      ...statsRows.map(
        ([metric, value]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: col1, type: WidthType.DXA },
                margins: CELL_MARGINS,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: metric, font: 'Arial', size: 20 })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: col2, type: WidthType.DXA },
                margins: CELL_MARGINS,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: value, font: 'Arial', size: 20 })],
                  }),
                ],
              }),
            ],
          })
      ),
    ],
  })

  const createdFormatted = fmt(event.createdAt)
  const timelineSummary =
    `Registrations opened on ${createdFormatted}. ` +
    `${event.confirmedCount} attendee${event.confirmedCount !== 1 ? 's' : ''} confirmed their spot${event.confirmedCount !== 1 ? 's' : ''}. ` +
    `${event.waitlistCount} ${event.waitlistCount !== 1 ? 'people' : 'person'} joined the waitlist.`

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Event Summary', font: 'Arial', bold: true, size: 32 })],
    }),
    statsTable,
    spacer(),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: 'Registration Timeline', font: 'Arial', bold: true, size: 28 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: timelineSummary, font: 'Arial', size: 20 })],
      spacing: { after: 240 },
    }),
    new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }),
  ]
}

// ── Registration Table ────────────────────────────────────────────────────────

function confirmedAttendeesTable(event: IEvent, registrations: IRegistration[]): Table {
  const numberColW = 520
  const nameColW = 1900
  const regNoColW = 2100
  const phoneColW = 1800
  const dateColW = TABLE_WIDTH - (numberColW + nameColW + regNoColW + phoneColW)
  const headerShading = { type: ShadingType.CLEAR, fill: '1F3864', color: 'auto' }

  const headerTitles = ['#', 'Name', 'Registration Number', 'Phone Number', 'Registered At']
  const headerWidths = [numberColW, nameColW, regNoColW, phoneColW, dateColW]

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
      getAttendeePhone(reg, event),
      fmtDateTime(reg.submittedAt),
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

  items.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }))
  return items
}

// ── Waitlist Page ─────────────────────────────────────────────────────────────

function waitlistPage(waitlist: IRegistration[]): (Paragraph | Table)[] {
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
        children: [new TextRun({ text: 'Waitlist is empty.', font: 'Arial', size: 20, italics: true })],
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

export async function generateEventReport({
  event,
  confirmed,
  waitlist,
  theme = 'navy',
}: {
  event: IEvent
  confirmed: IRegistration[]
  waitlist: IRegistration[]
  theme?: ReportTheme
}): Promise<Buffer> {
  const palette = THEMES[theme] ?? THEMES.navy
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
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        headers: { default: makeHeader(event.title) },
        footers: { default: makeFooter(event.title) },
        children: [
          ...coverPage(event, palette),
          ...summaryPage(event),
          ...confirmedPage(event, confirmed),
          ...waitlistPage(waitlist),
          ...footerNotePage(),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}
