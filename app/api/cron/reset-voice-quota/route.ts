import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Runs: 1st of every month at 12:00 AM EAT (= 21:00 UTC previous day)
// Schedule: "0 21 28-31 * *" — runs last days of month, logic checks the date

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Calculate next reset date
  const now = new Date()
  const eatNow = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const nextReset = new Date(Date.UTC(
    eatNow.getFullYear(),
    eatNow.getMonth() + 1,
    1, 0, 0, 0, 0
  ) - 3 * 60 * 60 * 1000)

  // Reset all users whose resetAt has passed
  const result = await prisma.voiceQuota.updateMany({
    where: { resetAt: { lte: now } },
    data: {
      usedThisMonth: 0,
      resetAt: nextReset,
    },
  })

  return NextResponse.json({
    success: true,
    resetCount: result.count,
    nextResetAt: nextReset.toISOString(),
    timestamp: now.toISOString(),
  })
}
