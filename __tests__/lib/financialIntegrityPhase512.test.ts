/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  finalizePaidEventOrderPayment,
  resolveOvercapacityPaidOrder,
} from '@/lib/paymentFinalizers'
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist'
import {
  auditOrganizerBalanceIntegrity,
  getAuthoritativeOrganizerBalance,
} from '@/lib/organizerBalanceEngine'
import { calculatePaidEventCommission } from '@/lib/paidEventCommission'
import { sendPaidWaitlistPromotionEmail } from '@/lib/email'

jest.mock('@/lib/prisma', () => {
  const mockClient: any = {
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ticketTier: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    paidEventOrder: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    registration: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    organiserBalance: {
      upsert: jest.fn(),
    },
    withdrawal: {
      findMany: jest.fn(),
    },
    financialLedgerEntry: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
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

jest.mock('@/lib/email', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(true),
  sendWaitlistJoinedEmail: jest.fn().mockResolvedValue(true),
  sendPaidWaitlistPromotionEmail: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/capacityNotifications', () => ({
  sendEventCapacityMilestones: jest.fn().mockResolvedValue(undefined),
  sendTierCapacityMilestones: jest.fn().mockResolvedValue(undefined),
}))

describe('Phase 5.12: Financial Integrity Hardening Verification Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      if (typeof cb === 'function') return cb(prisma)
      return Promise.all(cb)
    })
  })

  describe('FIX 1 — Fail-Closed Capacity Logic in Payment Finalization', () => {
    it('throws CAPACITY_CHECK_FAILED and aborts transaction if activeHolds query fails', async () => {
      const mockOrder = {
        id: 'order-fail-closed-1',
        eventId: 'event-fc-1',
        ticketTierId: 'tier-fc-1',
        amountKes: 1500,
        currency: 'KES',
        status: 'EXPIRED',
        holdExpiresAt: new Date(Date.now() - 60000), // Hold expired
        attendeeEmail: 'buyer@example.com',
        attendeeName: 'Fail Closed Buyer',
        attendeePayload: [],
        event: {
          id: 'event-fc-1',
          title: 'Fail Closed Event',
          slug: 'fc-event',
          eventDate: new Date(),
          location: 'Virtual',
          confirmedCount: 10,
          capacity: 100,
          currency: 'KES',
          organizerId: 'org-fc-1',
          organizer: { plan: 'starter' },
        },
        ticketTier: {
          id: 'tier-fc-1',
          name: 'General',
          priceKes: 1500,
          bundleSize: 1,
          soldCount: 10,
          capacity: 100,
        },
        registrations: [],
      }

      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder)
      // Simulate database failure when querying active checkout holds
      ;(prisma.paidEventOrder.count as jest.Mock).mockRejectedValue(
        new Error('Connection pool exhausted / query timeout')
      )

      await expect(
        finalizePaidEventOrderPayment({
          orderId: 'order-fail-closed-1',
          paidAt: new Date(),
          paymentReference: 'paystack_fc_ref_1',
          providerChannel: 'CARD',
        })
      ).rejects.toThrow(/CAPACITY_CHECK_FAILED/)

      // Invariant: No tickets created, no tier soldCount updated, no ledger written
      expect(prisma.ticket.create).not.toHaveBeenCalled()
      expect(prisma.ticketTier.update).not.toHaveBeenCalled()
      expect(prisma.financialLedgerEntry.upsert).not.toHaveBeenCalled()
    })

    it('correctly transitions late payment to OVERCAPACITY_PAID when capacity is genuinely exceeded', async () => {
      const mockOrder = {
        id: 'order-overcap-1',
        eventId: 'event-overcap-1',
        ticketTierId: 'tier-overcap-1',
        amountKes: 2000,
        currency: 'KES',
        status: 'EXPIRED',
        holdExpiresAt: new Date(Date.now() - 3600000),
        attendeeEmail: 'overcapacity@example.com',
        attendeeName: 'Late Attendee',
        attendeePayload: [],
        event: {
          id: 'event-overcap-1',
          title: 'Full Event',
          slug: 'full-event',
          eventDate: new Date(),
          location: 'Auditorium',
          confirmedCount: 50,
          capacity: 50,
          currency: 'KES',
          organizerId: 'org-oc-1',
          organizer: { plan: 'free' },
        },
        ticketTier: {
          id: 'tier-overcap-1',
          name: 'VIP',
          priceKes: 2000,
          bundleSize: 1,
          soldCount: 50,
          capacity: 50, // Capacity completely filled
        },
        registrations: [],
      }

      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder)
      ;(prisma.paidEventOrder.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.ticketTier.findUnique as jest.Mock).mockResolvedValue({
        id: 'tier-overcap-1',
        capacity: 50,
        soldCount: 50,
      })

      const result = await finalizePaidEventOrderPayment({
        orderId: 'order-overcap-1',
        paidAt: new Date(),
        paymentReference: 'paystack_oc_ref_1',
      })

      expect(result.status).toBe('OVERCAPACITY_PAID')
      expect(prisma.ticket.create).not.toHaveBeenCalled()
      expect(prisma.ticketTier.update).not.toHaveBeenCalled()
      expect(prisma.paidEventOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-overcap-1' },
          data: expect.objectContaining({
            status: 'OVERCAPACITY_PAID',
            fulfillmentStatus: 'OVERCAPACITY_HOLD',
          }),
        })
      )
    })
  })

  describe('FIX 2 — Atomic Waitlist Promotion & Concurrency Protection', () => {
    it('atomically locks TicketTier and promotes next waitlisted candidate when capacity exists', async () => {
      const mockEvent = {
        id: 'event-wl-1',
        slug: 'wl-event',
        title: 'Tech Summit',
        eventDate: new Date(),
        organizer: { plan: 'pro' },
        ticketTiers: [
          {
            id: 'tier-wl-1',
            name: 'Standard',
            priceKes: 1000,
            capacity: 20,
            soldCount: 15,
            waitlistCount: 2,
          },
        ],
      }

      const mockCandidate = {
        id: 'reg-wl-cand-1',
        attendeeEmail: 'nextinlinewl@example.com',
        answers: [{ questionId: 'q1', value: 'Jane Doe' }],
        waitlistPosition: 1,
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.paidEventOrder.count as jest.Mock).mockResolvedValue(2) // 2 active holds -> 20 - 15 - 2 = 3 available!
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(mockCandidate)
      ;(prisma.paidEventOrder.create as jest.Mock).mockResolvedValue({ id: 'order-promoted-1' })
      ;(prisma.registration.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

      const promotedOrderId = await offerNextPaidWaitlistSpot('event-wl-1', 'tier-wl-1')

      expect(promotedOrderId).toBe('order-promoted-1')
      // Row lock query executed
      expect(prisma.$queryRaw).toHaveBeenCalled()
      // Candidate atomically transitioned to waitlist-payment-pending
      expect(prisma.registration.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reg-wl-cand-1', status: 'waitlist' },
          data: { status: 'waitlist-payment-pending', waitlistPosition: null },
        })
      )
      // Promotion email sent post-commit
      expect(sendPaidWaitlistPromotionEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'nextinlinewl@example.com',
          priceKes: 1000,
        })
      )
    })

    it('returns null and leaves candidate untouched when remaining capacity is zero or negative', async () => {
      const mockEvent = {
        id: 'event-wl-full',
        slug: 'wl-full',
        title: 'Sold Out Conf',
        eventDate: new Date(),
        organizer: { plan: 'starter' },
        ticketTiers: [
          {
            id: 'tier-wl-full',
            name: 'Standard',
            priceKes: 1000,
            capacity: 10,
            soldCount: 8,
            waitlistCount: 5,
          },
        ],
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      // 2 active holds + 8 sold = 10 capacity filled
      ;(prisma.paidEventOrder.count as jest.Mock).mockResolvedValue(2)

      const outcome = await offerNextPaidWaitlistSpot('event-wl-full', 'tier-wl-full')

      expect(outcome).toBeNull()
      expect(prisma.paidEventOrder.create).not.toHaveBeenCalled()
      expect(prisma.registration.updateMany).not.toHaveBeenCalled()
      expect(sendPaidWaitlistPromotionEmail).not.toHaveBeenCalled()
    })

    it('gracefully handles race condition when candidate is concurrently promoted by another transaction', async () => {
      const mockEvent = {
        id: 'event-wl-race',
        slug: 'wl-race',
        title: 'Racing Conf',
        eventDate: new Date(),
        organizer: { plan: 'starter' },
        ticketTiers: [
          {
            id: 'tier-wl-race',
            name: 'Standard',
            priceKes: 1000,
            capacity: 20,
            soldCount: 10,
            waitlistCount: 3,
          },
        ],
      }

      const mockCandidate = {
        id: 'reg-wl-racing',
        attendeeEmail: 'racing@example.com',
        answers: [],
        waitlistPosition: 1,
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.paidEventOrder.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(mockCandidate)
      ;(prisma.paidEventOrder.create as jest.Mock).mockResolvedValue({ id: 'order-racing' })

      // Simulate concurrent update claiming candidate first: updateMany affects 0 rows
      ;(prisma.registration.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

      const outcome = await offerNextPaidWaitlistSpot('event-wl-race', 'tier-wl-race')

      // Must catch WAITLIST_CANDIDATE_ALREADY_PROMOTED and return null gracefully
      expect(outcome).toBeNull()
      expect(sendPaidWaitlistPromotionEmail).not.toHaveBeenCalled()
    })
  })

  describe('FIX 3 — Exact Production Commission Auditor & Micro-Ticket Rounding', () => {
    it('passes audit with exactly zero discrepancy for single standard payment', async () => {
      const mockPayments = [
        {
          amount: 5000,
          commissionAmount: 250, // 5% of 5,000 = 250
          organizerAmount: 4750,
          settlementStatus: 'SETTLED',
          paidEventOrder: { currency: 'KES' },
          event: { currency: 'KES' },
        },
      ]

      const mockWithdrawals: any[] = []
      const mockLedgerEntries = [
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
      ]

      const mockPrismaTx: any = {
        payment: { findMany: jest.fn().mockResolvedValue(mockPayments) },
        withdrawal: { findMany: jest.fn().mockResolvedValue(mockWithdrawals) },
        financialLedgerEntry: { findMany: jest.fn().mockResolvedValue(mockLedgerEntries) },
      }

      const audit = await auditOrganizerBalanceIntegrity('org-std', 'KES', mockPrismaTx)

      expect(audit.isCompliant).toBe(true)
      expect(audit.invariants.commissionRatio.holds).toBe(true)
      expect(audit.summary.commissionMinorUnits).toBe(BigInt(25000))
      expect(audit.summary.expectedCommissionMinorUnits).toBe(BigInt(25000))
      expect(audit.drift.hasDrift).toBe(false)
    })

    it('guarantees 100% zero-drift compliance on 100 micro-tickets with half-shilling commission rounding', async () => {
      // Micro-ticket: KES 30.
      // 5% of 30 KES = 1.5 KES -> Math.round(1.5) = 2 KES (200 minor units).
      // Organizer amount = 28 KES (2800 minor units).
      // If calculated as 5% of aggregate 3,000 KES = 150 KES.
      // Sum of individual production commissions = 100 * 2 = 200 KES (20,000 minor units).
      // The updated auditor computes exact sum of per-payment production commissions, yielding 0 drift!
      const count = 100
      const ticketPrice = 30
      const commCalc = calculatePaidEventCommission(ticketPrice) // commissionAmount = 2, organizerAmount = 28

      expect(commCalc.commissionAmount).toBe(2)
      expect(commCalc.organizerAmount).toBe(28)

      const payments = Array.from({ length: count }, () => ({
        amount: ticketPrice,
        commissionAmount: commCalc.commissionAmount,
        organizerAmount: commCalc.organizerAmount,
        settlementStatus: 'SETTLED',
        paidEventOrder: { currency: 'KES' },
        event: { currency: 'KES' },
      }))

      const ledgerEntries: any[] = []
      let totalProceedsMinor = BigInt(0)
      let totalCommMinor = BigInt(0)

      for (let i = 0; i < count; i++) {
        const proceeds = BigInt(ticketPrice * 100)
        const comm = BigInt(commCalc.commissionAmount * 100)
        totalProceedsMinor += proceeds
        totalCommMinor += comm
        ledgerEntries.push({
          entryType: 'TICKET_PROCEEDS',
          direction: 'CREDIT',
          amountMinorUnits: proceeds,
        })
        ledgerEntries.push({
          entryType: 'PLATFORM_COMMISSION',
          direction: 'DEBIT',
          amountMinorUnits: comm,
        })
      }

      const mockPrismaTx: any = {
        payment: { findMany: jest.fn().mockResolvedValue(payments) },
        withdrawal: { findMany: jest.fn().mockResolvedValue([]) },
        financialLedgerEntry: { findMany: jest.fn().mockResolvedValue(ledgerEntries) },
      }

      const audit = await auditOrganizerBalanceIntegrity('org-micro-batch', 'KES', mockPrismaTx)

      expect(audit.isCompliant).toBe(true)
      expect(audit.invariants.commissionRatio.holds).toBe(true)
      expect(audit.invariants.entitlementConservation.holds).toBe(true)
      expect(audit.summary.grossMinorUnits).toBe(BigInt(300000))
      expect(audit.summary.commissionMinorUnits).toBe(BigInt(20000))
      expect(audit.summary.expectedCommissionMinorUnits).toBe(BigInt(20000))
      expect(audit.summary.entitlementMinorUnits).toBe(BigInt(280000))
      expect(audit.drift.hasDrift).toBe(false)
    })

    it('strictly detects and flags discrepancy if ledger commission deviates by even 1 minor unit', async () => {
      const mockPayments = [
        {
          amount: 1000,
          commissionAmount: 51, // Tampered: 51 instead of 50
          organizerAmount: 949,
          settlementStatus: 'SETTLED',
          paidEventOrder: { currency: 'KES' },
          event: { currency: 'KES' },
        },
      ]

      const mockLedgerEntries = [
        {
          entryType: 'TICKET_PROCEEDS',
          direction: 'CREDIT',
          amountMinorUnits: BigInt(100000),
        },
        {
          entryType: 'PLATFORM_COMMISSION',
          direction: 'DEBIT',
          amountMinorUnits: BigInt(5100),
        },
      ]

      const mockPrismaTx: any = {
        payment: { findMany: jest.fn().mockResolvedValue(mockPayments) },
        withdrawal: { findMany: jest.fn().mockResolvedValue([]) },
        financialLedgerEntry: { findMany: jest.fn().mockResolvedValue(mockLedgerEntries) },
      }

      const audit = await auditOrganizerBalanceIntegrity('org-tampered', 'KES', mockPrismaTx)

      expect(audit.isCompliant).toBe(false)
      expect(audit.invariants.commissionRatio.holds).toBe(false)
      expect(audit.summary.commissionMinorUnits).toBe(BigInt(5100))
      expect(audit.summary.expectedCommissionMinorUnits).toBe(BigInt(5000)) // Expected is exactly 5000
    })
  })

  describe('FIX 4 — Verified Refund State Machine in Overcapacity Resolution', () => {
    it('transitions to REFUND_PENDING_PROVIDER without marking order or payment as REFUNDED when provider reference is missing', async () => {
      const mockOrder = {
        id: 'order-refund-pending-1',
        status: 'OVERCAPACITY_PAID',
        fulfillmentStatus: 'OVERCAPACITY_PENDING_ACTION',
        amountKes: 3000,
        payments: [{ id: 'pay-pending-1', status: 'PAID' }],
      }

      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder)

      const result = await resolveOvercapacityPaidOrder({
        orderId: 'order-refund-pending-1',
        resolution: 'MANUAL_REFUND',
        actorId: 'admin-user-1',
        notes: 'Customer requested refund via email support',
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('OVERCAPACITY_PAID')
      expect(result.fulfillmentStatus).toBe('REFUND_PENDING_PROVIDER')
      expect((result as any).requiresProviderConfirmation).toBe(true)

      // Invariants: Order status is NOT REFUNDED, Payment is NOT touched
      expect(prisma.paidEventOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-refund-pending-1' },
          data: expect.objectContaining({
            fulfillmentStatus: 'REFUND_PENDING_PROVIDER',
          }),
        })
      )
      expect(prisma.payment.updateMany).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ORDER_OVERCAPACITY_REFUND_REQUESTED',
          }),
        })
      )
    })

    it('rejects short or blank provider refund reference (< 3 characters)', async () => {
      const mockOrder = {
        id: 'order-invalid-ref',
        status: 'OVERCAPACITY_PAID',
        fulfillmentStatus: 'OVERCAPACITY_PENDING_ACTION',
        amountKes: 1000,
      }

      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder)

      const result = await resolveOvercapacityPaidOrder({
        orderId: 'order-invalid-ref',
        resolution: 'MANUAL_REFUND',
        actorId: 'admin-user-1',
        providerRefundReference: 'ab', // Too short
      })

      expect(result.success).toBe(false)
      expect((result as any).error).toMatch(/valid providerRefundReference of at least 3 characters/)
    })

    it('transitions order to REFUNDED and payment to settlementStatus REVERSED when valid provider reference is provided', async () => {
      const mockOrder = {
        id: 'order-refund-confirmed-1',
        status: 'OVERCAPACITY_PAID',
        fulfillmentStatus: 'REFUND_PENDING_PROVIDER',
        amountKes: 5000,
      }

      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder)

      const result = await resolveOvercapacityPaidOrder({
        orderId: 'order-refund-confirmed-1',
        resolution: 'MANUAL_REFUND',
        actorId: 'admin-user-2',
        providerRefundReference: 'pstk_ref_rev_987654',
        refundMetadata: { channel: 'card', bankRef: 'BKN-112233' },
        notes: 'Dispatched through Paystack dashboard',
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('REFUNDED')
      expect(result.fulfillmentStatus).toBe('REFUNDED')
      expect((result as any).providerRefundReference).toBe('pstk_ref_rev_987654')

      expect(prisma.paidEventOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-refund-confirmed-1' },
          data: expect.objectContaining({
            status: 'REFUNDED',
            fulfillmentStatus: 'REFUNDED',
          }),
        })
      )

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { paidEventOrderId: 'order-refund-confirmed-1' },
          data: {
            status: 'REFUNDED',
            settlementStatus: 'REVERSED',
          },
        })
      )

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ORDER_OVERCAPACITY_MANUAL_REFUND',
            metadata: expect.objectContaining({
              providerRefundReference: 'pstk_ref_rev_987654',
            }),
          }),
        })
      )
    })

    it('idempotently handles duplicate calls on already refunded orders without duplicate execution', async () => {
      const mockOrder = {
        id: 'order-already-refunded',
        status: 'REFUNDED',
        fulfillmentStatus: 'REFUNDED',
        amountKes: 2500,
        resolvedAt: new Date('2026-10-20T10:00:00Z'),
        resolutionNotes: 'Refund confirmed via provider ref: pstk_ref_123',
      }

      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder)

      const result = await resolveOvercapacityPaidOrder({
        orderId: 'order-already-refunded',
        resolution: 'MANUAL_REFUND',
        actorId: 'admin-user-3',
        providerRefundReference: 'pstk_ref_123',
      })

      expect(result.success).toBe(true)
      expect(result.duplicate).toBe(true)
      expect(result.status).toBe('REFUNDED')
      expect(result.fulfillmentStatus).toBe('REFUNDED')

      // Database should NOT be mutated on duplicate call
      expect(prisma.paidEventOrder.update).not.toHaveBeenCalled()
      expect(prisma.payment.updateMany).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })
  })
})
