import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'

async function hasExportAccess(req: NextRequest, slug: string) {
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
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'This event does not use walk-in check-ins.' }, { status: 400 }) }
  }

  const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
  const hasValidToken = !!(token && event.dashboardToken === token)
  const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
    userId: session.user.id,
    organizerId: event.organizerId,
    eventId: event.id,
  }))
  const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

  if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }

  return { ok: true as const, event }
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const access = await hasExportAccess(req, params.slug)
    if (!access.ok) return access.response

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

    const header = ['Name', 'Phone', 'Day Date', 'Checked In At']
    const lines = [
      header.join(','),
      ...rows.map((row) => [
        escapeCsv(row.name),
        escapeCsv(row.phone),
        row.dayDate.toISOString().slice(0, 10),
        row.createdAt.toISOString(),
      ].join(',')),
    ]

    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="walk-in-checkins-${access.event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || access.event.id}.csv"`,
      },
    })
  } catch (error) {
    console.error('[WALK-IN EXPORT]', error)
    return NextResponse.json({ success: false, error: 'Unable to export walk-in check-ins.' }, { status: 500 })
  }
}
