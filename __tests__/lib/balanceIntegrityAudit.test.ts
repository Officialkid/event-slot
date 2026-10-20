/** @jest-environment node */

import {
  auditOrganizerBalanceIntegrity,
  getAuthoritativeOrganizerBalance,
} from '@/lib/organizerBalanceEngine'

const mockPrisma = {
  payment: {
    findMany: jest.fn(),
  },
  withdrawal: {
    findMany: jest.fn(),
  },
  financialLedgerEntry: {
    findMany: jest.fn(),
  },
}

describe('Authoritative Ledger Balance Invariant Checks & Anti-Drift Auditor', () => {
  const organizerId = 'org_audit_test_1'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('proves all 7 financial invariants hold on a perfectly balanced account', async () => {
    // 1 payment: Gross KES 10,000 (1,000,000 minor), 5% commission = KES 500 (50,000 minor), Entitlement = KES 9,500 (950,000 minor)
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        amount: 10000,
        commissionAmount: 500,
        organizerAmount: 9500,
        settlementStatus: 'SETTLED',
        paidEventOrder: { currency: 'KES' },
        event: { currency: 'KES' },
      },
    ])

    // 1 completed withdrawal: KES 4,000 (400,000 minor)
    mockPrisma.withdrawal.findMany.mockResolvedValue([
      {
        id: 'wd-1',
        amount: 4000,
        amountMinorUnits: BigInt(400000),
        status: 'COMPLETED',
      },
    ])

    // Matching ledger entries:
    // TICKET_PROCEEDS: +1,000,000
    // PLATFORM_COMMISSION: -50,000
    // WITHDRAWAL_RESERVATION: -400,000
    // WITHDRAWAL_COMPLETION: 0
    mockPrisma.financialLedgerEntry.findMany.mockResolvedValue([
      {
        entryType: 'TICKET_PROCEEDS',
        direction: 'CREDIT',
        amountMinorUnits: BigInt(1000000),
      },
      {
        entryType: 'PLATFORM_COMMISSION',
        direction: 'DEBIT',
        amountMinorUnits: BigInt(50000),
      },
      {
        withdrawalId: 'wd-1',
        entryType: 'WITHDRAWAL_RESERVATION',
        direction: 'DEBIT',
        amountMinorUnits: BigInt(400000),
        idempotencyKey: 'withdrawal:wd-1:reservation',
      },
      {
        withdrawalId: 'wd-1',
        entryType: 'WITHDRAWAL_COMPLETION',
        direction: 'DEBIT',
        amountMinorUnits: BigInt(0),
        idempotencyKey: 'withdrawal:wd-1:completion',
      },
    ])

    const audit = await auditOrganizerBalanceIntegrity(organizerId, 'KES', mockPrisma as any)

    expect(audit.isCompliant).toBe(true)
    expect(audit.drift.hasDrift).toBe(false)
    expect(audit.drift.ledgerPaymentDiscrepancyMinorUnits).toBe(BigInt(0))
    expect(audit.drift.unmatchedWithdrawalReservations).toHaveLength(0)
    expect(audit.drift.unmatchedWithdrawalReleases).toHaveLength(0)

    // All 7 invariants verified
    expect(audit.invariants.entitlementConservation.holds).toBe(true)
    expect(audit.invariants.settlementPartition.holds).toBe(true)
    expect(audit.invariants.commissionRatio.holds).toBe(true)
    expect(audit.invariants.ledgerPaymentConsistency.holds).toBe(true)
    expect(audit.invariants.withdrawalLedgerSymmetry.holds).toBe(true)
    expect(audit.invariants.nonNegativeAvailable.holds).toBe(true)
    expect(audit.invariants.settledCeiling.holds).toBe(true)

    // Balance calculations
    expect(audit.summary.grossMinorUnits).toBe(BigInt(1000000))
    expect(audit.summary.commissionMinorUnits).toBe(BigInt(50000))
    expect(audit.summary.entitlementMinorUnits).toBe(BigInt(950000))
    expect(audit.summary.settledEntitlementMinorUnits).toBe(BigInt(950000))
    expect(audit.summary.completedWithdrawalsMinorUnits).toBe(BigInt(400000))
    // Available = 950,000 - 400,000 = 550,000 minor units (KES 5,500)
    expect(audit.summary.availableMinorUnits).toBe(BigInt(550000))
  })

  it('detects ledger drift when a platform commission debit is missing from ledger entries', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        amount: 2000,
        commissionAmount: 100,
        organizerAmount: 1900,
        settlementStatus: 'SETTLED',
        paidEventOrder: { currency: 'KES' },
        event: { currency: 'KES' },
      },
    ])

    mockPrisma.withdrawal.findMany.mockResolvedValue([])

    // DRIFT: Missing PLATFORM_COMMISSION debit (only TICKET_PROCEEDS posted)
    mockPrisma.financialLedgerEntry.findMany.mockResolvedValue([
      {
        entryType: 'TICKET_PROCEEDS',
        direction: 'CREDIT',
        amountMinorUnits: BigInt(200000),
      },
    ])

    const audit = await auditOrganizerBalanceIntegrity(organizerId, 'KES', mockPrisma as any)

    expect(audit.isCompliant).toBe(false)
    expect(audit.drift.hasDrift).toBe(true)
    expect(audit.invariants.ledgerPaymentConsistency.holds).toBe(false)
    // Discrepancy is exactly 10,000 minor units (KES 100 un-debited commission)
    expect(audit.drift.ledgerPaymentDiscrepancyMinorUnits).toBe(BigInt(-10000))
  })

  it('detects withdrawal ledger asymmetry when a processing withdrawal has no ledger reservation entry', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        amount: 5000,
        commissionAmount: 250,
        organizerAmount: 4750,
        settlementStatus: 'SETTLED',
        paidEventOrder: { currency: 'KES' },
        event: { currency: 'KES' },
      },
    ])

    // Active withdrawal in PROCESSING status
    mockPrisma.withdrawal.findMany.mockResolvedValue([
      {
        id: 'wd-orphan-reservation',
        amount: 1000,
        amountMinorUnits: BigInt(100000),
        status: 'PROCESSING',
      },
    ])

    // Ledger has proceeds and commission, but MISSING withdrawal reservation
    mockPrisma.financialLedgerEntry.findMany.mockResolvedValue([
      {
        entryType: 'TICKET_PROCEEDS',
        direction: 'CREDIT',
        amountMinorUnits: BigInt(500000),
      },
      {
        entryType: 'PLATFORM_COMMISSION',
        direction: 'DEBIT',
        amountMinorUnits: BigInt(25000),
      },
    ])

    const audit = await auditOrganizerBalanceIntegrity(organizerId, 'KES', mockPrisma as any)

    expect(audit.isCompliant).toBe(false)
    expect(audit.invariants.withdrawalLedgerSymmetry.holds).toBe(false)
    expect(audit.drift.unmatchedWithdrawalReservations).toContain('wd-orphan-reservation')
  })

  it('detects withdrawal release asymmetry when a failed withdrawal is missing a release credit', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        amount: 5000,
        commissionAmount: 250,
        organizerAmount: 4750,
        settlementStatus: 'SETTLED',
        paidEventOrder: { currency: 'KES' },
        event: { currency: 'KES' },
      },
    ])

    // Failed withdrawal
    mockPrisma.withdrawal.findMany.mockResolvedValue([
      {
        id: 'wd-failed-no-release',
        amount: 1000,
        amountMinorUnits: BigInt(100000),
        status: 'FAILED',
      },
    ])

    // Ledger has reservation but no WITHDRAWAL_RELEASE credit
    mockPrisma.financialLedgerEntry.findMany.mockResolvedValue([
      {
        entryType: 'TICKET_PROCEEDS',
        direction: 'CREDIT',
        amountMinorUnits: BigInt(500000),
      },
      {
        entryType: 'PLATFORM_COMMISSION',
        direction: 'DEBIT',
        amountMinorUnits: BigInt(25000),
      },
      {
        withdrawalId: 'wd-failed-no-release',
        entryType: 'WITHDRAWAL_RESERVATION',
        direction: 'DEBIT',
        amountMinorUnits: BigInt(100000),
      },
    ])

    const audit = await auditOrganizerBalanceIntegrity(organizerId, 'KES', mockPrisma as any)

    expect(audit.isCompliant).toBe(false)
    expect(audit.invariants.withdrawalLedgerSymmetry.holds).toBe(false)
    expect(audit.drift.unmatchedWithdrawalReleases).toContain('wd-failed-no-release')
  })

  it('strictly isolates unsettled payments from available withdrawable balance', async () => {
    // 2 payments:
    // 1 settled: KES 1,000 (950 entitlement)
    // 1 pending settlement: KES 4,000 (3,800 entitlement)
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        amount: 1000,
        commissionAmount: 50,
        organizerAmount: 950,
        settlementStatus: 'SETTLED',
        paidEventOrder: { currency: 'KES' },
        event: { currency: 'KES' },
      },
      {
        amount: 4000,
        commissionAmount: 200,
        organizerAmount: 3800,
        settlementStatus: 'PENDING',
        paidEventOrder: { currency: 'KES' },
        event: { currency: 'KES' },
      },
    ])

    mockPrisma.withdrawal.findMany.mockResolvedValue([])

    mockPrisma.financialLedgerEntry.findMany.mockResolvedValue([
      {
        entryType: 'TICKET_PROCEEDS',
        direction: 'CREDIT',
        amountMinorUnits: BigInt(500000),
      },
      {
        entryType: 'PLATFORM_COMMISSION',
        direction: 'DEBIT',
        amountMinorUnits: BigInt(25000),
      },
    ])

    const audit = await auditOrganizerBalanceIntegrity(organizerId, 'KES', mockPrisma as any)

    expect(audit.isCompliant).toBe(true)
    expect(audit.invariants.settlementPartition.holds).toBe(true)
    expect(audit.summary.entitlementMinorUnits).toBe(BigInt(475000))
    expect(audit.summary.settledEntitlementMinorUnits).toBe(BigInt(95000))
    // Available balance is ONLY the settled portion (95,000 minor units / KES 950)
    expect(audit.summary.availableMinorUnits).toBe(BigInt(95000))
  })
})
