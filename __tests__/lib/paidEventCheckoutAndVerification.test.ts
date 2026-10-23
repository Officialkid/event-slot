/** @jest-environment node */

import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { beginPaidEventCheckout, PaidCheckoutError } from '@/lib/paidEventCheckout'
import { initializePaystackTransaction, verifyPaystackTransaction, PaystackTimeoutError } from '@/lib/paystack'
import { GET as getOrderStatus } from '@/app/api/paid-events/orders/[orderId]/route'
import { dispatchPaystackWebhook } from '@/lib/paystackWebhookDispatcher'
import crypto from 'crypto'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    ticketTier: {
      findUnique: jest.fn(),
    },
    paidEventOrder: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    financialLedgerEntry: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    processedProviderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'proc-event-1' }),
      update: jest.fn().mockResolvedValue({ id: 'proc-event-1' }),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
  prisma: {
    event: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    ticketTier: {
      findUnique: jest.fn(),
    },
    paidEventOrder: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    financialLedgerEntry: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    processedProviderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'proc-event-1' }),
      update: jest.fn().mockResolvedValue({ id: 'proc-event-1' }),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/paystack', () => {
  const actual = jest.requireActual('@/lib/paystack')
  return {
    ...actual,
    initializePaystackTransaction: jest.fn(),
    verifyPaystackTransaction: jest.fn(),
  }
})

jest.mock('@/lib/paymentFinalizers', () => ({
  finalizePaidEventOrderPayment: jest.fn().mockResolvedValue({ id: 'reg-1', confirmationCode: 'CONF123' }),
  failPaidEventOrderPayment: jest.fn().mockResolvedValue(undefined),
  joinPaidEventWaitlist: jest.fn().mockResolvedValue({ id: 'wait-1', waitlistPosition: 2, registrationNumber: 10 }),
}))

