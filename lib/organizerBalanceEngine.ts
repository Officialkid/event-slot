/**
 * Authoritative Organizer Balance & Settlement Calculation Engine
 *
 * Implements pure BigInt minor unit accounting for organizer balances,
 * distinguishing collected funds from settled funds, active withdrawal reservations,
 * and completed payouts.
 *
 * Core Rules:
 * - 5% Flat Platform Commission across all tiers and plans.
 * - 95% Net Organizer Entitlement.
 * - UNSETTLED FUNDS (Payment.settlementStatus = PENDING) ARE NEVER WITHDRAWABLE.
 * - Available Withdrawable Balance = max(0, Settled Entitlements - Active Reservations - Completed Withdrawals).
 */

import prisma from '@/lib/prisma'
import { toMinorUnits } from '@/lib/financialLedger'

export type AuthoritativeOrganizerBalance = {
  organizerId: string
  currency: 'KES' | 'USD'
  // 1. Gross ticket proceeds
  totalGrossMinorUnits: bigint
  // 2. EventSlot 5% platform commission
  totalCommissionMinorUnits: bigint
  // 3. Organizer 95% total entitlement
  totalEntitlementMinorUnits: bigint
  // 4. Funds collected on Paystack but pending settlement evidence
  pendingSettlementMinorUnits: bigint
  // 5. Quarantined or disputed funds (not pending, not settled)
  disputedOrReversedMinorUnits: bigint
  // 6. Settled organizer funds (verified evidence in merchant balance)
  settledEntitlementMinorUnits: bigint
  // 7. Funds reserved for active pending/processing withdrawals
  pendingReservationsMinorUnits: bigint
  // 8. Completed withdrawals (paid out to organizer)
  completedWithdrawalsMinorUnits: bigint
  // 9. Reversed withdrawals (restored to organizer)
  reversedWithdrawalsMinorUnits: bigint
  // 10. Net refund or administrative adjustments debited to organizer
  otherAdjustmentsMinorUnits: bigint
  // 11. Available balance eligible for a new withdrawal
  availableMinorUnits: bigint
  // Display numbers (converted from integer minor units)
  formatted: {
    totalGross: number
    totalCommission: number
    totalEntitlement: number
    pendingSettlement: number
    disputedOrReversed: number
    settledEntitlement: number
    pendingReservations: number
    completedWithdrawals: number
    otherAdjustments: number
    available: number
  }
  // Reconciliation verification against FinancialLedgerEntry
  reconciliation: {
    isBalanced: boolean
    ledgerNetEntitlementsMinorUnits: bigint
    discrepancyMinorUnits: bigint
  }
}

/**
 * Calculates the authoritative, integer-minor-unit balance breakdown for an organizer.
 */
