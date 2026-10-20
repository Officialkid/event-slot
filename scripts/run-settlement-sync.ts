#!/usr/bin/env node
/**
 * Manual Operator CLI for Paystack Settlement Synchronization & Dry-Run
 *
 * Usage:
 *   npx tsx scripts/run-settlement-sync.ts --dry-run
 *   npx tsx scripts/run-settlement-sync.ts --execute
 *   npx tsx scripts/run-settlement-sync.ts --batch-id=12345 --dry-run
 */

import { runPaystackSettlementSync } from '../lib/settlementSyncWorker'

async function main() {
  const args = process.argv.slice(2)
  const isExecute = args.includes('--execute')
  const dryRun = !isExecute || args.includes('--dry-run')
  const batchIdArg = args.find((a) => a.startsWith('--batch-id='))
  const batchId = batchIdArg ? batchIdArg.split('=')[1] : undefined

  console.log('====================================================')
  console.log('EventSlot Paystack Settlement Synchronization Runner')
  console.log('====================================================')
  console.log(`Mode: ${dryRun ? 'DRY-RUN (Read-Only Preview)' : 'EXECUTE (Authoritative Ingestion)'}`)
  if (batchId) console.log(`Target Batch ID: ${batchId}`)
  console.log('----------------------------------------------------')

  const result = await runPaystackSettlementSync({
    dryRun,
    allowDisabled: true, // Manual operator invocation overrides default disabled state
    batchId,
    actorId: 'MANUAL_OPERATOR_CLI',
  })

  console.log('\n--- Sync Summary ---')
  console.log(`Success: ${result.success}`)
  console.log(`Batches Inspected: ${result.batchesInspected}`)
  console.log(`Batches Processed: ${result.batchesProcessed}`)
  console.log(`Batches Skipped: ${result.batchesSkipped}`)
  console.log(`Payments Settled: ${result.totalSettledPayments}`)
  console.log(`Payments Already Settled: ${result.totalAlreadySettled}`)
  console.log(`Unmatched Transactions: ${result.unmatchedTransactions.length}`)
  console.log(`Message: ${result.message}\n`)

  if (result.batchResults.length > 0) {
    console.log('--- Batch Details ---')
    for (const b of result.batchResults) {
      console.log(
        `[Batch ${b.batchId}] ${b.batchReference} -> Status: ${b.status} | Tx Count: ${b.transactionCount} | Settled: ${b.settledCount} | Already Settled: ${b.alreadySettledCount} | Unmatched: ${b.unmatchedCount}`
      )
      if (b.error) {
        console.error(`  Error: ${b.error}`)
      }
    }
  }

  process.exit(result.success ? 0 : 1)
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err)
  process.exit(1)
})
