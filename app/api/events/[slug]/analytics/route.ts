import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { formatWalkInDayLabel, getWalkInDayKey } from '@/lib/walkInEvents'

const CONFIRMED_STATUSES = ['confirmed', 'CONFIRMED'] as const
const WAITLIST_STATUSES = ['waitlist', 'WAITLISTED', 'waitlisted'] as const

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
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))
    const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

    if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (event.accessType === 'WALK_IN') {
      const [totalViews, allCheckins, groupedByDay] = await Promise.all([
        prisma.eventView.count({ where: { eventId: event.id } }),
        prisma.walkInCheckin.findMany({
          where: { eventId: event.id },
          select: { createdAt: true, dayDate: true },
        }),
        prisma.walkInCheckin.groupBy({
          by: ['dayDate'],
          where: { eventId: event.id },
          _count: { _all: true },
          orderBy: { dayDate: 'asc' },
        }),
      ])

      const totalCheckins = allCheckins.length
      const todayKey = getWalkInDayKey(new Date(), 'Africa/Nairobi')
      const todayCount = groupedByDay.find((entry) => getWalkInDayKey(entry.dayDate, 'Africa/Nairobi') === todayKey)?._count._all ?? 0
      const conversionRate = totalViews > 0
        ? Math.round((totalCheckins / totalViews) * 1000) / 10
        : 0

      const registrationsByDay = groupedByDay.map((entry) => {
        const dayKey = getWalkInDayKey(entry.dayDate, 'Africa/Nairobi')
        return { date: dayKey, count: entry._count._all, label: formatWalkInDayLabel(dayKey, 'Africa/Nairobi') }
      })

      const hourMap = new Map<number, number>()
      for (let hour = 0; hour < 24; hour++) hourMap.set(hour, 0)
      for (const checkin of allCheckins) {
        const hour = checkin.createdAt.getHours()
        hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1)
      }
      const registrationsByHour = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count }))

      return NextResponse.json({
        mode: 'walk_in',
        totalViews,
        totalRegistrations: totalCheckins,
        conversionRate,
        confirmedCount: totalCheckins,
        checkedInCount: totalCheckins,
        checkInRate: totalCheckins > 0 ? 100 : 0,
        waitlistCount: 0,
        waitlistedCount: 0,
        promotedCount: 0,
        stillWaitingCount: 0,
        waitlistConversionRate: 0,
        sourceBreakdown: [{ source: 'walk_in', count: totalCheckins }],
        feedbackScore: null,
        feedbackCount: 0,
        vsAverage: null,
        avgRegistrations: null,
        aiInsightsFreeUsed: event.aiInsightsFreeUsed,
        event: { capacity: null },
        registrationsByDay,
        registrationsByHour,
        walkInTodayCount: todayCount,
        walkInActiveDays: groupedByDay.length,
      })
    }

    // Keep the dashboard analytics query lightweight enough to resolve quickly on live pages.
    const [totalViews, registrations, confirmedCount, scannedTickets, waitlistedCount, promotionLogs, sourceBreakdown, feedbackAggregate] = await Promise.all([
      prisma.eventView.count({ where: { eventId: event.id } }),
      prisma.registration.findMany({
        where: { eventId: event.id },
        select: { submittedAt: true, source: true },
      }),
      prisma.registration.count({
        where: {
          eventId: event.id,
          status: { in: CONFIRMED_STATUSES as unknown as string[] },
        },
      }),
      prisma.ticket.findMany({
        where: {
          registration: { eventId: event.id },
          scannedAt: { not: null },
        },
        select: {
          id: true,
          scannedAt: true,
        },
      }),
      prisma.registration.count({
        where: {
          eventId: event.id,
          status: { in: WAITLIST_STATUSES as unknown as string[] },
        },
      }),
      prisma.errorLog.findMany({
        where: { route: `waitlist-promotion-email:${event.id}` },
        select: { message: true },
      }),
      prisma.registration.groupBy({
        by: ['source'],
        where: { eventId: event.id },
        _count: { id: true },
      }),
      prisma.attendeeFeedback.aggregate({
        where: { eventId: event.id },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ])

    const [payments, ticketTiers] = event.isPaid
      ? await Promise.all([
          prisma.payment.findMany({
            where: { eventId: event.id },
            select: {
              amount: true,
              commissionAmount: true,
              organizerAmount: true,
              status: true,
              ticketTierId: true,
            },
          }),
          prisma.ticketTier.findMany({
            where: { eventId: event.id },
            select: {
              id: true,
              name: true,
              priceKes: true,
              soldCount: true,
              waitlistCount: true,
              bundleSize: true,
            },
            orderBy: { sortOrder: 'asc' },
          }),
        ])
      : [[], []]

    const checkedInCount = Array.isArray(scannedTickets) ? scannedTickets.length : 0
    const totalRegistrations = registrations.length
    const waitlistCount = waitlistedCount
    const stillWaitingCount = waitlistedCount
    const promotedCount = promotionLogs.reduce((acc, log) => {
      try {
        const parsed = JSON.parse(log.message) as { promoted?: number }
        return acc + (typeof parsed.promoted === 'number' ? parsed.promoted : 0)
      } catch {
        return acc
      }
    }, 0)
    const checkInRate = confirmedCount > 0
      ? Math.round((checkedInCount / confirmedCount) * 100)
      : 0
    const conversionRate = totalViews > 0
      ? Math.round((totalRegistrations / totalViews) * 1000) / 10
      : 0
    const waitlistConversionRate = confirmedCount > 0 && waitlistCount > 0
      ? Math.round((confirmedCount / (confirmedCount + waitlistCount)) * 1000) / 10
      : confirmedCount > 0 ? 100 : 0
    const feedbackCount = feedbackAggregate._count.id
    const avgFeedbackScore = typeof feedbackAggregate._avg.rating === 'number'
      ? Math.round(feedbackAggregate._avg.rating * 10) / 10
      : null
    const successfulPayments = payments.filter((payment) => payment.status === 'SUCCESS')
    const pendingPayments = payments.filter((payment) => payment.status === 'PENDING')
    const paidRevenueKes = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0)
    const paidCommissionKes = successfulPayments.reduce((sum, payment) => sum + payment.commissionAmount, 0)
    const paidNetKes = successfulPayments.reduce((sum, payment) => sum + payment.organizerAmount, 0)
    const paidTicketsSold = ticketTiers.reduce((sum, tier) => sum + tier.soldCount, 0)
    const paidAdmissionsIssued = ticketTiers.reduce((sum, tier) => sum + (tier.soldCount * Math.max(1, tier.bundleSize)), 0)
    const tierBreakdown = ticketTiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      priceKes: tier.priceKes,
      soldCount: tier.soldCount,
      waitlistCount: tier.waitlistCount,
      bundleSize: tier.bundleSize,
      grossKes: tier.soldCount * tier.priceKes,
      admissionsIssued: tier.soldCount * Math.max(1, tier.bundleSize),
    }))

    // --- 1. Event Intelligence: No-Show & Attendance Matrix ---
    const noShowCount = Math.max(0, confirmedCount - checkedInCount)
    const noShowRate = confirmedCount > 0 ? Math.round((noShowCount / confirmedCount) * 100) : 0
    const attendanceRate = checkInRate

    // --- 2. Event Intelligence: Peak Arrival Velocity & Gate Flow ---
    let peakArrivalWindow: string | null = null
    let peakVelocityCount = 0
    let recommendedScanners = 1
    const gateArrivalSlots: Array<{ timeLabel: string; count: number }> = []

    if (Array.isArray(scannedTickets) && scannedTickets.length > 0) {
      const slotMap = new Map<string, number>()
      for (const t of scannedTickets) {
        if (!t.scannedAt) continue
        const d = new Date(t.scannedAt)
        const hour = d.getHours()
        const minBucket = Math.floor(d.getMinutes() / 15) * 15
        const startStr = `${hour.toString().padStart(2, '0')}:${minBucket.toString().padStart(2, '0')}`
        const endMin = (minBucket + 15) % 60
        const endHour = minBucket + 15 >= 60 ? (hour + 1) % 24 : hour
        const endStr = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`
        const slotKey = `${startStr} - ${endStr}`
        slotMap.set(slotKey, (slotMap.get(slotKey) ?? 0) + 1)
      }

      let maxSlot = ''
      let maxCount = 0
      for (const [slot, count] of slotMap.entries()) {
        gateArrivalSlots.push({ timeLabel: slot, count })
        if (count > maxCount) {
          maxCount = count
          maxSlot = slot
        }
      }
      peakArrivalWindow = maxSlot || null
      peakVelocityCount = maxCount
      recommendedScanners = Math.max(1, Math.ceil(maxCount / 45))
    }

    // --- 3. Event Intelligence: Cross-Event Loyalty & Retention ---
    let returningAttendeesCount = 0
    let firstTimeAttendeesCount = totalRegistrations
    let returningRate = 0
    let vipLoyalCount = 0

    if (event.organizerId) {
      const pastEvents = await prisma.event.findMany({
        where: { organizerId: event.organizerId, id: { not: event.id } },
        select: {
          id: true,
          registrations: {
            select: { attendeeEmail: true, answers: true },
          },
        },
      })

      const pastEmailCounts = new Map<string, number>()
      for (const pe of pastEvents) {
        for (const reg of pe.registrations) {
          const email = reg.attendeeEmail?.trim().toLowerCase()
          if (email) {
            pastEmailCounts.set(email, (pastEmailCounts.get(email) ?? 0) + 1)
          }
        }
      }

      const currentRegistrations = await prisma.registration.findMany({
        where: { eventId: event.id },
        select: { attendeeEmail: true },
      })

      for (const cr of currentRegistrations) {
        const em = cr.attendeeEmail?.trim().toLowerCase()
        if (em && pastEmailCounts.has(em)) {
          returningAttendeesCount++
          const times = pastEmailCounts.get(em) ?? 0
          if (times >= 2) vipLoyalCount++
        }
      }

      firstTimeAttendeesCount = Math.max(0, totalRegistrations - returningAttendeesCount)
      returningRate = totalRegistrations > 0 ? Math.round((returningAttendeesCount / totalRegistrations) * 100) : 0
    }

    // Comparative performance vs organizer average
    let vsAverage: number | null = null
    let avgRegistrations: number | null = null
    if (event.organizerId) {
      const allOrgEvents = await prisma.event.findMany({
        where: { organizerId: event.organizerId, id: { not: event.id } },
        include: { _count: { select: { registrations: true } } },
      })
      if (allOrgEvents.length > 0) {
        avgRegistrations = Math.round(
          allOrgEvents.reduce((s, e) => s + e._count.registrations, 0) / allOrgEvents.length
        )
        if (avgRegistrations > 0) {
          vsAverage = Math.round(((registrations.length - avgRegistrations) / avgRegistrations) * 100)
        }
      }
    }

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
      checkedInCount,
      checkInRate,
      waitlistCount,
      waitlistedCount,
      promotedCount,
      stillWaitingCount,
      waitlistConversionRate,
      sourceBreakdown: sourceBreakdown.map((item) => ({
        source: item.source ?? 'unknown',
        count: item._count.id,
      })),
      feedbackScore: avgFeedbackScore,
      feedbackCount,
      vsAverage,
      avgRegistrations,
      aiInsightsFreeUsed: event.aiInsightsFreeUsed,
      event: { capacity: event.capacity },
      registrationsByDay,
      registrationsByHour,
      paidRevenueKes,
      paidCommissionKes,
      paidNetKes,
      paidTicketsSold,
      paidAdmissionsIssued,
      pendingPaidOrders: pendingPayments.length,
      tierBreakdown,
      intelligence: {
        noShowCount,
        noShowRate,
        attendanceRate,
        peakArrivalWindow,
        peakVelocityCount,
        recommendedScanners,
        gateArrivalSlots,
        returningAttendeesCount,
        firstTimeAttendeesCount,
        returningRate,
        vipLoyalCount,
      },
    })
  } catch (err) {
    console.error('Analytics error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
