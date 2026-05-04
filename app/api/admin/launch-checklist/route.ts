import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isAdminEmail } from "@/lib/isAdmin"

const REQUIRED_ENV_VARS = [
  { key: "DATABASE_URL", label: "Database URL (Neon)" },
  { key: "NEXTAUTH_URL", label: "NextAuth URL" },
  { key: "NEXTAUTH_SECRET", label: "NextAuth Secret" },
  { key: "GOOGLE_CLIENT_ID", label: "Google OAuth Client ID" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google OAuth Client Secret" },
  { key: "RESEND_API_KEY", label: "Resend API Key" },
  { key: "SUPER_ADMIN_EMAIL", label: "Super Admin Email" },
  { key: "SUPER_ADMIN_EMAIL_2", label: "Second Super Admin Email" },
  { key: "CRON_SECRET", label: "Cron Secret" },
  { key: "UPSTASH_REDIS_REST_URL", label: "Upstash Redis URL" },
  { key: "UPSTASH_REDIS_REST_TOKEN", label: "Upstash Redis Token" },
]

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // 1 — Env var checks
    const envChecks = REQUIRED_ENV_VARS.map(({ key, label }) => ({
      label,
      key,
      ok: Boolean(process.env[key]),
    }))

    // 2 — Database connectivity
    let dbOk = false
    try {
      await prisma.$queryRaw`SELECT 1`
      dbOk = true
    } catch { /* fail silently */ }

    // 3 — Admin user exists in DB
    let adminUserExists = false
    const adminEmails = [process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_EMAIL_2].filter(
      (email): email is string => Boolean(email)
    )
    if (dbOk && adminEmails.length > 0) {
      try {
        const admin = await prisma.user.findFirst({
          where: { email: { in: adminEmails } },
          select: { id: true, plan: true },
        })
        adminUserExists = Boolean(admin)
      } catch { /* fail silently */ }
    }

    // 4 — Upstash Redis connectivity
    let redisOk = false
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
          headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
        })
        redisOk = res.ok
      } catch { /* fail silently */ }
    }

    // 5 — Recent errors in the last 24 hours
    let recentErrorCount = 0
    if (dbOk) {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        recentErrorCount = await prisma.errorLog.count({
          where: { createdAt: { gte: since } },
        })
      } catch { /* ErrorLog model may not exist if migrations haven't run */ }
    }

    // 6 — Total registered users and events
    let userCount = 0
    let eventCount = 0
    if (dbOk) {
      try {
        ;[userCount, eventCount] = await Promise.all([
          prisma.user.count(),
          prisma.event.count(),
        ])
      } catch { /* fail silently */ }
    }

    return NextResponse.json({
      envChecks,
      dbOk,
      redisOk,
      adminUserExists,
      recentErrorCount,
      userCount,
      eventCount,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[admin/launch-checklist] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
