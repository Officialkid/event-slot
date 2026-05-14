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
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

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

    return new TableRow({
      children: rowValues.map(
        (value) =>
          new TableCell({
            width: { size: 100 / tableHeaders.length, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: value,
                    size: 22,
                    color: '111111',
                  }),
                ],
              }),
            ],
          }),
      ),
    })
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Confirmed Attendees', bold: true, size: 44 })],
            spacing: { after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${registrations.length} confirmed registrations as of ${formatRegistrationDay(new Date())}`,
                size: 26,
                color: '555555',
              }),
            ],
            spacing: { after: 260 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: tableHeaders.map(
                  (header) =>
                    new TableCell({
                      shading: { fill: '233E6D' },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.LEFT,
                          children: [new TextRun({ text: header, color: 'FFFFFF', bold: true, size: 22 })],
                        }),
                      ],
                    }),
                ),
              }),
              ...rows,
            ],
          }),
          new Paragraph({
            spacing: { before: 250 },
            border: {
              left: { style: BorderStyle.SINGLE, color: 'A3D65A', size: 6 },
            },
            children: [
              new TextRun({
                text: '  Data Protection Notice: This attendee list contains personal data processed under the Kenya Data Protection Act (2019). This document is confidential. Do not share, copy, or distribute attendee personal data without a lawful basis.',
                italics: true,
                color: '777777',
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Event: ${eventSlug}`, size: 16, color: '999999' })],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const format = req.nextUrl.searchParams.get('format') === 'word' ? 'word' : 'csv'

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

      return new Response(docBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="registrations-${slug}.docx"`,
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
