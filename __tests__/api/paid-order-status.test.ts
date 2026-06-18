/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/paid-events/orders/[orderId]/route'

const mockFindUnique = jest.fn()
const mockOrderUpdate = jest.fn()
const mockPaymentUpdateMany = jest.fn()
const mockRegistrationUpdate = jest.fn()
const mockOfferNextPaidWaitlistSpot = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    paidEventOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockOrderUpdate(...args),
    },
    payment: {
      updateMany: (...args: unknown[]) => mockPaymentUpdateMany(...args),
    },
    registration: {
      update: (...args: unknown[]) => mockRegistrationUpdate(...args),
    },
  },
}))

jest.mock('@/lib/paidEventWaitlist', () => ({
  offerNextPaidWaitlistSpot: (...args: unknown[]) => mockOfferNextPaidWaitlistSpot(...args),
}))

jest.mock('@/lib/paymentFinalizers', () => ({
  failPaidEventOrderPayment: jest.fn(),
  finalizePaidEventOrderPayment: jest.fn(),
}))

jest.mock('@/lib/intasend', () => ({
  extractInvoiceState: jest.fn(),
  extractProviderReference: jest.fn(),
  getIntaSendPaymentStatus: jest.fn(),
}))

describe('GET /api/paid-events/orders/[orderId]', () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockOrderUpdate.mockReset()
    mockPaymentUpdateMany.mockReset()
    mockRegistrationUpdate.mockReset()
    mockOfferNextPaidWaitlistSpot.mockReset()

    mockOrderUpdate.mockResolvedValue(null)
    mockPaymentUpdateMany.mockResolvedValue(null)
    mockRegistrationUpdate.mockResolvedValue(null)
    mockOfferNextPaidWaitlistSpot.mockResolvedValue(null)
  })

  it('expires a pending order when the hold has lapsed and no callback arrived', async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'PENDING',
        holdExpiresAt: new Date(Date.now() - 61_000),
        promotionRegistrationId: null,
        attendeeEmail: 'attendee01@eventslot.test',
        amountKes: 100,
        event: { id: 'event-1', title: 'Test Event', slug: 'test-event' },
        ticketTier: { id: 'tier-1', name: 'Standard' },
        registrations: [],
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'EXPIRED',
        holdExpiresAt: new Date(Date.now() - 61_000),
        attendeeEmail: 'attendee01@eventslot.test',
        amountKes: 100,
        event: { title: 'Test Event', slug: 'test-event' },
        ticketTier: { name: 'Standard' },
        registrations: [],
      })

    const response = await GET(
      new NextRequest('http://localhost/api/paid-events/orders/order-1', { method: 'GET' }),
      { params: Promise.resolve({ orderId: 'order-1' }) }
    )
    const body = await response.json()

    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'EXPIRED' },
    })
    expect(mockPaymentUpdateMany).toHaveBeenCalledWith({
      where: { paidEventOrderId: 'order-1' },
      data: { status: 'FAILED' },
    })
    expect(mockOfferNextPaidWaitlistSpot).toHaveBeenCalledWith('event-1', 'tier-1')
    expect(body.status).toBe('EXPIRED')
  })
})
