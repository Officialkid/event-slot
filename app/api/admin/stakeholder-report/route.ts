import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasAdminAccess } from "@/lib/isAdmin"
import { prisma } from "@/lib/prisma"
import { generateStakeholderReport } from "@/lib/generateStakeholderReport"
import { env } from "@/lib/env"

type ReportPeriod = "weekly" | "monthly" | "yearly"

type TrendBuckets = {
  labels: string[]
  starts: Date[]
  ends: Date[]
}

type MonthlySnapshot = {
  month: string
  totalUsers: number
  registrations: number
}

const FIRST_PLATFORM_ACTIVITY_AT = new Date("2026-04-15T00:00:00.000Z")
const PRO_ELIGIBILITY_MIN_REGISTRATIONS = Number.parseInt(env.REPORT_PRO_ELIGIBILITY_MIN_REGISTRATIONS || "30", 10)

function getMonthlyWeekBuckets(periodStart: Date): TrendBuckets {
  const labels: string[] = []
  const starts: Date[] = []
  const ends: Date[] = []

  const nextMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1)
  let cursor = new Date(periodStart)
  let weekIndex = 1

  while (cursor < nextMonth) {
    const start = new Date(cursor)
    const end = new Date(cursor)
    end.setDate(end.getDate() + 7)
    if (end > nextMonth) end.setTime(nextMonth.getTime())

    labels.push(`Week ${weekIndex}`)
    starts.push(start)
    ends.push(end)

    cursor = end
    weekIndex += 1
  }

  return { labels, starts, ends }
}

function getYearlyMonthBuckets(year: number): TrendBuckets {
  const labels: string[] = []
  const starts: Date[] = []
  const ends: Date[] = []

  for (let month = 0; month < 12; month += 1) {
    labels.push(new Date(year, month, 1).toLocaleDateString("en-GB", { month: "short" }))
    starts.push(new Date(year, month, 1))
    ends.push(new Date(year, month + 1, 1))
  }

  return { labels, starts, ends }
}

function countByBuckets(dates: Date[], buckets: TrendBuckets): number[] {
  return buckets.starts.map((start, index) => {
    const end = buckets.ends[index]
    let count = 0
    for (const date of dates) {
      if (date >= start && date < end) {
        count += 1
      }
    }
    return count
  })
}

