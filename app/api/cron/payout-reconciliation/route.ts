import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasAdminAccess } from '@/lib/isAdmin'
import {
  runWithdrawalReconciliationWorker,
  reconcileOrganizerWithdrawal,
} from '@/lib/withdrawalService'

export async function GET(req: NextRequest) {
  return handlePayoutReconciliation(req)
}

export async function POST(req: NextRequest) {
  return handlePayoutReconciliation(req)
}

async function handlePayoutReconciliation(req: NextRequest) {
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
    const withdrawalId = searchParams.get('withdrawalId') || undefined
    const forceRelease = searchParams.get('forceRelease') === 'true'
    const forceReason = searchParams.get('forceReason') || undefined

    const olderThanParam = searchParams.get('olderThanMinutes')
    const olderThanMinutes = olderThanParam ? Math.max(parseInt(olderThanParam, 10) || 5, 1) : 5

    const limitParam = searchParams.get('limit')
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100)
      : 50

    const actorId = isCronAuth
      ? 'CRON_PAYOUT_RECONCILIATION'
      : `ADMIN_${adminUserId}`

    // 1. Single-withdrawal targeted reconciliation
    if (withdrawalId) {
      if (forceRelease && !isAdminAuth) {
        return NextResponse.json(
          { error: 'Manual force release requires an authenticated administrator session.' },
          { status: 403 }
        )
      }

      const singleResult = await reconcileOrganizerWithdrawal({
        withdrawalId,
        actorId,
        forceRelease,
        forceReason,
      })

      return NextResponse.json({
        success: singleResult.reconciled || singleResult.status === 'COMPLETED' || singleResult.status === 'FAILED',
        mode: 'single',
        result: singleResult,
      })
    }

    // 2. Batch reconciliation worker execution
    const batchResult = await runWithdrawalReconciliationWorker({
      olderThanMinutes,
      limit,
      dryRun,
      actorId,
    })

    return NextResponse.json({
      success: true,
      mode: 'batch',
      dryRun,
      totalInspected: batchResult.totalInspected,
      reconciledCount: batchResult.reconciledCount,
      stillPendingCount: batchResult.stillPendingCount,
      inconclusiveCount: batchResult.inconclusiveCount,
      results: batchResult.results,
      message: batchResult.message,
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Payout reconciliation failed'
    console.error('[cron/payout-reconciliation] Execution error:', errorMsg)
    return NextResponse.json(
      { success: false, error: 'Payout reconciliation encountered an internal error.' },
      { status: 500 }
    )
  }
}
