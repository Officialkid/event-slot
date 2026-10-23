/** @jest-environment node */

import prisma from '@/lib/prisma'
import { dispatchPaystackWebhook } from '@/lib/paystackWebhookDispatcher'
import { getSubscriberMigrationStatus } from '@/lib/subscriptionMigration'
import { GET as getBillingInvoices } from '@/app/api/billing/invoices/route'
import { GET as getBillingStatus } from '@/app/api/billing/status/route'
import { POST as cancelSubscription } from '@/app/api/billing/cancel/route'
import crypto from 'crypto'

jest.mock('@/lib/prisma', () => {
  const mockClient: any = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscriptionPayment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-log-7' }),
    },
    processedProviderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-7' }),
      update: jest.fn().mockResolvedValue({ id: 'event-7' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn((input: any) => {
      if (Array.isArray(input)) return Promise.all(input)
      return input(mockClient)
    }),
  }
  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  }
})

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/paystack', () => {
  const actual = jest.requireActual('@/lib/paystack')
  return {
    ...actual,
    paystackFetch: jest.fn().mockResolvedValue({ status: true, data: [] }),
  }
})

describe('Phase 7: Subscription Billing Migration Suite', () => {
  const secretKey = 'sk_test_mock_secret_key_7'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PAYSTACK_SECRET_KEY = secretKey
  })

  describe('1. Paystack Subscription Lifecycle Webhooks', () => {
    it('activates user plan on subscription.create and DOES NOT downgrade to free', async () => {
      const payload = JSON.stringify({
        event: 'subscription.create',
        id: 112233,
        data: {
          subscription_code: 'SUB_pro_123',
          next_payment_date: '2026-11-21T00:00:00Z',
          customer: {
            customer_code: 'CUS_9988',
            email: 'organizer@eventslot.com',
          },
          plan: {
            name: 'pro',
            interval: 'monthly',
          },
          metadata: {
            userId: 'user-sub-1',
            planKey: 'pro',
          },
        },
      })

      const hmac = crypto.createHmac('sha512', secretKey).update(payload).digest('hex')

      ;(prisma.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'plan-pro-id',
        name: 'pro',
      })

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        id: 'sub-existing-1',
        userId: 'user-sub-1',
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature: hmac,
      })

      expect(res.status).toBe(200)

      // User must be upgraded to PRO (NOT free!)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-sub-1' },
          data: expect.objectContaining({
            plan: 'pro',
            paystackSubscriptionCode: 'SUB_pro_123',
          }),
        })
      )

      // Subscription record must be set to ACTIVE
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-existing-1' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            paymentProvider: 'paystack',
          }),
        })
      )
    })

    it('records renewal payment and extends period on invoice.update (paid: true)', async () => {
      const payload = JSON.stringify({
        event: 'invoice.update',
        id: 445566,
        data: {
          paid: true,
          status: 'success',
          amount: 325000, // KES 3,250
          period_start: '2026-11-01T00:00:00Z',
          period_end: '2026-12-01T00:00:00Z',
          subscription: {
            subscription_code: 'SUB_pro_123',
          },
          transaction: {
            reference: 'tx_renewal_ref_77',
          },
        },
      })

      const hmac = crypto.createHmac('sha512', secretKey).update(payload).digest('hex')

      ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-renew-1',
        plan: 'pro',
        paystackSubscriptionCode: 'SUB_pro_123',
      })

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        id: 'sub-renew-1',
        userId: 'user-renew-1',
        billingCycle: 'MONTHLY',
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature: hmac,
      })

      expect(res.status).toBe(200)

      // SubscriptionPayment must be created for the renewal
      expect(prisma.subscriptionPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionId: 'sub-renew-1',
            amountKes: 3250,
            status: 'SUCCESS',
            provider: 'paystack',
            providerRef: 'tx_renewal_ref_77',
          }),
        })
      )

      // Subscription must be extended through new period
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-renew-1' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
          }),
        })
      )
    })

    it('enters 3-day grace period without immediately revoking access on invoice.payment_failed', async () => {
      const payload = JSON.stringify({
        event: 'invoice.payment_failed',
        id: 778899,
        data: {
          subscription: {
            subscription_code: 'SUB_pro_123',
          },
          message: 'Insufficient card funds',
        },
      })

      const hmac = crypto.createHmac('sha512', secretKey).update(payload).digest('hex')

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day remaining

      ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-fail-1',
        plan: 'pro',
        planEndDate: futureDate,
        paystackSubscriptionCode: 'SUB_pro_123',
      })

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        id: 'sub-fail-1',
        userId: 'user-fail-1',
        currentPeriodEnd: futureDate,
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature: hmac,
      })

      expect(res.status).toBe(200)

      // Status becomes PAST_DUE
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-fail-1' },
          data: expect.objectContaining({
            status: 'PAST_DUE',
          }),
        })
      )

      // In grace period: user plan MUST NOT be downgraded immediately
      expect(prisma.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'free' }),
        })
      )

      // User notification must be sent
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.stringMatching(/payment failed/i),
          }),
        })
      )
    })

    it('marks subscription CANCELLED when subscription.disable arrives', async () => {
      const payload = JSON.stringify({
        event: 'subscription.disable',
        id: 889900,
        data: {
          subscription_code: 'SUB_pro_123',
        },
      })

      const hmac = crypto.createHmac('sha512', secretKey).update(payload).digest('hex')

      ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-disable-1',
        paystackSubscriptionCode: 'SUB_pro_123',
      })

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        id: 'sub-disable-1',
        userId: 'user-disable-1',
        currentPeriodEnd: new Date(Date.now() - 1000), // Expired
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature: hmac,
      })

      expect(res.status).toBe(200)

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-disable-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
          }),
        })
      )
    })
  })

  describe('2. Legacy IntaSend Subscriber Migration Handling', () => {
    it('detects legacy IntaSend subscriber as active and requires explicit re-consent upon renewal', async () => {
      const periodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days left

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-legacy-1',
        plan: 'pro',
        billingCycle: 'monthly',
        planEndDate: periodEnd,
        paystackCustomerCode: null,
        paystackSubscriptionCode: null,
      })

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        id: 'sub-legacy-1',
        userId: 'user-legacy-1',
        paymentProvider: 'intasend',
        billingCycle: 'MONTHLY',
        currentPeriodEnd: periodEnd,
        plan: { name: 'pro' },
      })

      const status = await getSubscriberMigrationStatus('user-legacy-1')

      expect(status.status).toBe('LEGACY_INTASEND_ACTIVE')
      expect(status.paymentProvider).toBe('intasend')
      expect(status.migrationRequired).toBe(true)
      expect(status.daysRemaining).toBe(15)
      expect(status.canRenewViaPaystack).toBe(true)
      expect(status.migrationGuidance).toMatch(/remains fully valid for 15 days/i)
    })
  })

  describe('3. Self-Service Billing Management & Invoices', () => {
    it('returns local subscription payments in billing invoice history', async () => {
      const { getServerSession } = require('next-auth')
      ;(getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-invoices-1' },
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-invoices-1',
        paystackCustomerCode: null,
      })

      ;(prisma.subscriptionPayment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pay-local-1',
          amountKes: 3250,
          amountUsd: 25,
          provider: 'intasend',
          providerRef: 'is_ref_9988',
          paidAt: new Date('2026-10-01T12:00:00Z'),
          createdAt: new Date('2026-10-01T12:00:00Z'),
          description: 'IntaSend Pro Monthly Payment',
        },
      ])

      const res = await getBillingInvoices()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.invoices).toHaveLength(1)
      expect(json.invoices[0].id).toBe('is_ref_9988')
      expect(json.invoices[0].amount).toBe(3250)
      expect(json.invoices[0].provider).toBe('intasend')
    })
  })
})
