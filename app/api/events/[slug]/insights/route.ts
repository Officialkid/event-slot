import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateInsightCards } from '@/lib/generateInsightCards'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { getAIProviderStatus } from '@/lib/ai'
import { aiRatelimit } from '@/lib/ratelimit'
import { getCountryFlag, getCountryName } from '@/lib/geoip'
import { spendCredits, CREDIT_COSTS } from '@/lib/credits'
import { isSuperAdmin } from '@/lib/tokens'
import { canGenerateAiInsight } from '@/lib/planEnforcement'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const force = req.nextUrl.searchParams.get('force') === 'true'
    const session = await getServerSession(authOptions)

    const rateLimitKey = session?.user?.id ?? (req.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const { success: rlOk } = await aiRatelimit.limit(`insights:${rateLimitKey}`)
    if (!rlOk) {
      return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
    }

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
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))
    const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

    if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return cached insights if fresh and not forced
    if (!force && event.insight) {
      const age = Date.now() - new Date(event.insight.generatedAt).getTime()
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({
          cards: event.insight.cards,
          generatedAt: event.insight.generatedAt,
          cached: true,
          aiInsightsFreeUsed: event.aiInsightsFreeUsed,
        })
      }

      // Avoid hidden credit charges on passive page loads.
      // Non-forced loads return last generated insights even when stale.
      return NextResponse.json({
        cards: event.insight.cards,
        generatedAt: event.insight.generatedAt,
        cached: true,
        stale: true,
        aiInsightsFreeUsed: event.aiInsightsFreeUsed,
      })
    }

    // Plan enforcement — check AI insight quota before generating fresh insights
    if (session?.user?.id) {
      const insightCheck = await canGenerateAiInsight(session.user.id, session.user.email ?? '')
      if (!insightCheck.allowed) {
        return NextResponse.json(
          { error: insightCheck.reason, upgradeRequired: insightCheck.upgradeRequired, code: 'PLAN_LIMIT_AI' },
          { status: 403 }
        )
      }
    }

    // Fetch analytics data to power insights
    const [views, registrations, attendeeCountries] = await Promise.all([
      prisma.eventView.findMany({ where: { eventId: event.id }, select: { viewedAt: true } }),
      prisma.registration.findMany({
        where: { eventId: event.id },
        select: { submittedAt: true, status: true },
      }),
      prisma.registration.groupBy({
        by: ['countryCode'],
        _count: { id: true },
        where: { eventId: event.id, countryCode: { not: null } },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
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

    // Free-first + paid regeneration model.
    // First generated insight set is free per event; subsequent forced regenerations are paid.
    let aiInsightsFreeUsed = event.aiInsightsFreeUsed
    const userEmail = session?.user?.email ?? null
    const isPrivileged = isSuperAdmin(userEmail)

    if (!isPrivileged) {
      if (!aiInsightsFreeUsed) {
        await prisma.event.update({
          where: { id: event.id },
          data: { aiInsightsFreeUsed: true },
        })
        aiInsightsFreeUsed = true
      } else if (force) {
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const spend = await spendCredits({
          userId: session.user.id,
          amount: CREDIT_COSTS.ai_insights,
          description: 'AI event insights regeneration',
          eventId: event.id,
        })
        if (!spend.success) {
          return NextResponse.json(
            {
              error: spend.error || 'Insufficient credits',
              insufficientCredits: true,
              creditsNeeded: CREDIT_COSTS.ai_insights,
            },
            { status: 402 }
          )
        }
      }
    }

    // Build geo context for AI prompt
    const geoContext = attendeeCountries.length > 0
      ? `ATTENDEE GEOGRAPHY:\n${attendeeCountries.map(c =>
          `  ${getCountryFlag(c.countryCode ?? '')} ${getCountryName(c.countryCode ?? '')} — ${c._count.id} attendees`
        ).join('\n')}`
      : undefined

    // Generate insight cards
    const generated = await generateInsightCards(
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
      },
      geoContext
    )

    if (!generated.cards.length) {
      return NextResponse.json(
        {
          error: 'Unable to generate insight cards right now.',
          providerStatus: getAIProviderStatus(),
          retryable: true,
        },
        { status: 503 }
      )
    }

    if (generated.source === 'fallback') {
      return NextResponse.json({
        cards: generated.cards,
        generatedAt: new Date().toISOString(),
        source: generated.source,
        message: generated.message,
        provider: generated.provider,
        providerStatus: generated.providerStatus,
        retryRecommended: generated.retryRecommended,
        aiInsightsFreeUsed,
      })
    }

    // Upsert EventInsight record only for AI-generated cards.
    const saved = await prisma.eventInsight.upsert({
      where: { eventId: event.id },
      create: { eventId: event.id, cards: generated.cards as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
      update: { cards: generated.cards as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
    })

    return NextResponse.json({
      cards: saved.cards,
      generatedAt: saved.generatedAt,
      source: generated.source,
      provider: generated.provider,
      providerStatus: generated.providerStatus,
      aiInsightsFreeUsed,
    })
  } catch (err) {
    console.error('Insights error:', err)
    return NextResponse.json(
      {
        error: 'AI insights are temporarily unavailable. Please retry in a moment.',
        retryable: true,
        providerStatus: getAIProviderStatus(),
      },
      { status: 503 }
    )
  }
}
