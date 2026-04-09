import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

function isSuperAdmin(email: string | null | undefined) {
  return email && email === process.env.SUPER_ADMIN_EMAIL
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!isSuperAdmin(session?.user?.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    // DB ping
    let dbOk = false
    try {
      await prisma.$queryRaw`SELECT 1`
      dbOk = true
    } catch { /* fail silently */ }

    const [recentErrors, emailsSentThisMonth] = await Promise.all([
      prisma.errorLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // Count registrations this month as a proxy for emails sent (confirmed only get emails)
      prisma.registration.count({
        where: {
          submittedAt: { gte: startOfMonth },
          status: "confirmed",
          consentTransactional: true,
        },
      }),
    ])

    return NextResponse.json({
      dbOk,
      recentErrors,
      emailsSentThisMonth,
    })
  } catch (err) {
    console.error("[admin/health] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