export async function getAuthoritativeOrganizerBalance(
  organizerId: string,
  currency: 'KES' | 'USD' = 'KES',
  db = prisma
): Promise<AuthoritativeOrganizerBalance> {
  // 1. Fetch all successful, fulfilled payments for this organizer
  const payments = await db.payment.findMany({
    where: {
      status: 'SUCCESS',
      paidEventOrder: {
        status: 'PAID', // Excludes unfulfilled or OVERCAPACITY_PAID hold orders
      },
      event: {
        organizerId,
        isPaid: true,
      },
    },
    select: {
      amount: true,
      commissionAmount: true,
      organizerAmount: true,
      settlementStatus: true,
      paidEventOrder: {
        select: { currency: true },
      },
      event: {
        select: { currency: true },
      },
    },
  })

  let totalGrossMinorUnits = BigInt(0)
  let totalCommissionMinorUnits = BigInt(0)
  let totalEntitlementMinorUnits = BigInt(0)
  let pendingSettlementMinorUnits = BigInt(0)
  let disputedOrReversedMinorUnits = BigInt(0)
  let settledEntitlementMinorUnits = BigInt(0)

  for (const p of payments) {
    const paymentCurrency = (p.paidEventOrder?.currency || p.event?.currency || 'KES').toUpperCase()
    if (paymentCurrency !== currency) continue

    const grossMinor = toMinorUnits(p.amount, currency)
    const commMinor = toMinorUnits(p.commissionAmount, currency)
    const entMinor = toMinorUnits(p.organizerAmount, currency)

    totalGrossMinorUnits += grossMinor
    totalCommissionMinorUnits += commMinor
    totalEntitlementMinorUnits += entMinor

    if (p.settlementStatus === 'SETTLED') {
      settledEntitlementMinorUnits += entMinor
    } else if (p.settlementStatus === 'PENDING') {
      pendingSettlementMinorUnits += entMinor
    } else {
      // DISPUTED or REVERSED
      disputedOrReversedMinorUnits += entMinor
    }
  }

  // 2. Fetch all withdrawals for this organizer
  const withdrawals = await db.withdrawal.findMany({
    where: {
      organiserId: organizerId,
      currency,
    },
    select: {
      amount: true,
      amountMinorUnits: true,
      status: true,
    },
  })

  let pendingReservationsMinorUnits = BigInt(0)
  let completedWithdrawalsMinorUnits = BigInt(0)
  let reversedWithdrawalsMinorUnits = BigInt(0)

  for (const w of withdrawals) {
    const amountMinor = w.amountMinorUnits ?? toMinorUnits(w.amount, currency)

    if (w.status === 'PENDING' || w.status === 'PROCESSING') {
      pendingReservationsMinorUnits += amountMinor
    } else if (w.status === 'COMPLETED') {
      completedWithdrawalsMinorUnits += amountMinor
    } else if (w.status === 'REVERSED') {
      reversedWithdrawalsMinorUnits += amountMinor
    }
  }

  // 3. Fetch all ledger entries to check for explicit refunds or adjustments
  const ledgerEntries = await db.financialLedgerEntry.findMany({
    where: {
      organizerId,
      currency,
    },
    select: {
      entryType: true,
      direction: true,
      amountMinorUnits: true,
    },
  })

  let ledgerCredits = BigInt(0)
  let ledgerDebits = BigInt(0)
  let otherAdjustmentsDebits = BigInt(0)
  let otherAdjustmentsCredits = BigInt(0)

  for (const entry of ledgerEntries) {
    if (entry.entryType === 'TICKET_PROCEEDS') {
      ledgerCredits += entry.amountMinorUnits
    } else if (entry.entryType === 'PLATFORM_COMMISSION') {
      ledgerDebits += entry.amountMinorUnits
    } else if (entry.entryType === 'REFUND') {
      otherAdjustmentsDebits += entry.amountMinorUnits
    } else if (entry.entryType === 'ADJUSTMENT') {
      if (entry.direction === 'DEBIT') {
        otherAdjustmentsDebits += entry.amountMinorUnits
      } else {
        otherAdjustmentsCredits += entry.amountMinorUnits
      }
    }
  }

  const netOtherDeductionsMinor =
    otherAdjustmentsDebits > otherAdjustmentsCredits
      ? otherAdjustmentsDebits - otherAdjustmentsCredits
      : BigInt(0)

  // 4. Compute Available Withdrawable Balance
  // Funds must be settled, minus current reservations, minus completed withdrawals, minus net other adjustments
  const totalDeductionsMinor =
    pendingReservationsMinorUnits + completedWithdrawalsMinorUnits + netOtherDeductionsMinor
  const rawAvailable = settledEntitlementMinorUnits - totalDeductionsMinor
  const availableMinorUnits = rawAvailable > BigInt(0) ? rawAvailable : BigInt(0)

  // 5. Audit Reconciliation against FinancialLedgerEntry
  const ledgerNetEntitlementsMinorUnits = ledgerCredits - ledgerDebits
  const discrepancyMinorUnits = totalEntitlementMinorUnits - ledgerNetEntitlementsMinorUnits
  const isBalanced = discrepancyMinorUnits === BigInt(0)

  // Convert minor units to floating numbers for UI display
  const divisor = currency === 'KES' ? 100 : 100
  return {
    organizerId,
    currency,
    totalGrossMinorUnits,
    totalCommissionMinorUnits,
    totalEntitlementMinorUnits,
    pendingSettlementMinorUnits,
    disputedOrReversedMinorUnits,
    settledEntitlementMinorUnits,
    pendingReservationsMinorUnits,
    completedWithdrawalsMinorUnits,
    reversedWithdrawalsMinorUnits,
    otherAdjustmentsMinorUnits: netOtherDeductionsMinor,
    availableMinorUnits,
    formatted: {
      totalGross: Number(totalGrossMinorUnits) / divisor,
      totalCommission: Number(totalCommissionMinorUnits) / divisor,
      totalEntitlement: Number(totalEntitlementMinorUnits) / divisor,
      pendingSettlement: Number(pendingSettlementMinorUnits) / divisor,
      disputedOrReversed: Number(disputedOrReversedMinorUnits) / divisor,
      settledEntitlement: Number(settledEntitlementMinorUnits) / divisor,
      pendingReservations: Number(pendingReservationsMinorUnits) / divisor,
      completedWithdrawals: Number(completedWithdrawalsMinorUnits) / divisor,
      otherAdjustments: Number(netOtherDeductionsMinor) / divisor,
      available: Number(availableMinorUnits) / divisor,
    },
    reconciliation: {
      isBalanced,
      ledgerNetEntitlementsMinorUnits,
      discrepancyMinorUnits,
    },
  }
}
