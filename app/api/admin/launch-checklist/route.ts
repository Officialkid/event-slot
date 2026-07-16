import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getConfiguredAdminEmails, hasAdminAccess } from "@/lib/isAdmin"
import { getAIProviderStatus } from "@/lib/ai"

const REQUIRED_ENV_VARS = [
  { key: "DATABASE_URL", label: "Database URL (Neon)" },
  { key: "NEXTAUTH_URL", label: "NextAuth URL" },
  { key: "NEXTAUTH_SECRET", label: "NextAuth Secret" },
  { key: "GOOGLE_CLIENT_ID", label: "Google OAuth Client ID" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google OAuth Client Secret" },
  { key: "SMTP_HOST", label: "SMTP Host" },
  { key: "SMTP_PORT", label: "SMTP Port" },
  { key: "SMTP_USER", label: "SMTP User" },
  { key: "SMTP_PASSWORD", label: "SMTP Password" },
  { key: "SMTP_FROM", label: "SMTP Sender" },
  { key: "SUPER_ADMIN_EMAIL", label: "Super Admin Email" },
  { key: "SUPER_ADMIN_EMAIL_2", label: "Second Super Admin Email" },
  { key: "CRON_SECRET", label: "Cron Secret" },
  { key: "UPSTASH_REDIS_REST_URL", label: "Upstash Redis URL" },
  { key: "UPSTASH_REDIS_REST_TOKEN", label: "Upstash Redis Token" },
]

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const adminEmails = getConfiguredAdminEmails()

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
    if (dbOk && adminEmails.length > 0) {
      try {
        const admin = await prisma.user.findFirst({
          where: {
            OR: adminEmails.map((email) => ({
              email: { equals: email, mode: "insensitive" },
            })),
          },
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
    let trackedUsers = 0
    let unknownUsers = 0
    let paymentTestSeedReady = false
    if (dbOk) {
      try {
        ;[userCount, eventCount] = await Promise.all([
          prisma.user.count(),
          prisma.event.count(),
        ])

        trackedUsers = await prisma.user.count({
          where: {
            OR: [
              { signupCountry: { not: null } },
              { countryCode: { not: null } },
            ],
            NOT: [
              { signupCountry: "UNKNOWN" },
              { countryCode: "UNKNOWN" },
            ],
          },
        })
        unknownUsers = Math.max(userCount - trackedUsers, 0)

        const paymentFixtureCount = await prisma.event.count({
          where: {
            isTestData: true,
            title: {
              in: [
                "Test Paid Event - Single Tier",
                "Test Paid Event - Multi Tier",
              ],
            },
          },
        })
        paymentTestSeedReady = paymentFixtureCount >= 2
      } catch { /* fail silently */ }
    }

    const googleCalendarConfigured = Boolean(
      (process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID) &&
      (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)
    )

    const googleCalendarRedirectUri =
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      process.env.NEXTAUTH_URL ||
      ""

    const aiProviders = getAIProviderStatus()
    const aiPrimaryReady = aiProviders.some(
      (provider) => provider.configured && (provider.provider === "groq" || provider.provider === "openrouter")
    )
    const aiClaudeFallbackEnabled = process.env.AI_ENABLE_CLAUDE_FALLBACK?.trim().toLowerCase() === "true"

    return NextResponse.json({
      envChecks,
      dbOk,
      redisOk,
      adminUserExists,
      expectedAdminEmails: adminEmails,
      recentErrorCount,
      userCount,
      eventCount,
      trackedUsers,
      unknownUsers,
      countryCoveragePercent: userCount > 0 ? Math.round((trackedUsers / userCount) * 100) : 0,
      paymentTestSeedReady,
      googleCalendarConfigured,
      googleCalendarRedirectUri,
      aiProviders,
      aiPrimaryReady,
      aiClaudeFallbackEnabled,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[admin/launch-checklist] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
