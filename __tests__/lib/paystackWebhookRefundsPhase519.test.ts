import crypto from 'node:crypto'
import prisma from '@/lib/prisma'
import { dispatchPaystackWebhook } from '@/lib/paystackWebhookDispatcher'
import { resolveOvercapacityPaidOrder } from '@/lib/paymentFinalizers'

const TEST_SECRET = 'test_webhook_secret_key_12345'
process.env.PAYSTACK_SECRET_KEY = TEST_SECRET

function computePaystackSignature(payload: string, secret = TEST_SECRET) {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex')
}

jest.mock('@/lib/paymentFinalizers', () => ({
  __esModule: true,
  activateEventPassPayment: jest.fn(),
  activateSubscriptionPayment: jest.fn(),
  finalizePaidEventOrderPayment: jest.fn(),
  resolveOvercapacityPaidOrder: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    processedProviderEvent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    paidEventOrder: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}))

describe('Phase 5.19: Paystack Webhook Refund Reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.processedProviderEvent.create as jest.Mock).mockResolvedValue({ id: 'evt_rec_new' })
    ;(prisma.processedProviderEvent.update as jest.Mock).mockResolvedValue({})
  })

  it('1. successfully reconciles refund.processed and transitions order to REFUNDED', async () => {
    const mockOrder = {
      id: 'order-refund-webhook-1',
      status: 'OVERCAPACITY_PAID',
      fulfillmentStatus: 'REFUND_PENDING_PROVIDER',
      amountKes: 5000,
      currency: 'KES',
      providerReference: 'pstk_orig_tx_112233',
    }

    ;(prisma.paidEventOrder.findFirst as jest.Mock).mockResolvedValue(mockOrder)
    ;(resolveOvercapacityPaidOrder as jest.Mock).mockResolvedValue({
      success: true,
      status: 'REFUNDED',
      fulfillmentStatus: 'REFUNDED',
      resolvedAt: new Date(),
    })

    const payload = JSON.stringify({
      event: 'refund.processed',
      data: {
        id: 998877,
        reference: 'rfnd_ref_abc_123',
        amount: 500000, // 5,000 KES in minor units
        currency: 'KES',
        transaction_reference: 'pstk_orig_tx_112233',
        refunded_at: '2026-10-21T09:00:00.000Z',
        merchant_note: 'Overcapacity refund confirmation',
      },
    })

    const result = await dispatchPaystackWebhook({
      rawBody: payload,
      signature: computePaystackSignature(payload),
    })

    expect(result.status).toBe(200)
    expect(result.body.received).toBe(true)

    expect(resolveOvercapacityPaidOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-refund-webhook-1',
        resolution: 'MANUAL_REFUND',
        actorId: 'PAYSTACK_WEBHOOK',
        providerRefundReference: 'rfnd_ref_abc_123',
      })
    )
  })

  it('2. rejects refund.processed with 400 when amount in minor units does not match order', async () => {
    const mockOrder = {
      id: 'order-refund-webhook-2',
      status: 'OVERCAPACITY_PAID',
      fulfillmentStatus: 'REFUND_PENDING_PROVIDER',
      amountKes: 5000, // Expected 500,000 minor units
      currency: 'KES',
      providerReference: 'pstk_orig_tx_112233',
    }

    ;(prisma.paidEventOrder.findFirst as jest.Mock).mockResolvedValue(mockOrder)

    const payload = JSON.stringify({
      event: 'refund.processed',
      data: {
        id: 998877,
        reference: 'rfnd_ref_abc_123',
        amount: 100000, // Mismatched 1,000 KES!
        currency: 'KES',
        transaction_reference: 'pstk_orig_tx_112233',
      },
    })

    const result = await dispatchPaystackWebhook({
      rawBody: payload,
      signature: computePaystackSignature(payload),
    })

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Refund amount mismatch')
    expect(resolveOvercapacityPaidOrder).not.toHaveBeenCalled()
  })

  it('3. rejects refund.processed with 400 when currency does not match order', async () => {
    const mockOrder = {
      id: 'order-refund-webhook-3',
      status: 'OVERCAPACITY_PAID',
      fulfillmentStatus: 'REFUND_PENDING_PROVIDER',
      amountKes: 5000,
      currency: 'KES',
      providerReference: 'pstk_orig_tx_112233',
    }

    ;(prisma.paidEventOrder.findFirst as jest.Mock).mockResolvedValue(mockOrder)

    const payload = JSON.stringify({
      event: 'refund.processed',
      data: {
        id: 998877,
        reference: 'rfnd_ref_abc_123',
        amount: 500000,
        currency: 'USD', // Mismatch!
        transaction_reference: 'pstk_orig_tx_112233',
      },
    })

    const result = await dispatchPaystackWebhook({
      rawBody: payload,
      signature: computePaystackSignature(payload),
    })

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Refund currency mismatch')
    expect(resolveOvercapacityPaidOrder).not.toHaveBeenCalled()
  })

  it('4. ignores refund.processed cleanly when order is not found', async () => {
    ;(prisma.paidEventOrder.findFirst as jest.Mock).mockResolvedValue(null)

    const payload = JSON.stringify({
      event: 'refund.processed',
      data: {
        id: 998877,
        reference: 'rfnd_ref_unknown',
        amount: 500000,
        currency: 'KES',
        transaction_reference: 'pstk_unknown_tx',
      },
    })

    const result = await dispatchPaystackWebhook({
      rawBody: payload,
      signature: computePaystackSignature(payload),
    })

    expect(result.status).toBe(200)
    expect(resolveOvercapacityPaidOrder).not.toHaveBeenCalled()
  })

  it('5. successfully handles refund.failed and sets order fulfillmentStatus to REFUND_FAILED', async () => {
    const mockOrder = {
      id: 'order-refund-fail-1',
      status: 'OVERCAPACITY_PAID',
      fulfillmentStatus: 'REFUND_PENDING_PROVIDER',
    }

    ;(prisma.paidEventOrder.findFirst as jest.Mock).mockResolvedValue(mockOrder)
    ;(prisma.paidEventOrder.update as jest.Mock).mockResolvedValue({})
    ;(prisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const payload = JSON.stringify({
      event: 'refund.failed',
      data: {
        id: 554433,
        reference: 'rfnd_failed_ref',
        transaction_reference: 'pstk_tx_fail_1',
        reason: 'Customer bank account closed or frozen',
      },
    })

    const result = await dispatchPaystackWebhook({
      rawBody: payload,
      signature: computePaystackSignature(payload),
    })

    expect(result.status).toBe(200)
    expect(prisma.paidEventOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-refund-fail-1' },
        data: expect.objectContaining({
          fulfillmentStatus: 'REFUND_FAILED',
        }),
      })
    )
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ORDER_OVERCAPACITY_REFUND_FAILED',
        }),
      })
    )
  })
})
