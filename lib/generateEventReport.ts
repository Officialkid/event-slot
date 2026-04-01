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
  LevelFormat,
  PageNumber,
  Header,
  Footer,
} from 'docx'
import { format } from 'date-fns'

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

function coverPage(event: IEvent): (Paragraph | Table)[] {
  // Two-column info table rows
  const infoRows: [string, string][] = [
    ['Organizer:', event.organizerEmail],
    ['Date generated:', todayStr()],
    ['Event date:', fmt(event.eventDate)],
    ['Location:', event.location ?? 'Not specified'],
    ['Registration deadline:', fmt(event.deadline, 'No deadline')],
  ]

  const labelW = 2200
  const valueW = TABLE_WIDTH - labelW

  const infoTable = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: noBorder(),
    rows: infoRows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: labelW, type: WidthType.DXA },
              margins: CELL_MARGINS,
              borders: noBorder(),
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: label, font: 'Arial', size: 20, bold: true, color: '444444' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: valueW, type: WidthType.DXA },
              margins: CELL_MARGINS,
              borders: noBorder(),
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: value, font: 'Arial', size: 20, color: '222222' }),
                  ],
                }),
              ],
            }),
          ],
        })
    ),
  })

  return [
    // Branding line
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'EventSlot', font: 'Arial', size: 20, color: '888888' }),
      ],
      spacing: { before: 960, after: 0 },
    }),
    spacer(),
    // Event title
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: event.title, font: 'Arial', bold: true, size: 32, color: '000000' }),
      ],
    }),
    // Subtitle
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Event Report', font: 'Arial', size: 28, color: '666666' }),
      ],
      spacing: { after: 480 },
    }),
    spacer(),
    infoTable,
    // Page break
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

function registrationTable(
  questions: IQuestion[],
  registrations: IRegistration[],
  showPosition: boolean
): Table {
  const numberColW = 500
  const dateColW = 1500
  const questionColsTotal = TABLE_WIDTH - numberColW - dateColW
  const qCount = questions.length
  const questionColW = qCount > 0 ? Math.floor(questionColsTotal / qCount) : questionColsTotal

  // Recalculate to avoid rounding drift
  const lastQColW = questionColsTotal - questionColW * (qCount - 1)

  const headerShading = { type: ShadingType.CLEAR, fill: '1F3864', color: 'auto' }

  const headerCells: TableCell[] = [
    new TableCell({
      width: { size: numberColW, type: WidthType.DXA },
      margins: CELL_MARGINS,
      shading: headerShading,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: showPosition ? 'Position' : '#',
              font: 'Arial',
              size: 20,
              bold: true,
              color: 'FFFFFF',
            }),
          ],
        }),
      ],
    }),
    ...questions.map(
      (q, i) =>
        new TableCell({
          width: {
            size: i === questions.length - 1 ? lastQColW : questionColW,
            type: WidthType.DXA,
          },
          margins: CELL_MARGINS,
          shading: headerShading,
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: q.label, font: 'Arial', size: 20, bold: true, color: 'FFFFFF' }),
              ],
            }),
          ],
        })
    ),
    new TableCell({
      width: { size: dateColW, type: WidthType.DXA },
      margins: CELL_MARGINS,
      shading: headerShading,
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: 'Registered At', font: 'Arial', size: 20, bold: true, color: 'FFFFFF' }),
          ],
        }),
      ],
    }),
  ]

  const dataRows = registrations.map((reg, idx) => {
    const isEven = idx % 2 === 1
    const rowShading = isEven
      ? { type: ShadingType.CLEAR, fill: 'F5F5F5', color: 'auto' }
      : { type: ShadingType.CLEAR, fill: 'FFFFFF', color: 'auto' }

    const positionValue = showPosition
      ? String(reg.waitlistPosition ?? idx + 1)
      : String(idx + 1)

    return new TableRow({
      children: [
        new TableCell({
          width: { size: numberColW, type: WidthType.DXA },
          margins: CELL_MARGINS,
          shading: rowShading,
          children: [
            new Paragraph({
              children: [new TextRun({ text: positionValue, font: 'Arial', size: 20 })],
            }),
          ],
        }),
        ...questions.map(
          (q, i) =>
            new TableCell({
              width: {
                size: i === questions.length - 1 ? lastQColW : questionColW,
                type: WidthType.DXA,
              },
              margins: CELL_MARGINS,
              shading: rowShading,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: reg.answers.find(a => a.questionId === q.id)?.value ?? '',
                      font: 'Arial',
                      size: 20,
                    }),
                  ],
                }),
              ],
            })
        ),
        new TableCell({
          width: { size: dateColW, type: WidthType.DXA },
          margins: CELL_MARGINS,
          shading: rowShading,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: fmtDateTime(reg.submittedAt),
                  font: 'Arial',
                  size: 20,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  })

  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: thinBorder(),
    columnWidths: [
      numberColW,
      ...questions.map((_, i) => (i === questions.length - 1 ? lastQColW : questionColW)),
      dateColW,
    ],
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...dataRows],
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
    items.push(registrationTable(event.questions, confirmed, false))
  }

  items.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }))
  return items
}

// ── Waitlist Page ─────────────────────────────────────────────────────────────

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
        children: [new TextRun({ text: 'Waitlist is empty.', font: 'Arial', size: 20, italics: true })],
      })
    )
  } else {
    items.push(registrationTable(event.questions, waitlist, true))
  }

  items.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }))
  return items
}

// ── Footer Note Page ──────────────────────────────────────────────────────────

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
}: {
  event: IEvent
  confirmed: IRegistration[]
  waitlist: IRegistration[]
}): Promise<Buffer> {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '-',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
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
          ...coverPage(event),
          ...summaryPage(event),
          ...confirmedPage(event, confirmed),
          ...waitlistPage(event, waitlist),
          ...footerNotePage(),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}