function buildMonthlySnapshotsSinceLaunch(
  userDates: Date[],
  registrationDates: Date[],
  launchDate: Date,
  asOfDate: Date,
): MonthlySnapshot[] {
  const snapshots: MonthlySnapshot[] = []
  const monthCursor = new Date(launchDate.getFullYear(), launchDate.getMonth(), 1)
  const lastMonth = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1)

  while (monthCursor <= lastMonth) {
    const monthStart = new Date(monthCursor)
    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1)

    const totalUsers = userDates.filter(date => date < monthEnd).length
    const registrations = registrationDates.filter(date => date >= monthStart && date < monthEnd).length

    snapshots.push({
      month: monthStart.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      totalUsers,
      registrations,
    })

    monthCursor.setMonth(monthCursor.getMonth() + 1)
  }

  return snapshots
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return new Response(null, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const periodParam = searchParams.get("period")
    const period: ReportPeriod =
      periodParam === "weekly" || periodParam === "monthly" || periodParam === "yearly" ? periodParam : "monthly"

    const now = new Date()
    let periodStart: Date
    let periodLabel: string
    let prevStart: Date
    let prevEnd: Date

    if (period === "weekly") {
      periodStart = new Date(now)
      periodStart.setDate(now.getDate() - 7)
      prevStart = new Date(now)
      prevStart.setDate(now.getDate() - 14)
      prevEnd = new Date(periodStart)
      periodLabel = `Week of ${periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    } else if (period === "monthly") {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      prevEnd = new Date(periodStart)
      periodLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    } else {
      periodStart = new Date(now.getFullYear(), 0, 1)
      prevStart = new Date(now.getFullYear() - 1, 0, 1)
      prevEnd = new Date(periodStart)
      periodLabel = String(now.getFullYear())
    }

    const trendBuckets =
      period === "yearly" ? getYearlyMonthBuckets(now.getFullYear()) : getMonthlyWeekBuckets(periodStart)

    const trendStart = trendBuckets.starts[0] ?? periodStart
    const trendEnd = trendBuckets.ends[trendBuckets.ends.length - 1] ?? now

    const [
      totalUsers,
      newUsers,
      prevNewUsers,
      totalEvents,
      newEvents,
      prevNewEvents,
      totalRegistrations,
      newRegistrations,
      prevNewRegistrations,
      activeEvents,
      errorLogs,
      transactions,
      topEvents,
      userPlans,
      usersForTrend,
      eventsForTrend,
      registrationsForTrend,
      usersSinceLaunch,
      registrationsSinceLaunch,
      allEventsForPipeline,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.user.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
      prisma.event.count(),
      prisma.event.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.event.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
      prisma.registration.count(),
      prisma.registration.count({ where: { submittedAt: { gte: periodStart } } }),
      prisma.registration.count({ where: { submittedAt: { gte: prevStart, lt: prevEnd } } }),
      prisma.event.count({
        where: {
          status: "active",
          archived: false,
          OR: [{ deadline: null }, { deadline: { gt: now } }],
        },
      }),
      prisma.errorLog.findMany({
        where: { createdAt: { gte: periodStart } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      prisma.reportDownloadTransaction.findMany({
        where: { createdAt: { gte: periodStart } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      prisma.event.findMany({
        where: { createdAt: { gte: periodStart } },
        orderBy: { confirmedCount: "desc" },
        take: 10,
        include: { organizer: { select: { name: true, email: true } } },
      }),
      prisma.user.groupBy({ by: ["plan"], _count: { _all: true } }),
      prisma.user.findMany({
        where: { createdAt: { gte: trendStart, lt: trendEnd } },
        select: { createdAt: true },
      }),
      prisma.event.findMany({
        where: { createdAt: { gte: trendStart, lt: trendEnd } },
        select: { createdAt: true },
      }),
      prisma.registration.findMany({
        where: { submittedAt: { gte: trendStart, lt: trendEnd } },
        select: { submittedAt: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: FIRST_PLATFORM_ACTIVITY_AT } },
        select: { createdAt: true },
      }),
      prisma.registration.findMany({
        where: { submittedAt: { gte: FIRST_PLATFORM_ACTIVITY_AT } },
        select: { submittedAt: true },
      }),
      prisma.event.findMany({
        select: {
          organizerId: true,
          organizerEmail: true,
          confirmedCount: true,
          deadline: true,
          status: true,
          archived: true,
        },
        take: 5000,
      }),
    ])

  const errorMap: Record<string, { count: number; message: string }> = {}
  for (const error of errorLogs) {
    if (!errorMap[error.route]) {
      errorMap[error.route] = { count: 0, message: error.message }
    }
    errorMap[error.route].count += 1
  }

  const topErrors = Object.entries(errorMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([route, value]) => ({ route, ...value }))

  const revenueKsh = transactions.reduce((sum, transaction) => sum + transaction.amountKsh, 0)
  const planCounts = Object.fromEntries(userPlans.map(plan => [plan.plan, plan._count._all]))
  const userTrend = countByBuckets(usersForTrend.map(item => item.createdAt), trendBuckets)
  const eventTrend = countByBuckets(eventsForTrend.map(item => item.createdAt), trendBuckets)
  const registrationTrend = countByBuckets(registrationsForTrend.map(item => item.submittedAt), trendBuckets)
  const monthlySnapshots = buildMonthlySnapshotsSinceLaunch(
    usersSinceLaunch.map(item => item.createdAt),
    registrationsSinceLaunch.map(item => item.submittedAt),
    FIRST_PLATFORM_ACTIVITY_AT,
    now,
  )

  const createdEventOrganizerKeys = new Set<string>()
  const completedEventOrganizerKeys = new Set<string>()
  const eligibleForProOrganizerKeys = new Set<string>()

  for (const event of allEventsForPipeline) {
    const organizerKey = event.organizerId ?? event.organizerEmail
    if (!organizerKey) continue

    createdEventOrganizerKeys.add(organizerKey)

    const isCompleted =
      event.archived ||
      event.status.toLowerCase() === "completed" ||
      event.status.toLowerCase() === "closed" ||
      (event.deadline ? event.deadline < now : false)

    if (isCompleted) {
      completedEventOrganizerKeys.add(organizerKey)
    }

    if (event.confirmedCount >= PRO_ELIGIBILITY_MIN_REGISTRATIONS || isCompleted) {
      eligibleForProOrganizerKeys.add(organizerKey)
    }
  }

  const buffer = await generateStakeholderReport({
    period,
    periodLabel,
    generatedAt: now,
    newUsers,
    totalUsers,
    prevNewUsers,
    newEvents,
    totalEvents,
    prevNewEvents,
    newRegistrations,
    totalRegistrations,
    prevNewRegistrations,
    activeEvents,
    reportDownloadsPurchased: transactions.reduce((sum, transaction) => sum + transaction.downloads, 0),
    revenueKsh,
    topEvents: topEvents.map(event => ({
      title: event.title,
      registrations: event.confirmedCount,
      capacity: event.capacity,
      organizer: event.organizer?.name ?? event.organizer?.email ?? "Unknown",
      status: event.status,
      archived: event.archived,
      deadline: event.deadline,
    })),
    errorCount: errorLogs.length,
    topErrors,
    failedEmailCount: errorLogs.filter(error => error.route.toLowerCase().includes("email") || error.message.toLowerCase().includes("email")).length,
    emailsSent: null,
    uptimePercentage: null,
    freeUsers: planCounts.free ?? 0,
    proUsers: planCounts.pro ?? 0,
    businessUsers: planCounts.business ?? 0,
    firstPlatformActivityAt: FIRST_PLATFORM_ACTIVITY_AT,
    growthLabels: trendBuckets.labels,
    usersTrend: userTrend,
    eventsTrend: eventTrend,
    registrationsTrend: registrationTrend,
    monthlySnapshots,
    createdEventOrganizers: createdEventOrganizerKeys.size,
    completedEventOrganizers: completedEventOrganizerKeys.size,
    eligibleForProOrganizers: eligibleForProOrganizerKeys.size,
  })

    const reportBytes = new Uint8Array(buffer)

    return new Response(reportBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="eventslot-${period}-report-${now.toISOString().split("T")[0]}.docx"`,
      },
    })
  } catch (error) {
    console.error("[admin/stakeholder-report] GET error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
