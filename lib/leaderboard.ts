import { prisma } from './prisma'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns'

/**
 * ISO week key — e.g. "2025-W21"
 * Uses ISO 8601 week numbering (week starts Monday, week 1 = week containing first Thursday).
 */
export function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function getMonthKey(date = new Date()): string {
  return format(date, 'yyyy-MM')
}

export async function recalculateLeaderboard(period: 'week' | 'month' | 'all-time') {
  const now = new Date()
  let startDate: Date
  let endDate: Date
  let periodKey: string
  let periodType: 'WEEK' | 'MONTH' | 'ALL_TIME'

  if (period === 'week') {
    startDate = startOfWeek(now, { weekStartsOn: 1 })
    endDate = endOfWeek(now, { weekStartsOn: 1 })
    periodKey = getWeekKey(now)
    periodType = 'WEEK'
  } else if (period === 'month') {
    startDate = startOfMonth(now)
    endDate = endOfMonth(now)
    periodKey = getMonthKey(now)
    periodType = 'MONTH'
  } else {
    startDate = new Date('2020-01-01')
    endDate = new Date('2099-01-01')
    periodKey = 'all-time'
    periodType = 'ALL_TIME'
  }

  // Referral points: +5 per signup, +10 per completed referral (total, not additive)
  const referrals = await prisma.referral.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ['SIGNED_UP', 'EVENT_CREATED'] },
    },
    select: { referrerId: true, status: true },
  })
  const referralPts: Record<string, number> = {}
  for (const r of referrals) {
    referralPts[r.referrerId] = (referralPts[r.referrerId] ?? 0)
      + (r.status === 'EVENT_CREATED' ? 10 : 5)
  }

  // Organiser points: score per event based on fill rate + volume, capped at 100
  const events = await prisma.event.findMany({
    where: {
      eventDate: { gte: startDate, lte: endDate },
      status: 'active',
      organizerId: { not: null },
    },
    select: {
      organizerId: true,
      capacity: true,
      confirmedCount: true,
    },
  })
  const organiserPts: Record<string, number> = {}
  for (const e of events) {
    if (!e.organizerId) continue
    const reg = e.confirmedCount
    const fill = e.capacity
      ? (reg / e.capacity) * 10
      : Math.min(reg * 0.5, 50)
    const score = Math.min(fill + reg * 0.1, 100)
    organiserPts[e.organizerId] = (organiserPts[e.organizerId] ?? 0) + score
  }

  // Merge all users into entries
  const allIds = new Set([...Object.keys(referralPts), ...Object.keys(organiserPts)])
  const entries = Array.from(allIds).map(userId => ({
    userId,
    period: periodKey,
    periodType,
    referralPts: Math.round(referralPts[userId] ?? 0),
    organiserPts: Math.round(organiserPts[userId] ?? 0),
    totalPts: Math.round((referralPts[userId] ?? 0) + (organiserPts[userId] ?? 0)),
  }))

  // Rank each category
  const byRef = [...entries].sort((a, b) => b.referralPts - a.referralPts)
  const byOrg = [...entries].sort((a, b) => b.organiserPts - a.organiserPts)
  const byAll = [...entries].sort((a, b) => b.totalPts - a.totalPts)
  const refRank = Object.fromEntries(byRef.map((e, i) => [e.userId, i + 1]))
  const orgRank = Object.fromEntries(byOrg.map((e, i) => [e.userId, i + 1]))
  const allRank = Object.fromEntries(byAll.map((e, i) => [e.userId, i + 1]))

  if (entries.length === 0) {
    return { period: periodKey, ranked: 0 }
  }

  await prisma.$transaction(
    entries.map(e =>
      prisma.leaderboardEntry.upsert({
        where: { userId_period: { userId: e.userId, period: periodKey } },
        update: {
          referralPts: e.referralPts,
          organiserPts: e.organiserPts,
          totalPts: e.totalPts,
          referralRank: refRank[e.userId],
          organiserRank: orgRank[e.userId],
          overallRank: allRank[e.userId],
          calculatedAt: new Date(),
        },
        create: {
          ...e,
          referralRank: refRank[e.userId],
          organiserRank: orgRank[e.userId],
          overallRank: allRank[e.userId],
        },
      })
    )
  )

  return { period: periodKey, ranked: entries.length }
}
