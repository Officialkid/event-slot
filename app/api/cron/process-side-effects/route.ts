import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasAdminAccess } from "@/lib/isAdmin"
import prisma from "@/lib/prisma"
import { processPendingSideEffectOutboxItems } from "@/lib/events/event-side-effect-outbox"

export async function GET(req: NextRequest) {
  return handleProcessSideEffects(req)
}

export async function POST(req: NextRequest) {
  return handleProcessSideEffects(req)
}

async function handleProcessSideEffects(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET?.trim()

    let isCronAuth = false
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isCronAuth = true
    }

    let isAdminAuth = false
    if (!isCronAuth) {
      const session = await getServerSession(authOptions)
      if (session && hasAdminAccess(session)) {
        isAdminAuth = true
      }
    }

    if (!isCronAuth && !isAdminAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)

    const limitParam = searchParams.get("limit")
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100)
      : 20

    const leaseDurationParam = searchParams.get("leaseDurationMs")
    const leaseDurationMs = leaseDurationParam
      ? Math.max(parseInt(leaseDurationParam, 10) || 60_000, 5_000)
      : 60_000

    const eventId = searchParams.get("eventId") || undefined
    const creationProposalId = searchParams.get("creationProposalId") || undefined
    const outboxItemId = searchParams.get("outboxItemId") || undefined

    const summary = await processPendingSideEffectOutboxItems({
      eventId,
      creationProposalId,
      outboxItemId,
      limit,
      leaseDurationMs,
      now: new Date(),
      prismaClient: prisma,
    })

    return NextResponse.json({
      success: true,
      ok: true,
      processed: summary.processedCount,
      succeeded: summary.succeededCount,
      failed: summary.failedCount,
      skipped: summary.skippedCount,
      ambiguous: summary.ambiguousCount,
      deliveryEvidence: summary.deliveryEvidence,
      aggregateStatus: summary.aggregateStatus,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error("[cron/process-side-effects] Execution error:", errorMsg)
    return NextResponse.json(
      { error: "Internal server error", details: errorMsg },
      { status: 500 }
    )
  }
}
