import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: { organizer: { select: { plan: true } } },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)

    if (!isOwner && !hasValidToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch views and registrations
    const [views, registrations] = await Promise.all([
      prisma.eventView.findMany({ where: { eventId: event.id }, select: { viewedAt: true } }),
      prisma.registration.findMany({
        where: { eventId: event.id },
        select: { submittedAt: true, status: true },
      }),
    ])

    const totalViews = views.length
    const totalRegistrations = registrations.length
    const confirmedCount = registrations.filter((r: { status: string }) => r.status === 'confirmed').length
    const waitlistCount = registrations.filter((r: { status: string }) => r.status === 'waitlist').length
    const conversionRate = totalViews > 0
      ? Math.round((totalRegistrations / totalViews) * 1000) / 10
      : 0
    const waitlistConversionRate = confirmedCount > 0 && waitlistCount > 0
      ? Math.round((confirmedCount / (confirmedCount + waitlistCount)) * 1000) / 10
      : confirmedCount > 0 ? 100 : 0

    // Registrations by day (last 30 days)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const dayMap = new Map<string, number>()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dayMap.set(key, 0)
    }
    for (const reg of registrations) {
      if (reg.submittedAt >= thirtyDaysAgo) {
        const key = reg.submittedAt.toISOString().slice(0, 10)
        if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
      }
    }
    const registrationsByDay = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }))

    // Registrations by hour (0–23)
    const hourMap = new Map<number, number>()
    for (let h = 0; h < 24; h++) hourMap.set(h, 0)
    for (const reg of registrations) {
      const h = reg.submittedAt.getHours()
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1)
    }
    const registrationsByHour = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count }))

    return NextResponse.json({
      totalViews,
      totalRegistrations,
      conversionRate,
      confirmedCount,
      waitlistCount,
      waitlistConversionRate,
      registrationsByDay,
      registrationsByHour,
    })
  } catch (err) {
    console.error('Analytics error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
