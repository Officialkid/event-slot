/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  finalizePaidEventOrderPayment,
  resolveOvercapacityPaidOrder,
} from '@/lib/paymentFinalizers'
import { dispatchPaystackWebhook } from '@/lib/paystackWebhookDispatcher'
import crypto from 'crypto'

jest.mock('@/lib/prisma', () => {
  const mockClient = {
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
    },
    payment: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    registration: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
    financialLedgerEntry: {
      count: jest.fn(),
      upsert: jest.fn(),
    },
    processedProviderEvent: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    withdrawal: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tokenTransaction: {
      findFirst: jest.fn(),
    },
    creditTransaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  }
  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  }
})

jest.mock('@/lib/email', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendWaitlistJoinedEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/capacityNotifications', () => ({
  sendEventCapacityMilestones: jest.fn().mockResolvedValue(undefined),
  sendTierCapacityMilestones: jest.fn().mockResolvedValue(undefined),
}))

function computePaystackSignature(payload: string, secret: string) {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex')
}

describe('Phase 4.2: Payment Truth, Webhook Recovery & Balance Reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_key_12345'
    process.env.NEXTAUTH_URL = 'https://www.eventsslot.com'
  })

  describe('1. Payment Truth vs Order Fulfillment Exception', () => {
    it('records provider payment as SUCCESS but order as OVERCAPACITY_PAID with zero organizer credit', async () => {
      const mockOrder = {
        id: 'order-late-full',
        eventId: 'event-100',
        ticketTierId: 'tier-100',
        amountKes: 5000,
        currency: 'KES',
        status: 'EXPIRED',
        holdExpiresAt: new Date(Date.now() - 600000), // Hold expired 10m ago
        attendeeEmail: 'buyer@example.com',
        attendeeName: 'Buyer',
        attendeePayload: [],
        event: {
          id: 'event-100',
          title: 'Summit',
          slug: 'summit',
          currency: 'KES',
          organizerId: 'org-100',
          organizer: { plan: 'growth' },
          confirmedCount: 50,
          capacity: 50,
        },
        ticketTier: {
          id: 'tier-100',
          name: 'VIP Pass',
          capacity: 50,
          soldCount: 50, // Capacity exhausted
          bundleSize: 1,
        },
        registrations: [],
      }

      let paymentUpdatedData: any = null
      let orderUpdatedData: any = null
      let ledgerEntriesPosted = 0
      let ticketsCreated = 0

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          paidEventOrder: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockImplementation((args) => {
              orderUpdatedData = args.data
              return { ...mockOrder, ...args.data }
            }),
          },
          ticketTier: {
            findUnique: jest.fn().mockResolvedValue({ id: 'tier-100', capacity: 50, soldCount: 50 }),
            update: jest.fn(),
          },
          event: { update: jest.fn() },
          registration: { create: jest.fn() },
          ticket: {
            create: jest.fn().mockImplementation(() => {
              ticketsCreated++
            }),
          },
          payment: {
            updateMany: jest.fn().mockImplementation((args) => {
              paymentUpdatedData = args.data
              return { count: 1 }
            }),
          },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation(() => {
              ledgerEntriesPosted++
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
          },
        }
        return callback(tx)
      })

      const res = await finalizePaidEventOrderPayment('order-late-full', 'paystack_tx_ref_999')

      // A. Order outcome
      expect(res.status).toBe('OVERCAPACITY_PAID')
      expect(orderUpdatedData.status).toBe('OVERCAPACITY_PAID')
      expect(orderUpdatedData.fulfillmentStatus).toBe('OVERCAPACITY_HOLD')
      expect(orderUpdatedData.providerReference).toBe('paystack_tx_ref_999')

      // B. Payment truth: payment SUCCEEDED on Paystack, must NOT be marked FAILED
      expect(paymentUpdatedData.status).toBe('SUCCESS')
      expect(paymentUpdatedData.amount).toBe(5000)
      expect(paymentUpdatedData.organizerAmount).toBe(0)
      expect(paymentUpdatedData.commissionAmount).toBe(0)
      expect(paymentUpdatedData.mpesaRef).toBe('paystack_tx_ref_999')

      // C. Zero tickets issued & zero ledger proceeds posted
      expect(ticketsCreated).toBe(0)
      expect(ledgerEntriesPosted).toBe(0)
    })
  })

  describe('2. Auditable Exception Resolution (resolveOvercapacityPaidOrder)', () => {
    it('idempotently marks an overcapacity order as REFUNDED without calling Paystack Refund API', async () => {
      const mockOrder = {
        id: 'order-to-refund',
        eventId: 'event-100',
        ticketTierId: 'tier-100',
        amountKes: 5000,
        currency: 'KES',
        status: 'OVERCAPACITY_PAID',
        fulfillmentStatus: 'OVERCAPACITY_HOLD',
        event: { id: 'event-100', organizerId: 'org-1', title: 'Summit', currency: 'KES', organizer: { plan: 'free' } },
        ticketTier: { id: 'tier-100', name: 'VIP' },
        registrations: [],
      }

      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder)

      let updatedOrderStatus = ''
      let updatedPaymentStatus = ''
      let auditAction = ''

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          paidEventOrder: {
            update: jest.fn().mockImplementation((args) => {
              updatedOrderStatus = args.data.status
              return { ...mockOrder, ...args.data }
            }),
          },
          payment: {
            updateMany: jest.fn().mockImplementation((args) => {
              updatedPaymentStatus = args.data.status
              return { count: 1 }
            }),
          },
          auditLog: {
            create: jest.fn().mockImplementation((args) => {
              auditAction = args.data.action
              return { id: 'audit-1' }
            }),
          },
        }
        return callback(tx)
      })

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            status: true,
            message: 'Refund retrieved',
            data: {
              id: 'pstk_manual_ref_123',
              status: 'processed',
              amount: 500000,
              currency: 'KES',
            },
          }),
      })

      const res = await resolveOvercapacityPaidOrder({
        orderId: 'order-to-refund',
        resolution: 'MANUAL_REFUND',
        notes: 'Customer opted for bank refund through support',
        actorId: 'admin-user-1',
        providerRefundReference: 'pstk_manual_ref_123',
        paystackOptions: { fetchFn: mockFetch as any },
      })

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.status).toBe('REFUNDED')
      }
      expect(updatedOrderStatus).toBe('REFUNDED')
      expect(updatedPaymentStatus).toBe('REFUNDED')
      expect(auditAction).toBe('ORDER_OVERCAPACITY_MANUAL_REFUND')
    })

    it('returns duplicate: true without re-executing when order is already resolved', async () => {
      const alreadyResolvedOrder = {
        id: 'order-already-refunded',
        status: 'OVERCAPACITY_PAID',
        fulfillmentStatus: 'REFUNDED',
        resolvedAt: new Date(),
        event: { id: 'event-100' },
      }

      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue(alreadyResolvedOrder)

      const res = await resolveOvercapacityPaidOrder({
        orderId: 'order-already-refunded',
        resolution: 'MANUAL_REFUND',
        actorId: 'admin-1',
      })

      expect(res.success).toBe(true)
      expect((res as any).duplicate).toBe(true)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('3. Webhook Distributed Lease Acquisition & Crash Recovery', () => {
    it('does NOT acknowledge 200 while active worker is in progress; returns 503 to ensure Paystack retry', async () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        id: 112233,
        data: {
          reference: 'pes_ref_concurrent_1',
          amount: 200000,
          currency: 'KES',
        },
      })
      const signature = computePaystackSignature(payload, 'sk_test_mock_secret_key_12345')

      // Record currently locked in PROCESSING with recent timestamp (< 60s)
      const inProgressRecord = {
        id: 'event-rec-1',
        status: 'PROCESSING',
        lastAttemptAt: new Date(Date.now() - 5000), // 5 seconds ago
        firstSeenAt: new Date(Date.now() - 5000),
      }

      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValue(inProgressRecord)

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature,
      })

      // Must NOT return 200 before durable completion is proven!
      expect(res.status).toBe(503)
      expect(res.body.message).toMatch(/in progress by another worker/i)
    })

    it('reclaims stale lease via atomic updateMany when previous worker crashed (> 60s ago)', async () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        id: 445566,
        data: {
          reference: 'pes_ref_crashed_1',
          amount: 200000,
          currency: 'KES',
          metadata: {
            orderId: 'order-recovered-1',
          },
        },
      })
      const signature = computePaystackSignature(payload, 'sk_test_mock_secret_key_12345')

      // Stale record: worker crashed 3 minutes ago
      const staleRecord = {
        id: 'event-rec-stale',
        status: 'PROCESSING',
        lastAttemptAt: new Date(Date.now() - 180000),
        firstSeenAt: new Date(Date.now() - 180000),
      }

      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValue(staleRecord)
      ;(prisma.processedProviderEvent.updateMany as jest.Mock).mockResolvedValue({ count: 1 }) // Lease acquired!
      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-recovered-1',
        amountKes: 2000,
        currency: 'KES',
        status: 'PENDING',
      })
      ;(prisma.processedProviderEvent.update as jest.Mock).mockResolvedValue({})

      // Mock transaction finalizer
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        if (Array.isArray(cb)) return Promise.all(cb)
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          paidEventOrder: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'order-recovered-1',
              eventId: 'e1',
              ticketTierId: 't1',
              amountKes: 2000,
              currency: 'KES',
              holdExpiresAt: new Date(Date.now() + 600000),
              status: 'PENDING',
              event: { id: 'e1', slug: 's', title: 'T', organizerId: 'org1', organizer: { plan: 'free' } },
              ticketTier: { id: 't1', name: 'Standard', capacity: 10, soldCount: 0, bundleSize: 1 },
              registrations: [],
            }),
            update: jest.fn().mockResolvedValue({ id: 'order-recovered-1' }),
          },
          ticketTier: {
            findUnique: jest.fn().mockResolvedValue({ id: 't1', capacity: 10, soldCount: 0 }),
            update: jest.fn().mockResolvedValue({ id: 't1' }),
          },
          event: { update: jest.fn() },
          registration: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue({ id: 'reg-rec', confirmationCode: 'CONF-REC' }),
          },
          ticket: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'tkt-rec' }) },
          payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          financialLedgerEntry: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature,
      })

      // Crash recovery succeeded!
      expect(res.status).toBe(200)
      expect(prisma.processedProviderEvent.updateMany).toHaveBeenCalled()
      expect(prisma.processedProviderEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PROCESSED' }),
        })
      )
    })

    it('returns HTTP 200 immediately without re-processing when event is already PROCESSED', async () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        id: 778899,
        data: {
          reference: 'pes_ref_already_done',
          amount: 100000,
          currency: 'KES',
        },
      })
      const signature = computePaystackSignature(payload, 'sk_test_mock_secret_key_12345')

      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValue({
        id: 'event-rec-done',
        status: 'PROCESSED',
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature,
      })

      expect(res.status).toBe(200)
      expect(res.body.message).toMatch(/already successfully processed/i)
      expect(prisma.paidEventOrder.findUnique).not.toHaveBeenCalled()
    })
  })
})
