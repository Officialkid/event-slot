import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import ExcelJS from 'exceljs'

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return String(value)
}

// ── Brand colours (ExcelJS ARGB = AARRGGBB) ─────────────────────────────────
const LIME_HEX    = 'FFC8F55A'
const DARK_HEX    = 'FF0A0A0A'
const GREEN_FILL  = 'FFDCFCE7'
const GREEN_FONT  = 'FF166534'
const AMBER_FILL  = 'FFFEF9C3'
const AMBER_FONT  = 'FF92400E'
const STRIPE_FILL = 'FFF5F5F5'

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> },
) {
  const { slug } = await props.params

  try {
    const token        = req.nextUrl.searchParams.get('token')
    const statusFilter = req.nextUrl.searchParams.get('status')

    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: { organizer: { select: { id: true, plan: true } } },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Auth: owner | valid dashboard token | team member | super admin
    const isOwner       = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const hasTeamAccess = !!(
      session?.user?.id &&
      (await hasTeamEventAccess({
        userId:      session.user.id,
        organizerId: event.organizerId,
        eventId:     event.id,
      }))
    )
    const adminAccess = !!(session && (await hasOrganiserAccess(session, event.id)))

    if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Status: 'confirmed' | 'waitlist' | null (all)
    const statusWhere: string | null =
      statusFilter === 'confirmed' ? 'confirmed' :
      statusFilter === 'waitlist'  ? 'waitlist'  :
      null

    const registrations = await prisma.registration.findMany({
      where:   { eventId: event.id, ...(statusWhere ? { status: statusWhere } : {}) },
      orderBy: { submittedAt: 'asc' },
      include: { ticket: { select: { code: true } } },
    })

    const questions = (
      event.questions as Array<{ id: string; label: string; type: string; order?: number }>
    ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const confirmedCount = registrations.filter(r => r.status === 'confirmed').length
    const waitlistCount  = registrations.filter(r => r.status === 'waitlist').length

    // ── Workbook ─────────────────────────────────────────────────────────────
    const workbook   = new ExcelJS.Workbook()
    workbook.creator = 'EventSlot'
    workbook.created = new Date()

    // ── Sheet 1: Registrations ────────────────────────────────────────────────
    const sheet = workbook.addWorksheet('Registrations', {
      views:      [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: LIME_HEX } },
    })

    sheet.columns = [
      { header: '#', key: 'num', width: 6 },
      ...questions.map(q => ({
        header: q.label,
        key:    `q_${q.id}`,
        width:  q.type === 'textarea' ? 50 : 28,
      })),
      { header: 'Status',            key: 'status', width: 14 },
      { header: 'Registration Date', key: 'date',   width: 20 },
      { header: 'Registration Time', key: 'time',   width: 16 },
      { header: 'Ticket Code',       key: 'ticket', width: 22 },
    ]

    // Style the frozen header row
    const headerRow = sheet.getRow(1)
    headerRow.height = 28
    headerRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_HEX } }
      cell.font      = { bold: true, color: { argb: LIME_HEX }, size: 10, name: 'Arial' }
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
      cell.border    = { bottom: { style: 'medium', color: { argb: LIME_HEX } } }
    })

    // Data rows
    registrations.forEach((reg, index) => {
      const rawAnswers = reg.answers as Array<{ questionId?: string; value?: unknown }>
      const answerMap  = new Map(
        (Array.isArray(rawAnswers) ? rawAnswers : [])
          .filter(a => a.questionId)
          .map(a => [a.questionId as string, cleanValue(a.value)]),
      )

      const rowData: Record<string, unknown> = {
        num:    reg.registrationNumber ?? index + 1,
        status: reg.status,
        date:   new Intl.DateTimeFormat('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  timeZone: 'Africa/Nairobi',
                }).format(reg.submittedAt),
        time:   new Intl.DateTimeFormat('en-GB', {
                  hour: '2-digit', minute: '2-digit', hour12: false,
                  timeZone: 'Africa/Nairobi',
                }).format(reg.submittedAt),
        ticket: reg.ticket?.code ?? '',
      }
      questions.forEach(q => { rowData[`q_${q.id}`] = answerMap.get(q.id) ?? '' })

      const dataRow  = sheet.addRow(rowData)
      const isStripe = index % 2 === 0

      dataRow.eachCell({ includeEmpty: true }, cell => {
        cell.font      = { name: 'Arial', size: 10, color: { argb: 'FF1A1A1A' } }
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
        if (isStripe) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_FILL } }
        }
      })

      // Colour-code status cell
      const statusCell  = dataRow.getCell('status')
      const isConfirmed = reg.status === 'confirmed'
      statusCell.fill   = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: isConfirmed ? GREEN_FILL : AMBER_FILL },
      }
      statusCell.font = {
        name: 'Arial', size: 10, bold: true,
        color: { argb: isConfirmed ? GREEN_FONT : AMBER_FONT },
      }

      // Approximate row height for long-form answers
      const maxLen      = Math.max(0, ...questions.map(q => (answerMap.get(q.id) ?? '').length))
      dataRow.height    = Math.min(100, Math.max(20, Math.ceil(maxLen / 60) * 14))
    })

    // ── Sheet 2: Summary ──────────────────────────────────────────────────────
    const summary = workbook.addWorksheet('Summary', {
      properties: { tabColor: { argb: 'FF27272A' } },
    })
    summary.columns = [
      { key: 'label', width: 30 },
      { key: 'value', width: 28 },
    ]

    // Title
    const titleRow = summary.addRow({ label: 'EventSlot — Registration Summary', value: '' })
    summary.mergeCells('A1:B1')
    titleRow.getCell('label').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIME_HEX } }
    titleRow.getCell('label').font = { bold: true, size: 13, name: 'Arial', color: { argb: DARK_HEX } }
    titleRow.height = 32

    const summaryRows: [string, string][] = [
      ['Event',               event.title],
      ['Event Date',          event.eventDate
                                ? new Intl.DateTimeFormat('en-GB', {
                                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                    timeZone: 'Africa/Nairobi',
                                  }).format(event.eventDate)
                                : 'TBC'],
      ['Location',            event.location ?? 'TBC'],
      ['Capacity',            event.capacity != null ? String(event.capacity) : 'Unlimited'],
      ['Total registrations', String(registrations.length)],
      ['Confirmed',           String(confirmedCount)],
      ['Waitlisted',          String(waitlistCount)],
      ['Export generated',    new Intl.DateTimeFormat('en-GB', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', hour12: false,
                                timeZone: 'Africa/Nairobi',
                              }).format(new Date())],
      ['Status filter',       statusWhere ?? 'All'],
      ['Exported by',         session?.user?.email ?? 'Token access'],
    ]

    summaryRows.forEach(([label, value], i) => {
      const row = summary.addRow({ label, value })
      row.getCell('label').font = { bold: true, name: 'Arial', size: 10, color: { argb: 'FF3F3F46' } }
      row.getCell('value').font = { name: 'Arial', size: 10, color: { argb: 'FF1A1A1A' } }
      if (i % 2 === 0) {
        row.getCell('label').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_FILL } }
        row.getCell('value').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_FILL } }
      }
    })

    // ── Serialise and return ──────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer()

    const safeTitle    = (event.title as string).replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const statusSuffix = statusWhere ? `_${statusWhere}` : '_all'
    const dateSuffix   = new Date().toISOString().slice(0, 10)
    const filename     = `eventslot_${safeTitle}${statusSuffix}_${dateSuffix}.xlsx`

    return new Response(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('Excel export error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
