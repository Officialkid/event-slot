import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasFeatureAccess } from '@/lib/credits'
import { generateInsightCards } from '@/lib/generateInsightCards'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const force = req.nextUrl.searchParams.get('force') === 'true'
    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        organizer: { select: { id: true, plan: true, creditBalance: true } },
        insight: true,
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)

    if (!isOwner && !hasValidToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plan = event.organizer?.plan ?? 'free'
    const userId = session?.user?.id ?? event.organizerId
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required', upgradeRequired: true }, { status: 401 })
    }

    const access = await hasFeatureAccess({ userId, feature: 'ai_insights', eventId: event.id, plan })
    if (!access.hasAccess) {
      return NextResponse.json(
        { locked: true, upgradeRequired: true, creditsRequired: access.cost, eventId: event.id },
        { status: 403 }
      )
    }

    // Return cached insights if fresh and not forced
    if (!force && event.insight) {
      const age = Date.now() - new Date(event.insight.generatedAt).getTime()
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({
          cards: event.insight.cards,
          generatedAt: event.insight.generatedAt,
          cached: true,
        })
      }
    }

    // Fetch analytics data to power insights
    const [views, registrations] = await Promise.all([
      prisma.eventView.findMany({ where: { eventId: event.id }, select: { viewedAt: true } }),
      prisma.registration.findMany({
        where: { eventId: event.id },
        select: { submittedAt: true, status: true },
      }),
    ])

    const totalViews = views.length
    const totalRegistrations = registrations.length
    const confirmedCount = registrations.filter(r => r.status === 'confirmed').length
    const waitlistCount = registrations.filter(r => r.status === 'waitlist').length
    const conversionRate = totalViews > 0
      ? Math.round((totalRegistrations / totalViews) * 1000) / 10
      : 0
    const waitlistConversionRate = confirmedCount > 0 || waitlistCount > 0
      ? Math.round((confirmedCount / (confirmedCount + waitlistCount || 1)) * 1000) / 10
      : 0

    // Compute peakDay
    const dayMap = new Map<string, number>()
    for (const reg of registrations) {
      const key = reg.submittedAt.toISOString().slice(0, 10)
      dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
    }
    let peakDay: string | null = null
    let peakDayCount = 0
    dayMap.forEach((count, day) => {
      if (count > peakDayCount) { peakDayCount = count; peakDay = day }
    })

    // Compute peakHour
    const hourMap = new Map<number, number>()
    for (const reg of registrations) {
      const h = reg.submittedAt.getHours()
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1)
    }
    let peakHour: number | null = null
    let peakHourCount = 0
    hourMap.forEach((count, hour) => {
      if (count > peakHourCount) { peakHourCount = count; peakHour = hour }
    })

    const daysUntilEvent = event.eventDate
      ? Math.ceil((new Date(event.eventDate).getTime() - Date.now()) / 86400000)
      : null

    // Spend credits for free plan (before generation to avoid double-generation on failure)
    // NOTE: credits are already spent via /api/features/unlock — no charge needed here

    // Generate insight cards
    const cards = await generateInsightCards(
      {
        title: event.title,
        capacity: event.capacity,
        eventDate: event.eventDate?.toISOString() ?? null,
        location: event.location,
        daysUntilEvent,
      },
      {
        totalViews,
        totalRegistrations,
        conversionRate,
        confirmedCount,
        waitlistCount,
        waitlistConversionRate,
        peakDay,
        peakHour,
      }
    )

    // Upsert EventInsight record
    const saved = await prisma.eventInsight.upsert({
      where: { eventId: event.id },
      create: { eventId: event.id, cards: cards as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
      update: { cards: cards as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
    })

    return NextResponse.json({ cards: saved.cards, generatedAt: saved.generatedAt })
  } catch (err) {
    console.error('Insights error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
