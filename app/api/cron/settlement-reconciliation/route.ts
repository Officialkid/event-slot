import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasAdminAccess } from '@/lib/isAdmin'
import { runPaystackSettlementSync } from '@/lib/settlementSyncWorker'

export async function GET(req: NextRequest) {
  return handleSettlementReconciliation(req)
}

export async function POST(req: NextRequest) {
  return handleSettlementReconciliation(req)
}

async function handleSettlementReconciliation(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET?.trim()

    let isCronAuth = false
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isCronAuth = true
    }

    let isAdminAuth = false
    let adminUserId: string | null = null

    if (!isCronAuth) {
      const session = await getServerSession(authOptions)
      if (session && hasAdminAccess(session)) {
        isAdminAuth = true
        adminUserId = (session.user as any)?.id || session.user?.email || 'admin'
      }
    }

    if (!isCronAuth && !isAdminAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const dryRun = searchParams.get('dryRun') === 'true'
    const force = searchParams.get('force') === 'true'
    const batchId = searchParams.get('batchId') || undefined

    const limitParam = searchParams.get('limit')
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50)
      : 10

    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const from = fromParam ? new Date(fromParam) : undefined
    const to = toParam ? new Date(toParam) : undefined

    // 1. Guard against unconfigured or disabled sync unless explicitly overridden
    const isSyncFlagEnabled = process.env.ENABLE_PAYSTACK_SETTLEMENT_SYNC === 'true'
    const allowDisabled = (force && isAdminAuth) || dryRun

    if (!isSyncFlagEnabled && !allowDisabled) {
      return NextResponse.json({
        success: false,
        enabled: false,
        message:
          'Settlement synchronization is disabled by default. Set ENABLE_PAYSTACK_SETTLEMENT_SYNC=true to enable automated settlement reconciliation.',
      })
    }

    const actorId = isCronAuth
      ? 'CRON_SETTLEMENT_SYNC'
      : `ADMIN_${adminUserId}`

    // 2. Execute reconciliation via authoritative sync worker
    const result = await runPaystackSettlementSync({
      dryRun,
      allowDisabled,
      batchId,
      limit,
      from,
      to,
      actorId,
    })

    return NextResponse.json({
      success: result.success,
      dryRun: result.dryRun,
      batchesInspected: result.batchesInspected,
      batchesProcessed: result.batchesProcessed,
      batchesSkipped: result.batchesSkipped,
      totalSettledPayments: result.totalSettledPayments,
      totalAlreadySettled: result.totalAlreadySettled,
      unmatchedTransactionsCount: result.unmatchedTransactions.length,
      batchResults: result.batchResults,
      message: result.message,
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Settlement reconciliation failed'
    console.error('[cron/settlement-reconciliation] Execution error:', errorMsg)
    return NextResponse.json(
      { success: false, error: 'Settlement reconciliation encountered an internal error.' },
      { status: 500 }
    )
  }
}
