import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

function isSuperAdmin(email: string | null | undefined) {
  return email && email === process.env.SUPER_ADMIN_EMAIL
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalUsers,
    totalEvents,
    totalRegistrations,
    activeEvents,
    newUsersThisMonth,
    newEventsThisMonth,
    planBreakdown,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.registration.count(),
    prisma.event.count({ where: { status: "active", archived: false } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.event.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.groupBy({ by: ["plan"], _count: { _all: true } }),
  ])

  const recentSignups = await prisma.user.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, plan: true, createdAt: true },
  })

  const plans: Record<string, number> = { free: 0, pro: 0, business: 0 }
  for (const row of planBreakdown) {
    plans[row.plan] = row._count._all
  }

  return NextResponse.json({
    totalUsers,
    totalEvents,
    totalRegistrations,
    activeEvents,
    newUsersThisMonth,
    newEventsThisMonth,
    plans,
    recentSignups,
  })
}