describe('Phase 4: Paystack Paid-Ticket Checkout & Concurrency-Safe Capacity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_key_12345'
    process.env.NEXTAUTH_URL = 'https://www.eventsslot.com'
  })

  describe('Capacity Reservation and Paystack Initialization', () => {
    it('successfully reserves capacity and initializes Paystack checkout with authoritative server price', async () => {
      const mockEvent = {
        id: 'event-1',
        slug: 'summit-2026',
        title: 'Tech Summit 2026',
        isPaid: true,
        status: 'OPEN',
        deadline: null,
        eventEndAt: new Date(Date.now() + 86400000),
        questions: [{ id: 'q_email', type: 'email', label: 'Email', required: true }],
        organizer: { plan: 'FREE' },
        ticketTiers: [
          {
            id: 'tier-1',
            name: 'VIP Pass',
            priceKes: 5000,
            capacity: 100,
            soldCount: 10,
            status: 'ACTIVE',
          },
        ],
      }

      // Precheck query
      ;(prisma.event.findUnique as jest.Mock).mockResolvedValueOnce(mockEvent)

      // Transaction execution mock
      ;(prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback) => {
        const tx = {
          event: {
            findUnique: jest.fn().mockResolvedValue(mockEvent),
          },
          paidEventOrder: {
            count: jest.fn().mockResolvedValue(5), // 5 active holds
            create: jest.fn().mockResolvedValue({
              id: 'order-100',
              amountKes: 5000,
              currency: 'KES',
            }),
          },
          payment: {
            create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
          },
        }
        return callback(tx)
      })

      // Paystack initialize mock
      ;(initializePaystackTransaction as jest.Mock).mockResolvedValueOnce({
        authorizationUrl: 'https://checkout.paystack.com/test-auth-url',
        accessCode: 'pstk_acc_100',
        reference: 'pes_order-100_ref123',
      })

      const req = new Request('http://localhost/api/paid-events/checkout', { method: 'POST' })
      const result = await beginPaidEventCheckout({
        eventSlug: 'summit-2026',
        ticketTierId: 'tier-1',
        attendee: {
          answers: [{ questionId: 'q_email', value: 'attendee@example.com' }],
        },
        consentDataProcessing: true,
        request: req,
      })

      expect(result.kind).toBe('checkout')
      if (result.kind === 'checkout') {
        expect(result.orderId).toBe('order-100')
        expect(result.checkoutRequestId).toBe('pstk_acc_100')
        expect(result.authorizationUrl).toBe('https://checkout.paystack.com/test-auth-url')
        expect(result.amountKes).toBe(5000)
      }

      // Verify Paystack was called with authoritative integer minor units (5000 KES = 500000 cents)
      expect(initializePaystackTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'attendee@example.com',
          amountMinorUnits: BigInt(500000),
          currency: 'KES',
          metadata: expect.objectContaining({
            orderId: 'order-100',
            ticketTierId: 'tier-1',
          }),
        })
      )
    })

    it('diverts to waitlist when capacity is fully reserved by active holds', async () => {
      const mockEvent = {
        id: 'event-1',
        slug: 'summit-2026',
        title: 'Tech Summit 2026',
        isPaid: true,
        status: 'OPEN',
        questions: [{ id: 'q_email', type: 'email', label: 'Email', required: true }],
        ticketTiers: [
          {
            id: 'tier-1',
            name: 'VIP Pass',
            priceKes: 5000,
            capacity: 10,
            soldCount: 8,
            waitlistCount: 1,
            status: 'ACTIVE',
          },
        ],
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValueOnce(mockEvent)
      ;(prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback) => {
        const tx = {
          event: { findUnique: jest.fn().mockResolvedValue(mockEvent) },
          paidEventOrder: {
            count: jest.fn().mockResolvedValue(2), // 8 sold + 2 active holds = 10 (full!)
          },
        }
        return callback(tx)
      })

      const req = new Request('http://localhost/api/paid-events/checkout', { method: 'POST' })
      const result = await beginPaidEventCheckout({
        eventSlug: 'summit-2026',
        ticketTierId: 'tier-1',
        attendee: {
          answers: [{ questionId: 'q_email', value: 'waitlister@example.com' }],
        },
        consentDataProcessing: true,
        request: req,
      })

      expect(result.kind).toBe('waitlist')
      // Ensure Paystack was NOT initialized since capacity was exhausted
      expect(initializePaystackTransaction).not.toHaveBeenCalled()
    })

    it('handles Paystack gateway timeouts by preserving order in PENDING without releasing inventory falsely', async () => {
      const mockEvent = {
        id: 'event-1',
        slug: 'summit-2026',
        title: 'Tech Summit 2026',
        isPaid: true,
        status: 'OPEN',
        questions: [{ id: 'q_email', type: 'email', label: 'Email', required: true }],
        ticketTiers: [
          {
            id: 'tier-1',
            name: 'VIP Pass',
            priceKes: 5000,
            capacity: 50,
            soldCount: 0,
            status: 'ACTIVE',
          },
        ],
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValueOnce(mockEvent)
      ;(prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback) => {
        const tx = {
          event: { findUnique: jest.fn().mockResolvedValue(mockEvent) },
          paidEventOrder: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue({ id: 'order-timeout', amountKes: 5000, currency: 'KES' }),
          },
          payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) },
        }
        return callback(tx)
      })

      ;(prisma.paidEventOrder.update as jest.Mock).mockResolvedValueOnce({ id: 'order-timeout' })

      // Simulate timeout
      ;(initializePaystackTransaction as jest.Mock).mockRejectedValueOnce(
        new PaystackTimeoutError('Paystack initialization timed out after 10000ms', 'ref_timeout_123')
      )

      const req = new Request('http://localhost/api/paid-events/checkout', { method: 'POST' })
      await expect(
        beginPaidEventCheckout({
          eventSlug: 'summit-2026',
          ticketTierId: 'tier-1',
          attendee: { answers: [{ questionId: 'q_email', value: 'timeout@example.com' }] },
          consentDataProcessing: true,
          request: req,
        })
      ).rejects.toThrow('Payment gateway timed out')

      // Verify order was updated with reference rather than deleted or marked failed
      expect(prisma.paidEventOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-timeout' },
          data: expect.objectContaining({
            providerReference: expect.stringMatching(/^paystack:pes_order-timeout/),
          }),
        })
      )
    })
  })

  describe('Order Verification Route: Strict Amount, Status, and Timeout Safety', () => {
    it('finalizes payment when Paystack verification succeeds with exact minor units and currency', async () => {
      const { finalizePaidEventOrderPayment } = require('@/lib/paymentFinalizers')

      ;(prisma.paidEventOrder.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'order-verify-1',
          status: 'PAYMENT_PENDING',
          holdExpiresAt: new Date(Date.now() + 600000),
          amountKes: 3000,
          currency: 'KES',
          event: { id: 'e1', title: 'Event 1', slug: 'event-1' },
          ticketTier: { id: 't1', name: 'Standard' },
          registrations: [],
        })
        .mockResolvedValueOnce({
          checkoutRequestId: 'acc-1',
          providerReference: 'paystack:pes_ref_999',
          amountKes: 3000,
          currency: 'KES',
        })
        .mockResolvedValueOnce({
          id: 'order-verify-1',
          status: 'PAID',
          holdExpiresAt: new Date(Date.now() + 600000),
          amountKes: 3000,
          currency: 'KES',
          event: { title: 'Event 1', slug: 'event-1' },
          ticketTier: { name: 'Standard' },
          registrations: [{ confirmationCode: 'ABC-123', id: 'reg-999' }],
        })

      ;(verifyPaystackTransaction as jest.Mock).mockResolvedValueOnce({
        reference: 'pes_ref_999',
        status: 'success',
        amountMinorUnits: 300000, // Exact 3000 KES = 300000 minor units
        currency: 'KES',
      })

      const req = new NextRequest('http://localhost/api/paid-events/orders/order-verify-1')
      const res = await getOrderStatus(req, { params: Promise.resolve({ orderId: 'order-verify-1' }) })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.status).toBe('PAID')
      expect(body.confirmationCode).toBe('ABC-123')
      expect(finalizePaidEventOrderPayment).toHaveBeenCalledWith('order-verify-1', 'pes_ref_999')
    })

    it('rejects order finalization if verified amount in minor units does not match order price', async () => {
      const { finalizePaidEventOrderPayment } = require('@/lib/paymentFinalizers')

      ;(prisma.paidEventOrder.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'order-tamper',
          status: 'PAYMENT_PENDING',
          holdExpiresAt: new Date(Date.now() + 600000),
          amountKes: 5000,
          currency: 'KES',
          event: { id: 'e1', title: 'Event 1', slug: 'event-1' },
          ticketTier: { id: 't1', name: 'VIP' },
          registrations: [],
        })
        .mockResolvedValueOnce({
          checkoutRequestId: 'acc-1',
          providerReference: 'paystack:pes_ref_tamper',
          amountKes: 5000, // Expected: 500000 cents
          currency: 'KES',
        })

      // Paystack returns only 1000 KES (100000 cents) paid!
      ;(verifyPaystackTransaction as jest.Mock).mockResolvedValueOnce({
        reference: 'pes_ref_tamper',
        status: 'success',
        amountMinorUnits: 100000, // Underpaid!
        currency: 'KES',
      })

      const req = new NextRequest('http://localhost/api/paid-events/orders/order-tamper')
      const res = await getOrderStatus(req, { params: Promise.resolve({ orderId: 'order-tamper' }) })
      const body = await res.json()

      expect(res.status).toBe(200)
      // Must NOT be finalized as PAID
      expect(body.status).toBe('PAYMENT_PENDING')
      expect(finalizePaidEventOrderPayment).not.toHaveBeenCalled()
    })

    it('rejects order finalization if verified currency does not match order currency', async () => {
      const { finalizePaidEventOrderPayment } = require('@/lib/paymentFinalizers')

      ;(prisma.paidEventOrder.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'order-curr-mismatch',
          status: 'PAYMENT_PENDING',
          holdExpiresAt: new Date(Date.now() + 600000),
          amountKes: 5000,
          currency: 'KES',
          event: { id: 'e1', title: 'Event 1', slug: 'event-1' },
          ticketTier: { id: 't1', name: 'VIP' },
          registrations: [],
        })
        .mockResolvedValueOnce({
          checkoutRequestId: 'acc-1',
          providerReference: 'paystack:pes_ref_curr',
          amountKes: 5000,
          currency: 'KES',
        })

      ;(verifyPaystackTransaction as jest.Mock).mockResolvedValueOnce({
        reference: 'pes_ref_curr',
        status: 'success',
        amountMinorUnits: 500000,
        currency: 'NGN', // Currency mismatch!
      })

      const req = new NextRequest('http://localhost/api/paid-events/orders/order-curr-mismatch')
      const res = await getOrderStatus(req, { params: Promise.resolve({ orderId: 'order-curr-mismatch' }) })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.status).toBe('PAYMENT_PENDING')
      expect(finalizePaidEventOrderPayment).not.toHaveBeenCalled()
    })

    it('preserves PAYMENT_PENDING on verification network timeout without marking order failed', async () => {
      const { failPaidEventOrderPayment, finalizePaidEventOrderPayment } = require('@/lib/paymentFinalizers')

      ;(prisma.paidEventOrder.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'order-timeout-verify',
          status: 'PAYMENT_PENDING',
          holdExpiresAt: new Date(Date.now() + 600000),
          amountKes: 2000,
          currency: 'KES',
          event: { id: 'e1', title: 'Event 1', slug: 'event-1' },
          ticketTier: { id: 't1', name: 'Standard' },
          registrations: [],
        })
        .mockResolvedValueOnce({
          checkoutRequestId: 'acc-1',
          providerReference: 'paystack:pes_ref_timeout',
          amountKes: 2000,
          currency: 'KES',
        })

      ;(verifyPaystackTransaction as jest.Mock).mockRejectedValueOnce(
        new PaystackTimeoutError('Verification timed out', 'pes_ref_timeout')
      )

      const req = new NextRequest('http://localhost/api/paid-events/orders/order-timeout-verify')
      const res = await getOrderStatus(req, { params: Promise.resolve({ orderId: 'order-timeout-verify' }) })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.status).toBe('PAYMENT_PENDING')
      expect(finalizePaidEventOrderPayment).not.toHaveBeenCalled()
      expect(failPaidEventOrderPayment).not.toHaveBeenCalled()
    })
  })

  describe('Unified Webhook Dispatcher: Timing-Safe Verification & Event Routing', () => {
    function computePaystackSignature(payload: string, secret: string) {
      return crypto.createHmac('sha512', secret).update(payload).digest('hex')
    }

    it('rejects webhooks with missing or invalid signature', async () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_1' } })
      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature: 'invalid_signature_hex',
      })

      expect(res.status).toBe(401)
      expect(res.body.error).toMatch(/Invalid signature/)
    })

    it('rejects duplicate webhook events idempotently via processedProviderEvent lock', async () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 998877,
          reference: 'pes_order-dup_123',
          status: 'success',
          amount: 250000,
          currency: 'KES',
        },
      })
      const signature = computePaystackSignature(payload, 'sk_test_mock_secret_key_12345')

      // Mock idempotency record found and already processed
      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'proc-dup-1',
        status: 'PROCESSED',
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature,
      })

      expect(res.status).toBe(200)
      expect(res.body.message).toMatch(/already.*processed/i)
    })

    it('successfully processes charge.success for paid-ticket orders and finalizes payment', async () => {
      const { finalizePaidEventOrderPayment } = require('@/lib/paymentFinalizers')

      const payload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 112233,
          reference: 'pes_order-ticket_abc',
          status: 'success',
          amount: 300000,
          currency: 'KES',
          metadata: {
            orderId: 'order-ticket-1',
            type: 'paid_event_checkout',
          },
        },
      })
      const signature = computePaystackSignature(payload, 'sk_test_mock_secret_key_12345')

      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.processedProviderEvent.create as jest.Mock).mockResolvedValueOnce({ id: 'proc-ticket-1' })
      ;(prisma.processedProviderEvent.update as jest.Mock).mockResolvedValueOnce({ id: 'proc-ticket-1' })

      ;(prisma.paidEventOrder.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'order-ticket-1',
        amountKes: 3000,
        currency: 'KES',
        status: 'PAYMENT_PENDING',
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature,
      })

      expect(res.status).toBe(200)
      expect(finalizePaidEventOrderPayment).toHaveBeenCalledWith('order-ticket-1', 'pes_order-ticket_abc')
    })
  })
})
