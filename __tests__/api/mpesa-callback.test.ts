/** @jest-environment node */

import { processMpesaCallback } from '@/lib/mpesaCallback'

const mockPaidEventOrderFindFirst = jest.fn()
const mockSubscriptionPaymentFindFirst = jest.fn()

const mockFinalizePaidEventOrderPayment = jest.fn()
const mockFailPaidEventOrderPayment = jest.fn()
const mockActivateSubscriptionPayment = jest.fn()
const mockFailSubscriptionPayment = jest.fn()
const mockErrorLogCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    paidEventOrder: {
      findFirst: (...args: unknown[]) => mockPaidEventOrderFindFirst(...args),
    },
    subscriptionPayment: {
      findFirst: (...args: unknown[]) => mockSubscriptionPaymentFindFirst(...args),
    },
    errorLog: {
      create: (...args: unknown[]) => mockErrorLogCreate(...args),
    },
  },
}))

jest.mock('@/lib/paymentFinalizers', () => ({
  finalizePaidEventOrderPayment: (...args: unknown[]) => mockFinalizePaidEventOrderPayment(...args),
  failPaidEventOrderPayment: (...args: unknown[]) => mockFailPaidEventOrderPayment(...args),
  activateSubscriptionPayment: (...args: unknown[]) => mockActivateSubscriptionPayment(...args),
  failSubscriptionPayment: (...args: unknown[]) => mockFailSubscriptionPayment(...args),
}))

describe('processMpesaCallback', () => {
  beforeEach(() => {
    mockPaidEventOrderFindFirst.mockReset()
    mockSubscriptionPaymentFindFirst.mockReset()
    mockFinalizePaidEventOrderPayment.mockReset()
    mockFailPaidEventOrderPayment.mockReset()
    mockActivateSubscriptionPayment.mockReset()
    mockFailSubscriptionPayment.mockReset()
    mockErrorLogCreate.mockReset()
    mockErrorLogCreate.mockResolvedValue(null)
  })

  it('finalizes a paid event order on ResultCode 0', async () => {
    mockPaidEventOrderFindFirst.mockResolvedValue({ id: 'order-1', status: 'PAYMENT_PENDING' })

    const result = await processMpesaCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'checkout-1',
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [{ Name: 'MpesaReceiptNumber', Value: 'QK12345678' }],
          },
        },
      },
    })

    expect(mockFinalizePaidEventOrderPayment).toHaveBeenCalledWith('order-1', 'QK12345678')
    expect(result).toEqual(expect.objectContaining({ handled: true, scope: 'paid-event', status: 'PAID' }))
  })

  it('marks a paid event order cancelled when the user cancels the STK Push', async () => {
    mockPaidEventOrderFindFirst.mockResolvedValue({ id: 'order-2', status: 'PAYMENT_PENDING' })

    const result = await processMpesaCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'checkout-2',
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user',
        },
      },
    })

    expect(mockFailPaidEventOrderPayment).toHaveBeenCalledWith('order-2', 'CANCELLED')
    expect(result).toEqual(expect.objectContaining({ handled: true, scope: 'paid-event', status: 'CANCELLED' }))
  })

  it('marks a paid event order failed on insufficient funds', async () => {
    mockPaidEventOrderFindFirst.mockResolvedValue({ id: 'order-3', status: 'PAYMENT_PENDING' })

    const result = await processMpesaCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'checkout-3',
          ResultCode: 1,
          ResultDesc: 'Insufficient funds',
        },
      },
    })

    expect(mockFailPaidEventOrderPayment).toHaveBeenCalledWith('order-3', 'FAILED')
    expect(result).toEqual(expect.objectContaining({ handled: true, scope: 'paid-event', status: 'FAILED' }))
  })

  it('treats duplicate paid callbacks idempotently when the order is already paid', async () => {
    mockPaidEventOrderFindFirst.mockResolvedValue({ id: 'order-4', status: 'PAID' })

    const result = await processMpesaCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'checkout-4',
          ResultCode: 0,
          ResultDesc: 'Success',
        },
      },
    })

    expect(mockFinalizePaidEventOrderPayment).not.toHaveBeenCalled()
    expect(mockFailPaidEventOrderPayment).not.toHaveBeenCalled()
    expect(result).toEqual(expect.objectContaining({ handled: true, scope: 'paid-event', status: 'PAID', duplicate: true }))
  })
})
