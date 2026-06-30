import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import ExcelJS from 'exceljs'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { canUseEventFeature } from '@/lib/planEnforcement'

function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'walk-in-event'
}

function formatNairobiDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

async function buildAccess(req: NextRequest, slug: string) {
  const token = req.nextUrl.searchParams.get('token')
  const session = await getServerSession(authOptions)

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      organizerId: true,
      dashboardToken: true,
      accessType: true,
    },
  })

  if (!event) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 }) }
  }

  if (event.accessType !== 'WALK_IN') {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'This event does not use walk-in check-ins.' }, { status: 400 }),
    }
  }

  const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
  const hasValidToken = !!(token && event.dashboardToken === token)

  if (!isOwner && !hasValidToken) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }

  const exportAccess = await canUseEventFeature(
    session?.user?.id ?? '',
    session?.user?.email ?? '',
    event.id,
    'hasBasicAnalytics'
  )
  if (!exportAccess.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          code: 'UPGRADE_REQUIRED',
          error: exportAccess.reason,
          upgradeRequired: exportAccess.upgradeRequired,
        },
        { status: 403 },
      ),
    }
  }

  return { ok: true as const, event }
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params

  try {
    const access = await buildAccess(req, slug)
    if (!access.ok) return access.response

    const format = req.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'
    const rows = await prisma.walkInCheckin.findMany({
      where: { eventId: access.event.id },
      orderBy: [{ dayDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        name: true,
        phone: true,
        dayDate: true,
        createdAt: true,
      },
    })

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'EventSlot'
      workbook.created = new Date()

      const sheet = workbook.addWorksheet('Walk-In Check-ins', {
        views: [{ state: 'frozen', ySplit: 1 }],
      })

      sheet.columns = [
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Phone', key: 'phone', width: 20 },
        { header: 'Day Attended', key: 'dayDate', width: 16 },
        { header: 'Check-in Time', key: 'createdAt', width: 24 },
      ]

      const headerRow = sheet.getRow(1)
      headerRow.eachCell((cell) => {
        cell.font = { bold: true }
      })

      rows.forEach((row) => {
        sheet.addRow({
          name: row.name,
          phone: row.phone,
          dayDate: row.dayDate.toISOString().slice(0, 10),
          createdAt: formatNairobiDateTime(row.createdAt),
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="walkin-${safeFileName(access.event.title)}.xlsx"`,
        },
      })
    }

    const csv = [
      ['Name', 'Phone', 'Day Attended', 'Check-in Time'].map(csvCell).join(','),
      ...rows.map((row) => [
        row.name,
        row.phone,
        row.dayDate.toISOString().slice(0, 10),
        formatNairobiDateTime(row.createdAt),
      ].map(csvCell).join(',')),
    ].join('\r\n')

    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="walkin-${safeFileName(access.event.title)}.csv"`,
      },
    })
  } catch (error) {
    console.error('[WALKIN EXPORT]', error)
    return NextResponse.json({ success: false, error: 'Unable to export walk-in check-ins.' }, { status: 500 })
  }
}
