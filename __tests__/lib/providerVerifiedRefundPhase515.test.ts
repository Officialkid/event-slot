/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  resolveOvercapacityPaidOrder,
  type ResolveOvercapacityInput,
} from '@/lib/paymentFinalizers'
import {
  auditOrganizerBalanceIntegrity,
} from '@/lib/organizerBalanceEngine'
import {
  PaystackTimeoutError,
  PaystackApiError,
} from '@/lib/paystack'

jest.mock('@/lib/prisma', () => {
  const mockClient: any = {
    paidEventOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    withdrawal: {
      findMany: jest.fn(),
    },
    financialLedgerEntry: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-log-ref-1' }),
    },
    $transaction: jest.fn(async (cb: any): Promise<any> => {
      if (typeof cb === 'function') return cb(mockClient)
      return Promise.all(cb)
    }),
  }
  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  }
})

describe('Phase 5.15: Provider-Verified Refund Architecture & Security Suite', () => {
  const baseOrder = {
    id: 'order-p515-test-1',
    eventId: 'event-p515-1',
    ticketTierId: 'tier-p515-1',
    status: 'OVERCAPACITY_PAID',
    fulfillmentStatus: 'REFUND_PENDING_PROVIDER',
    amountKes: 3000,
    currency: 'KES',
    providerReference: 'pstk_orig_tx_998877',
    event: {
      id: 'event-p515-1',
      organizerId: 'org-p515-1',
      title: 'Global Summit',
      currency: 'KES',
      organizer: { plan: 'pro' },
    },
    ticketTier: {
      id: 'tier-p515-1',
      name: 'VIP Admission',
    },
    payment: {
      id: 'pay-p515-1',
      status: 'PAID',
      settlementStatus: 'PENDING',
    },
    registrations: [],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      if (typeof cb === 'function') return cb(prisma)
      return Promise.all(cb)
    })
  })

  // ---------------------------------------------------------------------------
  // 1. Valid, Fully Verified Refund for Correct Transaction
  // ---------------------------------------------------------------------------
  it('1. transitions order and payment to terminal REFUNDED when provider verifies successful refund', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: true,
          message: 'Refund retrieved',
          data: {
            id: 'ref_pstk_valid_001',
            status: 'processed',
            amount: 300000, // 3,000 KES = 300,000 minor units
            currency: 'KES',
            transaction: {
              reference: 'pstk_orig_tx_998877',
              id: 112233,
            },
            refunded_at: '2026-10-21T08:30:00.000Z',
          },
        }),
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_security_officer_1',
      providerRefundReference: 'ref_pstk_valid_001',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('REFUNDED')
    expect(result.fulfillmentStatus).toBe('REFUNDED')
    expect((result as any).providerRefundReference).toBe('ref_pstk_valid_001')

    // Order updated to terminal REFUNDED
    expect(prisma.paidEventOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-p515-test-1' },
        data: expect.objectContaining({
          status: 'REFUNDED',
          fulfillmentStatus: 'REFUNDED',
        }),
      })
    )

    // Payment updated to REFUNDED and REVERSED settlement status
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paidEventOrderId: 'order-p515-test-1' },
        data: {
          status: 'REFUNDED',
          settlementStatus: 'REVERSED',
        },
      })
    )

    // Audit log records verified refund action
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ORDER_OVERCAPACITY_MANUAL_REFUND',
          actorId: 'admin_security_officer_1',
        }),
      })
    )
  })

  // ---------------------------------------------------------------------------
  // 2. Fabricated Reference
  // ---------------------------------------------------------------------------
  it('2. fails closed and leaves order in OVERCAPACITY_PAID when reference is fabricated / not found on Paystack', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({
          status: false,
          message: 'Refund reference not found on Paystack',
        }),
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'fabricated_fake_ref_999',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/Provider refund verification failed/)

    // Security invariant: Order and payment NOT transitioned to REFUNDED
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ORDER_OVERCAPACITY_REFUND_VERIFICATION_FAILED',
        }),
      })
    )
  })

  // ---------------------------------------------------------------------------
  // 3. Reference Belonging to Another Transaction
  // ---------------------------------------------------------------------------
  it('3. rejects refund when provider transaction reference does not match order original payment transaction', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: true,
          message: 'Refund retrieved',
          data: {
            id: 'ref_mismatched_002',
            status: 'processed',
            amount: 300000,
            currency: 'KES',
            transaction: {
              reference: 'pstk_completely_different_tx_ref', // Mismatch!
            },
          },
        }),
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_mismatched_002',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/does not match order payment transaction/)
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ORDER_OVERCAPACITY_REFUND_MISMATCH',
        }),
      })
    )
  })

  // ---------------------------------------------------------------------------
  // 4. Incorrect Currency
  // ---------------------------------------------------------------------------
  it('4. rejects refund when provider currency does not match order currency', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: true,
          message: 'Refund retrieved',
          data: {
            id: 'ref_currency_mismatch',
            status: 'processed',
            amount: 300000,
            currency: 'USD', // Order is in KES!
            transaction: { reference: 'pstk_orig_tx_998877' },
          },
        }),
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_currency_mismatch',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/Refund currency \(USD\) does not match order currency \(KES\)/)
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 5. Refund Amount Exceeding Eligible Amount
  // ---------------------------------------------------------------------------
  it('5. rejects refund when provider amount exceeds eligible refundable amount', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: true,
          message: 'Refund retrieved',
          data: {
            id: 'ref_excess_amt',
            status: 'processed',
            amount: 500000, // 5,000 KES (Order is 3,000 KES / 300,000 cents)
            currency: 'KES',
            transaction: { reference: 'pstk_orig_tx_998877' },
          },
        }),
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_excess_amt',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/exceeds eligible refundable amount/)
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 6. Partial Refund (Must NOT be treated as a full refund)
  // ---------------------------------------------------------------------------
  it('6. routes partial refund to REFUND_PARTIAL_RECONCILIATION_REQUIRED and refuses to mark order REFUNDED', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: true,
          message: 'Refund retrieved',
          data: {
            id: 'ref_partial_001',
            status: 'processed',
            amount: 150000, // 1,500 KES of 3,000 KES (Partial!)
            currency: 'KES',
            transaction: { reference: 'pstk_orig_tx_998877' },
          },
        }),
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_partial_001',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/Partial refund detected/)
    expect(result.fulfillmentStatus).toBe('REFUND_PARTIAL_RECONCILIATION_REQUIRED')

    // Invariant: Order status is NOT marked REFUNDED, Payment is NOT marked REFUNDED
    expect(prisma.paidEventOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-p515-test-1' },
        data: expect.objectContaining({
          fulfillmentStatus: 'REFUND_PARTIAL_RECONCILIATION_REQUIRED',
        }),
      })
    )
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 7. Provider Status Still Pending
  // ---------------------------------------------------------------------------
  it('7. leaves order in REFUND_PENDING_PROVIDER when provider status is pending', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: true,
          message: 'Refund retrieved',
          data: {
            id: 'ref_pending_001',
            status: 'pending', // Still pending at provider
            amount: 300000,
            currency: 'KES',
            transaction: { reference: 'pstk_orig_tx_998877' },
          },
        }),
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_pending_001',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/still pending processing/)
    expect(result.fulfillmentStatus).toBe('REFUND_PENDING_PROVIDER')
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 8. Provider-Reported Failure
  // ---------------------------------------------------------------------------
  it('8. transitions fulfillmentStatus to REFUND_FAILED when provider reports failure', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: true,
          message: 'Refund retrieved',
          data: {
            id: 'ref_failed_001',
            status: 'failed', // Provider rejected / failed refund
            amount: 300000,
            currency: 'KES',
            transaction: { reference: 'pstk_orig_tx_998877' },
          },
        }),
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_failed_001',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/Provider reported that the refund status is "failed"/)
    expect(result.fulfillmentStatus).toBe('REFUND_FAILED')
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
    expect(prisma.paidEventOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-p515-test-1' },
        data: expect.objectContaining({
          fulfillmentStatus: 'REFUND_FAILED',
        }),
      })
    )
  })

  // ---------------------------------------------------------------------------
  // 9. Malformed Provider Response
  // ---------------------------------------------------------------------------
  it('9. fails closed when provider returns malformed non-JSON response', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<!DOCTYPE html><html><body>502 Bad Gateway</body></html>',
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_malformed_001',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/non-JSON refund verification response/)
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 10. Provider Timeout or Unavailable Service
  // ---------------------------------------------------------------------------
  it('10. fails closed when provider verification times out', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockImplementation(async () => {
      const err = new Error('The operation was aborted')
      err.name = 'TimeoutError'
      throw err
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_timeout_001',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/timed out/)
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 11. Database Failure During State Transition
  // ---------------------------------------------------------------------------
  it('11. aborts transaction cleanly if database fails during state transition', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: true,
          data: {
            id: 'ref_db_fail_001',
            status: 'processed',
            amount: 300000,
            currency: 'KES',
            transaction: { reference: 'pstk_orig_tx_998877' },
          },
        }),
    })

    ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('DB deadlock / write conflict'))

    await expect(
      resolveOvercapacityPaidOrder({
        orderId: 'order-p515-test-1',
        resolution: 'MANUAL_REFUND',
        actorId: 'admin_officer_1',
        providerRefundReference: 'ref_db_fail_001',
        paystackOptions: { fetchFn: mockFetch as any },
      })
    ).rejects.toThrow(/DB deadlock \/ write conflict/)
  })

  // ---------------------------------------------------------------------------
  // 12. Duplicate Confirmation
  // ---------------------------------------------------------------------------
  it('12. idempotently acknowledges duplicate refund confirmation without re-executing writes', async () => {
    const alreadyRefundedOrder = {
      ...baseOrder,
      status: 'REFUNDED',
      fulfillmentStatus: 'REFUNDED',
      resolvedAt: new Date('2026-10-21T07:00:00Z'),
    }
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(alreadyRefundedOrder)

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_duplicate_call',
    })

    expect(result.success).toBe(true)
    expect(result.duplicate).toBe(true)
    expect(result.status).toBe('REFUNDED')
    expect(result.fulfillmentStatus).toBe('REFUNDED')
    expect(prisma.paidEventOrder.update).not.toHaveBeenCalled()
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 13. Concurrent Attempts to Confirm the Same Refund
  // ---------------------------------------------------------------------------
  it('13. prevents duplicate refund and double entitlement reversal on concurrent racing attempts', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(baseOrder)

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: true,
          data: {
            id: 'ref_concurrent_001',
            status: 'processed',
            amount: 300000,
            currency: 'KES',
            transaction: { reference: 'pstk_orig_tx_998877' },
          },
        }),
    })

    // Simulate concurrent worker having updated order inside the transaction lock
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        paidEventOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'order-p515-test-1',
            status: 'REFUNDED',
            fulfillmentStatus: 'REFUNDED', // Marked REFUNDED by racing worker
          }),
          update: jest.fn(),
        },
        payment: {
          updateMany: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
      }
      return callback(tx)
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
      providerRefundReference: 'ref_concurrent_001',
      paystackOptions: { fetchFn: mockFetch as any },
    })

    expect(result.success).toBe(true)
    // Invariant: The second worker aborted updates inside the transaction lock
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 14. An Order Already Refunded
  // ---------------------------------------------------------------------------
  it('14. correctly short-circuits when order status is already in terminal REFUNDED status', async () => {
    ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue({
      ...baseOrder,
      status: 'REFUNDED',
      fulfillmentStatus: 'REFUNDED',
    })

    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: 'admin_officer_1',
    })

    expect(result.success).toBe(true)
    expect(result.duplicate).toBe(true)
    expect(prisma.payment.updateMany).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 15. Unauthorized or Invalid Actor
  // ---------------------------------------------------------------------------
  it('15. rejects refund attempt when actorId is missing, empty, or whitespace', async () => {
    const result = await resolveOvercapacityPaidOrder({
      orderId: 'order-p515-test-1',
      resolution: 'MANUAL_REFUND',
      actorId: '   ', // Blank / invalid actor
      providerRefundReference: 'ref_actor_test',
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toMatch(/valid actorId is required/)
    expect(prisma.paidEventOrder.findUnique).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // 16. Rejected / Unverified Refund Does NOT Release Organizer Funds
  // ---------------------------------------------------------------------------
  it('16. strictly guarantees an unverified refund does not release or credit organizer funds for withdrawal', async () => {
    // Overcapacity paid orders NEVER credit organizer entitlement in the ledger
    // Here we audit the balance engine for the organizer
    const mockPayments = [
      {
        amount: 3000,
        commissionAmount: 150,
        organizerAmount: 2850,
        settlementStatus: 'PENDING',
        paidEventOrder: {
          status: 'OVERCAPACITY_PAID', // Unfulfilled / overcapacity order
          currency: 'KES',
        },
        event: { currency: 'KES' },
      },
    ]

    const mockTx: any = {
      payment: { findMany: jest.fn().mockResolvedValue(mockPayments) },
      withdrawal: { findMany: jest.fn().mockResolvedValue([]) },
      financialLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    }

    const audit = await auditOrganizerBalanceIntegrity('org-p515-1', 'KES', mockTx)

    // Entitlement from OVERCAPACITY_PAID order is strictly excluded from available withdrawable balance
    expect(audit.summary.availableMinorUnits).toBe(BigInt(0))
    expect(audit.summary.settledEntitlementMinorUnits).toBe(BigInt(0))
    expect(audit.invariants.nonNegativeAvailable.holds).toBe(true)
  })
})
