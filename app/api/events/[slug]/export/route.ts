import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { CREDIT_COSTS, hasFeatureAccess } from '@/lib/credits'

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')

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

    if (!isOwner && !hasValidToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plan = event.organizer?.plan ?? 'free'
    const userId = session?.user?.id ?? event.organizerId
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const canAccess = await hasFeatureAccess({ userId, feature: 'export_csv', eventId: event.id, plan })
    if (!canAccess) {
      return NextResponse.json(
        { error: 'CSV export requires a Pro/Business plan or a one-time credit unlock.', upgradeRequired: true, creditsRequired: CREDIT_COSTS.export_csv, eventId: event.id },
        { status: 403 }
      )
    }

    // Fetch confirmed registrations
    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id, status: 'confirmed' },
      orderBy: { submittedAt: 'asc' },
    })

    const questions = event.questions as Array<{ id: string; label: string; type: string }>

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
    console.error('CSV export error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
