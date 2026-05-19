import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { jsPDF } from 'jspdf'

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatRegistrationDay(iso: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  }).format(iso)
}

function formatRegistrationDateTime(iso: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Nairobi',
  }).format(iso)
}

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return String(value)
}

async function buildWordExport(params: {
  eventSlug: string
  questions: Array<{ id: string; label: string; type: string }>
  registrations: Array<{
    status: string
    submittedAt: Date
    registrationNumber: number | null
    answers: unknown
  }>
}): Promise<Buffer> {
  const { eventSlug, questions, registrations } = params

  const tableHeaders = ['#', ...questions.map((q) => q.label), 'Status', 'Registration Day']
  const firstColumnPct = 7
  const statusColumnPct = 14
  const dayColumnPct = 18
  const dynamicColumnCount = Math.max(1, tableHeaders.length - 3)
  const dynamicTotalPct = Math.max(1, 100 - firstColumnPct - statusColumnPct - dayColumnPct)
  const dynamicColumnPct = dynamicTotalPct / dynamicColumnCount
  const baseColumnPercentages = [
    firstColumnPct,
    ...new Array(dynamicColumnCount).fill(dynamicColumnPct),
    statusColumnPct,
    dayColumnPct,
  ]
  const columnPercentages = baseColumnPercentages.map((pct, idx) =>
    idx === baseColumnPercentages.length - 1
      ? 100 - baseColumnPercentages.slice(0, -1).reduce((sum, cur) => sum + cur, 0)
      : pct,
  )
  const toPctWidth = (percent: number) => Math.max(1, Math.round(percent * 50))

  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'E1E1E1' } as const
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const
  const cellMargins = { top: 110, bottom: 110, left: 120, right: 80 } as const

  const rows = registrations.map((reg, index) => {
    const answers = Array.isArray(reg.answers)
      ? (reg.answers as Array<{ questionId?: string; value?: unknown }>)
      : []
    const answerMap = new Map(
      answers
        .filter((a) => a.questionId)
        .map((a) => [a.questionId as string, cleanValue(a.value)]),
    )

    const rowValues = [
      String(reg.registrationNumber ?? index + 1),
      ...questions.map((q) => answerMap.get(q.id) ?? ''),
      reg.status,
      formatRegistrationDay(reg.submittedAt),
    ]

    const rowFill = index % 2 === 1 ? 'F5F5F5' : 'FFFFFF'

    return new TableRow({
      children: rowValues.map(
        (value, colIndex) =>
          new TableCell({
            width: { size: toPctWidth(columnPercentages[colIndex]), type: WidthType.PERCENTAGE },
            shading: { fill: rowFill, type: ShadingType.CLEAR },
            margins: cellMargins,
            borders: {
              top: cellBorder,
              bottom: cellBorder,
              left: noBorder,
              right: noBorder,
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: value,
                    font: 'Calibri',
                    size: 20,
                    color: '1A1A1A',
                  }),
                ],
              }),
            ],
          }),
      ),
    })
  })

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1008, bottom: 1080, left: 1008 },
          },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Confirmed Attendees', bold: true, size: 44, font: 'Calibri', color: '111111' })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${registrations.length} confirmed registration${registrations.length !== 1 ? 's' : ''} as of ${formatRegistrationDateTime(new Date())} (EAT)`,
                font: 'Calibri',
                size: 22,
                color: '555555',
              }),
            ],
            spacing: { after: 240 },
          }),
          new Table({
            width: { size: 5000, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
              insideHorizontal: cellBorder,
              insideVertical: noBorder,
            },
            rows: [
              new TableRow({
                tableHeader: true,
                children: tableHeaders.map(
                  (header, colIndex) =>
                    new TableCell({
                      width: { size: toPctWidth(columnPercentages[colIndex]), type: WidthType.PERCENTAGE },
                      shading: { fill: '233E6D', type: ShadingType.CLEAR },
                      margins: cellMargins,
                      borders: {
                        top: noBorder,
                        bottom: noBorder,
                        left: noBorder,
                        right: noBorder,
                      },
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: header, font: 'Calibri', color: 'FFFFFF', bold: true, size: 22 })],
                        }),
                      ],
                    }),
                ),
              }),
              ...rows,
            ],
          }),
          new Paragraph({
            spacing: { before: 280 },
            border: {
              left: { style: BorderStyle.SINGLE, color: 'A3D65A', size: 8 },
            },
            children: [
              new TextRun({
                text: '  Data Protection Notice: This attendee list contains personal data processed under the Kenya Data Protection Act (2019). This document is confidential. Do not share, copy, or distribute attendee personal data without a lawful basis.',
                italics: true,
                font: 'Calibri',
                color: '666666',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Event: ${eventSlug}`, font: 'Calibri', size: 18, color: '999999' })],
            spacing: { before: 180 },
          }),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}

function buildPdfExport(params: {
  eventSlug: string
  questions: Array<{ id: string; label: string; type: string }>
  registrations: Array<{
    status: string
    submittedAt: Date
    registrationNumber: number | null
    answers: unknown
  }>
}): Uint8Array {
  const { eventSlug, questions, registrations } = params

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 42
  const contentWidth = pageWidth - marginX * 2
  const lineHeight = 16
  const rowHeight = 22
  let y = 56

  const headers = ['#', ...questions.map((q) => q.label), 'Status', 'Registration Day']
  const firstCol = 42
  const statusCol = 84
  const dayCol = 104
  const dynamicColCount = Math.max(1, headers.length - 3)
  const dynamicColWidth = Math.floor((contentWidth - firstCol - statusCol - dayCol) / dynamicColCount)
  const widths = [
    firstCol,
    ...new Array(dynamicColCount).fill(dynamicColWidth),
    statusCol,
    contentWidth - (firstCol + dynamicColCount * dynamicColWidth + statusCol),
  ]

  const drawWrappedCell = (text: string, x: number, topY: number, width: number, maxLines = 2) => {
    const lines = doc.splitTextToSize(text || '', width - 6).slice(0, maxLines)
    lines.forEach((line: string, i: number) => {
      doc.text(line, x + 3, topY + 14 + i * 9)
    })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Confirmed Attendees', marginX, y)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  doc.text(
    `${registrations.length} confirmed registrations as of ${formatRegistrationDateTime(new Date())} (EAT)`,
    marginX,
    y,
  )
  y += 22

  doc.setDrawColor(35, 62, 109)
  doc.setFillColor(35, 62, 109)
  doc.rect(marginX, y, contentWidth, rowHeight, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)

  let x = marginX
  headers.forEach((h, idx) => {
    drawWrappedCell(h, x, y, widths[idx])
    x += widths[idx]
  })
  y += rowHeight

  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'normal')

  for (let i = 0; i < registrations.length; i += 1) {
    if (y + rowHeight > pageHeight - 90) {
      doc.addPage()
      y = 56
      doc.setDrawColor(35, 62, 109)
      doc.setFillColor(35, 62, 109)
      doc.rect(marginX, y, contentWidth, rowHeight, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      x = marginX
      headers.forEach((h, idx) => {
        drawWrappedCell(h, x, y, widths[idx])
        x += widths[idx]
      })
      y += rowHeight
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'normal')
    }

    const reg = registrations[i]
    const answers = Array.isArray(reg.answers)
      ? (reg.answers as Array<{ questionId?: string; value?: unknown }>)
      : []
    const answerMap = new Map(
      answers
        .filter((a) => a.questionId)
        .map((a) => [a.questionId as string, cleanValue(a.value)]),
    )

    const rowValues = [
      String(reg.registrationNumber ?? i + 1),
      ...questions.map((q) => answerMap.get(q.id) ?? ''),
      reg.status,
      formatRegistrationDay(reg.submittedAt),
    ]

    doc.setDrawColor(225, 225, 225)
    doc.rect(marginX, y, contentWidth, rowHeight)
    x = marginX
    rowValues.forEach((cell, idx) => {
      drawWrappedCell(cell, x, y, widths[idx])
      x += widths[idx]
    })
    y += rowHeight
  }

  if (y + 64 > pageHeight) {
    doc.addPage()
    y = 56
  }

  y += 20
  doc.setDrawColor(163, 214, 90)
  doc.line(marginX, y - 12, marginX, y + 24)
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  const noticeLines = doc.splitTextToSize(
    'Data Protection Notice: This attendee list contains personal data processed under the Kenya Data Protection Act (2019). This document is confidential. Do not share, copy, or distribute attendee personal data without a lawful basis.',
    contentWidth - 14,
  )
  doc.text(noticeLines, marginX + 10, y)

  y += noticeLines.length * lineHeight
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.text(`Event: ${eventSlug}`, marginX, y + 12)

  return new Uint8Array(doc.output('arraybuffer'))
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const formatParam = req.nextUrl.searchParams.get('format')
    const format: 'csv' | 'word' | 'pdf' = formatParam === 'word' ? 'word' : formatParam === 'pdf' ? 'pdf' : 'csv'

    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        organizer: { select: { id: true, plan: true } },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Validate access: session owner or valid dashboard token
    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))

    if (!isOwner && !hasValidToken && !hasTeamAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch confirmed registrations
    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id, status: 'confirmed' },
      orderBy: { submittedAt: 'asc' },
    })

    const questions = event.questions as Array<{ id: string; label: string; type: string }>

    if (format === 'word') {
      const docBuffer = await buildWordExport({
        eventSlug: slug,
        questions,
        registrations,
      })
      const docBytes = new Uint8Array(docBuffer)

      return new Response(docBytes, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="registrations-${slug}.docx"`,
        },
      })
    }

    if (format === 'pdf') {
      const pdfBytes = buildPdfExport({
        eventSlug: slug,
        questions,
        registrations,
      })

      return new Response(pdfBytes.buffer as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="registrations-${slug}.pdf"`,
        },
      })
    }

    const headerRow = [
      ...questions.map(q => escapeCSV(q.label)),
      'Status',
      'Registered At',
    ].join(',')

    const dataRows = registrations.map(reg => {
      const answers = reg.answers as Array<{ questionId: string; value: string }>
      const cols = questions.map(q => {
        const val = answers.find(a => a.questionId === q.id)?.value ?? ''
        return escapeCSV(val)
      })
      cols.push(escapeCSV(reg.status))
      cols.push(escapeCSV(reg.submittedAt.toISOString()))
      return cols.join(',')
    })

    const csvString = [headerRow, ...dataRows].join('\n')

    return new Response('\uFEFF' + csvString, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="registrations-${slug}.csv"`,
      },
    })
  } catch (err) {
    console.error('Registration export error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
