/** @jest-environment node */

import prisma from '@/lib/prisma'
import { beginPaidEventCheckout } from '@/lib/paidEventCheckout'
import { finalizePaidEventOrderPayment } from '@/lib/paymentFinalizers'
import { dispatchPaystackWebhook } from '@/lib/paystackWebhookDispatcher'
import { initializePaystackTransaction } from '@/lib/paystack'
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
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
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

jest.mock('@/lib/paystack', () => {
  const actual = jest.requireActual('@/lib/paystack')
  return {
    ...actual,
    initializePaystackTransaction: jest.fn(),
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

describe('Phase 4.1: Payment Integrity Audit & Critical Corrections', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_key_12345'
    process.env.NEXTAUTH_URL = 'https://www.eventsslot.com'
  })

  describe('1. Capacity Reservation Concurrency & Row-Level Lock Simulation', () => {
    it('serializes concurrent reservation requests on TicketTier and diverts 2nd request to waitlist', async () => {
      const mockEvent = {
        id: 'event-race-1',
        slug: 'race-event',
        title: 'High Demand Summit',
        isPaid: true,
        status: 'OPEN',
        questions: [{ id: 'q_email', type: 'email', label: 'Email', required: true }],
        ticketTiers: [
          {
            id: 'tier-last-ticket',
            name: 'Final VIP Pass',
            priceKes: 10000,
            capacity: 10,
            soldCount: 9, // Exactly 1 ticket remaining!
            waitlistCount: 0,
            status: 'ACTIVE',
          },
        ],
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(initializePaystackTransaction as jest.Mock).mockResolvedValue({
        authorizationUrl: 'https://checkout.paystack.com/auth-1',
        accessCode: 'acc-1',
        reference: 'pes_order-1_ref',
      })

      // Simulate serialized execution under TicketTier row lock:
      // Request 1 acquires lock, observes pendingCount = 0 -> available = 1 -> creates hold order.
      // Request 2 acquires lock after Request 1 commits, observes pendingCount = 1 -> available = 0 -> waitlist.
      let committedPendingHolds = 0
      let lockQueue: Promise<void> = Promise.resolve()

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (arg) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg)
        }
        // Acquire serialized transaction lock simulating SELECT ... FOR UPDATE
        let releaseLock: () => void
        const currentLock = new Promise<void>((resolve) => {
          releaseLock = resolve
        })
        const previousLock = lockQueue
        lockQueue = lockQueue.then(() => currentLock)
        await previousLock

        try {
          const tx = {
            $queryRaw: jest.fn().mockResolvedValue([{ id: 'tier-last-ticket', capacity: 10, soldCount: 9 }]),
            event: {
              findUnique: jest.fn().mockResolvedValue(mockEvent),
              update: jest.fn().mockResolvedValue({ id: 'event-1' }),
            },
            ticketTier: {
              update: jest.fn().mockResolvedValue({ id: 'tier-last-ticket' }),
            },
            registration: {
              create: jest.fn().mockResolvedValue({
                id: 'reg-waitlist-1',
                registrationNumber: 10,
                waitlistPosition: 1,
              }),
            },
            paidEventOrder: {
              count: jest.fn().mockImplementation(async () => committedPendingHolds),
              create: jest.fn().mockImplementation(async (args) => {
                committedPendingHolds++ // Hold is now locked in DB!
                return { id: 'order-winner', amountKes: 10000, currency: 'KES' }
              }),
              update: jest.fn().mockResolvedValue({ id: 'order-winner' }),
            },
            payment: {
              create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
          }
          return await arg(tx)
        } finally {
          releaseLock!()
        }
      })

      const req1 = new Request('http://localhost/api/paid-events/checkout', { method: 'POST' })
      const req2 = new Request('http://localhost/api/paid-events/checkout', { method: 'POST' })

      // Concurrent execution
      const [res1, res2] = await Promise.all([
        beginPaidEventCheckout({
          eventSlug: 'race-event',
          ticketTierId: 'tier-last-ticket',
          attendee: { answers: [{ questionId: 'q_email', value: 'buyer1@example.com' }] },
          consentDataProcessing: true,
          request: req1,
        }),
        beginPaidEventCheckout({
          eventSlug: 'race-event',
          ticketTierId: 'tier-last-ticket',
          attendee: { answers: [{ questionId: 'q_email', value: 'buyer2@example.com' }] },
          consentDataProcessing: true,
          request: req2,
        }),
      ])

      // One MUST win checkout, the other MUST divert to waitlist
      const results = [res1.kind, res2.kind]
      expect(results).toContain('checkout')
      expect(results).toContain('waitlist')

      // Exactly 1 checkout initiated, preventing overselling
      expect(initializePaystackTransaction).toHaveBeenCalledTimes(1)
    })

    it('retries transparently when a transient transaction conflict or deadlock occurs', async () => {
      const mockEvent = {
        id: 'event-conflict-1',
        slug: 'conflict-event',
        title: 'Conflict Event',
        isPaid: true,
        status: 'OPEN',
        questions: [{ id: 'q_email', type: 'email', label: 'Email', required: true }],
        ticketTiers: [
          {
            id: 'tier-retry-1',
            name: 'Regular',
            priceKes: 2000,
            capacity: 50,
            soldCount: 0,
            status: 'ACTIVE',
          },
        ],
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(initializePaystackTransaction as jest.Mock).mockResolvedValue({
        authorizationUrl: 'https://checkout.paystack.com/auth-retry',
        accessCode: 'acc-retry',
        reference: 'pes_order-retry_ref',
      })

      let attempts = 0
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (arg) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg)
        }
        attempts++
        if (attempts === 1) {
          // Simulate transient PostgreSQL deadlock / serialization conflict (P2034)
          const error: any = new Error('Transaction conflict')
          error.code = 'P2034'
          throw error
        }

        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          event: { findUnique: jest.fn().mockResolvedValue(mockEvent) },
          paidEventOrder: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue({ id: 'order-retry-success', amountKes: 2000, currency: 'KES' }),
            update: jest.fn().mockResolvedValue({ id: 'order-retry-success' }),
          },
          payment: {
            create: jest.fn().mockResolvedValue({ id: 'pay-retry' }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        }
        return arg(tx)
      })

      const req = new Request('http://localhost/api/paid-events/checkout', { method: 'POST' })
      const res = await beginPaidEventCheckout({
        eventSlug: 'conflict-event',
        ticketTierId: 'tier-retry-1',
        attendee: { answers: [{ questionId: 'q_email', value: 'retry@example.com' }] },
        consentDataProcessing: true,
        request: req,
      })

      expect(attempts).toBe(2) // Retried once and succeeded!
      expect(res.kind).toBe('checkout')
    })
  })

  describe('2. Late Successful Payments & Overcapacity Protection', () => {
    it('honors late payment and issues ticket if capacity is still available despite expired hold', async () => {
      const mockOrder = {
        id: 'order-late-available',
        eventId: 'event-1',
        ticketTierId: 'tier-1',
        amountKes: 1000,
        currency: 'KES',
        status: 'EXPIRED', // Hold expired before payment webhook arrived
        holdExpiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        attendeeEmail: 'late-buyer@example.com',
        attendeeName: 'Late Buyer',
        attendeePayload: [],
        event: {
          id: 'event-1',
          title: 'Annual Meet',
          slug: 'annual-meet',
          eventDate: new Date(),
          location: 'Main Hall',
          confirmedCount: 5,
          capacity: 100,
          currency: 'KES',
          organizerId: 'org-1',
          organizer: { plan: 'pro' },
        },
        ticketTier: {
          id: 'tier-1',
          name: 'General',
          priceKes: 1000,
          bundleSize: 1,
          soldCount: 5,
          capacity: 100, // 95 tickets still available!
        },
        registrations: [],
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          paidEventOrder: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue({ id: 'order-late-available', status: 'PAID' }),
          },
          ticketTier: {
            findUnique: jest.fn().mockResolvedValue({ id: 'tier-1', capacity: 100, soldCount: 5 }),
            update: jest.fn().mockResolvedValue({ id: 'tier-1', soldCount: 6 }),
          },
          event: {
            update: jest.fn().mockResolvedValue({ id: 'event-1' }),
          },
          registration: {
            findFirst: jest.fn().mockResolvedValue(null),
            count: jest.fn().mockResolvedValue(5),
            create: jest.fn().mockResolvedValue({ id: 'reg-late-1', confirmationCode: 'LATE-CONF-1' }),
          },
          ticket: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'tkt-late-1' }),
          },
          payment: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          organiserBalance: {
            upsert: jest.fn().mockResolvedValue({}),
          },
          financialLedgerEntry: {
            upsert: jest.fn().mockResolvedValue({ id: 'ledger-entry' }),
          },
          auditLog: {
            create: jest.fn(),
          },
        }
        return callback(tx)
      })

      const result = await finalizePaidEventOrderPayment('order-late-available', 'pes_ref_late_ok')

      expect(result.status).toBe('PAID')
      if (result.status === 'PAID') {
        expect(result.confirmationCode).toBe('LATE-CONF-1')
      }
    })

    it('prevents overselling on late payment when tier is full and moves order to OVERCAPACITY_PAID exception state', async () => {
      const mockOrder = {
        id: 'order-late-exhausted',
        eventId: 'event-1',
        ticketTierId: 'tier-full',
        amountKes: 1000,
        currency: 'KES',
        status: 'EXPIRED',
        holdExpiresAt: new Date(Date.now() - 3600000),
        attendeeEmail: 'unlucky@example.com',
        attendeeName: 'Unlucky Attendee',
        attendeePayload: [],
        event: {
          id: 'event-1',
          title: 'Sold Out Gala',
          slug: 'gala',
          eventDate: new Date(),
          location: 'Hall A',
          confirmedCount: 10,
          capacity: 10,
          currency: 'KES',
          organizerId: 'org-1',
          organizer: { plan: 'free' },
        },
        ticketTier: {
          id: 'tier-full',
          name: 'VIP',
          priceKes: 1000,
          bundleSize: 1,
          soldCount: 10,
          capacity: 10, // FULL! 10 out of 10 sold!
        },
        registrations: [],
      }

      let orderUpdatedStatus = ''
      let ticketTierIncremented = false
      let ledgerPosted = false

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          paidEventOrder: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockImplementation((args) => {
              orderUpdatedStatus = args.data.status
              return { id: 'order-late-exhausted', status: args.data.status }
            }),
          },
          ticketTier: {
            findUnique: jest.fn().mockResolvedValue({ id: 'tier-full', capacity: 10, soldCount: 10 }),
            update: jest.fn().mockImplementation(() => {
              ticketTierIncremented = true
            }),
          },
          event: { update: jest.fn() },
          registration: { create: jest.fn() },
          ticket: { create: jest.fn() },
          payment: { updateMany: jest.fn() },
          organiserBalance: { upsert: jest.fn() },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation(() => {
              ledgerPosted = true
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
          },
        }
        return callback(tx)
      })

      const result = await finalizePaidEventOrderPayment('order-late-exhausted', 'pes_ref_overcapacity')

      // 1. Enters explicit auditable exception state
      expect(result.status).toBe('OVERCAPACITY_PAID')
      expect(orderUpdatedStatus).toBe('OVERCAPACITY_PAID')

      // 2. Must NOT silently increment capacity or oversell
      expect(ticketTierIncremented).toBe(false)

      // 3. Must NOT post ticket proceeds to organizer balance for undelivered ticket
      expect(ledgerPosted).toBe(false)
    })

    it('enforces idempotency so duplicate finalizations return existing registration without double-crediting', async () => {
      const mockOrder = {
        id: 'order-already-done',
        eventId: 'event-1',
        ticketTierId: 'tier-1',
        amountKes: 2500,
        currency: 'KES',
        status: 'PAID', // Already processed!
        holdExpiresAt: new Date(Date.now() + 600000),
        event: { id: 'event-1', title: 'Event 1', organizerId: 'org-1' },
        ticketTier: { id: 'tier-1', name: 'VIP', priceKes: 2500, soldCount: 1, capacity: 50 },
        registrations: [{ id: 'reg-existing-1', confirmationCode: 'EXISTING-CODE-999' }],
      }

      let ledgerPosted = false
      let soldCountUpdated = false

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          paidEventOrder: { findUnique: jest.fn().mockResolvedValue(mockOrder) },
          ticketTier: {
            update: jest.fn().mockImplementation(() => {
              soldCountUpdated = true
            }),
          },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation(() => {
              ledgerPosted = true
            }),
          },
        }
        return callback(tx)
      })

      const result = await finalizePaidEventOrderPayment('order-already-done', 'pes_duplicate_call')

      expect(result.status).toBe('PAID')
      if (result.status === 'PAID') {
        expect(result.confirmationCode).toBe('EXISTING-CODE-999')
      }
      expect(soldCountUpdated).toBe(false)
      expect(ledgerPosted).toBe(false)
    })
  })

  describe('3. Webhook Deduplication Race Handling', () => {
    function computePaystackSignature(payload: string, secret: string) {
      return crypto.createHmac('sha512', secret).update(payload).digest('hex')
    }

    it('gracefully handles concurrent duplicate webhook insert (P2002) with HTTP 200', async () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        id: 778899,
        data: {
          reference: 'pes_ref_race_1',
          amount: 500000,
          currency: 'KES',
        },
      })
      const signature = computePaystackSignature(payload, 'sk_test_mock_secret_key_12345')

      // Webhook 1 finds null
      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValueOnce(null)

      // Webhook 2 concurrently inserted it, so Webhook 1 gets P2002 on create
      const p2002Error: any = new Error('Unique constraint failed on the fields: (`idempotencyKey`)')
      p2002Error.code = 'P2002'
      ;(prisma.processedProviderEvent.create as jest.Mock).mockRejectedValueOnce(p2002Error)

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature,
      })

      expect(res.status).toBe(200)
      expect(res.body.message).toMatch(/being processed by another worker/i)
    })
  })
})
