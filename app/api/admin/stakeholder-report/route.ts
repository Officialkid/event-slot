import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isAdminEmail } from "@/lib/isAdmin"
import { prisma } from "@/lib/prisma"
import { generateStakeholderReport } from "@/lib/generateStakeholderReport"

type ReportPeriod = "weekly" | "monthly" | "yearly"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!isAdminEmail(session?.user?.email)) {
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
    prisma.errorLog.findMany({ where: { createdAt: { gte: periodStart } }, orderBy: { createdAt: "desc" } }),
    prisma.reportDownloadTransaction.findMany({ where: { createdAt: { gte: periodStart } } }),
    prisma.event.findMany({
      where: { createdAt: { gte: periodStart } },
      orderBy: { confirmedCount: "desc" },
      take: 10,
      include: { organizer: { select: { name: true, email: true } } },
    }),
    prisma.user.groupBy({ by: ["plan"], _count: { _all: true } }),
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
    })),
    errorCount: errorLogs.length,
    topErrors,
    failedEmailCount: errorLogs.filter(error => error.route.toLowerCase().includes("email") || error.message.toLowerCase().includes("email")).length,
    freeUsers: planCounts.free ?? 0,
    proUsers: planCounts.pro ?? 0,
    businessUsers: planCounts.business ?? 0,
  })

  const reportBytes = new Uint8Array(buffer)

  return new Response(reportBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="eventslot-${period}-report-${now.toISOString().split("T")[0]}.docx"`,
    },
  })
}