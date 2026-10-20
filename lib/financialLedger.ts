/**
 * Financial Ledger & Accounting Foundation
 *
 * Implements immutable ledger entry conventions, integer minor units calculations,
 * deterministic idempotency keys, and account direction semantics for EventSlot.
 *
 * Accounting Model:
 * - The ledger implements organizer entitlement accounting (EventSlot's liability / payout entitlement to the organizer).
 * - For every paid ticket sold, two immutable entries are recorded:
 *   1. TICKET_PROCEEDS (CREDIT): 100% of gross ticket price (e.g., KES 1,000 / 100,000 minor units).
 *   2. PLATFORM_COMMISSION (DEBIT): Flat 5% platform commission (e.g., KES 50 / 5,000 minor units).
 *   Net organizer entitlement before withdrawals or adjustments = KES 950 (95,000 minor units).
 * - Scope: This ledger specifically tracks organizer payout entitlements and adjustments.
 *   It is NOT a full multi-account general ledger with double-entry cash/clearing/equity balancing accounts.
 * - Immutability & Idempotency: All entries enforce a unique database constraint on idempotencyKey.
 *   Upsert semantics with empty update blocks guarantee historical records cannot be overwritten or posted twice.
 *
 * Accounting Direction Convention:
 * - CREDIT: Increases the organizer's entitlement balance (+).
 *   Example: TICKET_PROCEEDS, positive ADJUSTMENT, dispute REVERSAL.
 * - DEBIT: Decreases the organizer's entitlement balance (-).
 *   Example: PLATFORM_COMMISSION (5%), WITHDRAWAL_RESERVATION, REFUND, negative ADJUSTMENT.
 *
 * Monetary Representation:
 * - All ledger amounts are stored as non-negative integers in minor units (e.g., KES cents: 1 KES = 100 minor units).
 * - Arithmetic on ledger balances uses BigInt to eliminate floating-point precision loss.
 */

import { LedgerDirection, LedgerEntryType } from '@prisma/client'

export const MINOR_UNIT_FACTORS: Record<string, number> = {
  KES: 100,
  USD: 100,
  EUR: 100,
  GBP: 100,
}

export function getMinorUnitFactor(currency = 'KES'): number {
  const code = (currency || 'KES').trim().toUpperCase()
  return MINOR_UNIT_FACTORS[code] ?? 100
}

/**
 * Converts a major currency unit (e.g., KES 1,000 or USD 25.00) to integer minor units (e.g., 100,000 cents).
 * Uses exact rounding to avoid IEEE-754 binary floating point precision artifacts.
 */
export function toMinorUnits(amount: number, currency = 'KES'): bigint {
  if (!Number.isFinite(amount) || amount < 0) {
    return BigInt(0)
  }
  const factor = getMinorUnitFactor(currency)
  return BigInt(Math.round(amount * factor))
}

/**
 * Converts minor units back to major units as a standard JavaScript number.
 */
export function fromMinorUnits(amountMinor: bigint | number, currency = 'KES'): number {
  const factor = getMinorUnitFactor(currency)
  return Number(amountMinor) / factor
}

/**
 * Returns true if the ledger direction increases the account balance (CREDIT).
 */
export function isBalanceIncreasing(direction: LedgerDirection): boolean {
  return direction === 'CREDIT'
}

/**
 * Returns signed minor units for balance accumulation:
 * - CREDIT => +amountMinor
 * - DEBIT  => -amountMinor
 */
export function getSignedAmountMinor(
  direction: LedgerDirection,
  amountMinorUnits: bigint | number
): bigint {
  const unsigned = typeof amountMinorUnits === 'bigint' ? amountMinorUnits : BigInt(amountMinorUnits)
  return direction === 'CREDIT' ? unsigned : -unsigned
}

/**
 * Calculates net available balance from an array of ledger entries using pure BigInt arithmetic.
 */
export function calculateLedgerBalance(
  entries: Array<{ direction: LedgerDirection; amountMinorUnits: bigint | number }>
): {
  balanceMinorUnits: bigint
  totalCreditsMinorUnits: bigint
  totalDebitsMinorUnits: bigint
} {
  let totalCredits = BigInt(0)
  let totalDebits = BigInt(0)

  for (const entry of entries) {
    const amount = typeof entry.amountMinorUnits === 'bigint' ? entry.amountMinorUnits : BigInt(entry.amountMinorUnits)
    if (entry.direction === 'CREDIT') {
      totalCredits += amount
    } else {
      totalDebits += amount
    }
  }

  return {
    balanceMinorUnits: totalCredits - totalDebits,
    totalCreditsMinorUnits: totalCredits,
    totalDebitsMinorUnits: totalDebits,
  }
}

/**
 * Standard deterministic idempotency key generators.
 * Prevents duplicate posting at the database uniqueness level.
 */
export function buildOrderProceedsIdempotencyKey(orderId: string): string {
  return `order:${orderId}:proceeds`
}

export function buildOrderCommissionIdempotencyKey(orderId: string): string {
  return `order:${orderId}:commission`
}

export function buildWithdrawalReservationIdempotencyKey(withdrawalId: string): string {
  return `withdrawal:${withdrawalId}:reservation`
}

export function buildWithdrawalCompletionIdempotencyKey(withdrawalId: string): string {
  return `withdrawal:${withdrawalId}:completion`
}

export function buildWithdrawalReleaseIdempotencyKey(withdrawalId: string): string {
  return `withdrawal:${withdrawalId}:release`
}

export function buildRefundIdempotencyKey(paymentId: string, refundRef: string): string {
  return `refund:${paymentId}:${refundRef}`
}

export function buildAdjustmentIdempotencyKey(reference: string): string {
  return `adj:${reference}`
}

/**
 * Sanitizes metadata before writing to the database:
 * Strips secrets, card details, authorization tokens, passwords, and sensitive keys.
 */
const SENSITIVE_KEYS = new Set([
  'cvv',
  'cvc',
  'card_number',
  'cardNumber',
  'pan',
  'pin',
  'password',
  'secret',
  'secret_key',
  'authorization_code',
  'auth_code',
  'token',
  'access_token',
])

export function sanitizeLedgerMetadata(
  meta?: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object') return undefined

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      continue
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeLedgerMetadata(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}
