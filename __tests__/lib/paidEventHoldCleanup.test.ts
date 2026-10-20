/** @jest-environment node */

import { cleanupExpiredPaidEventHolds } from '@/lib/paidEventCheckout'
import prisma from '@/lib/prisma'
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist'

jest.mock('@/lib/prisma', () => {
  const mockClient: any = {
    paidEventOrder: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      updateMany: jest.fn(),
    },
    registration: {
      update: jest.fn(),
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

jest.mock('@/lib/paidEventWaitlist', () => ({
  offerNextPaidWaitlistSpot: jest.fn(),
}))

describe('Capacity Reservation Expiration & Hold Auto-Release', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma))
  })

  it('returns zero counts when no orders have expired holds', async () => {
    ;(prisma.paidEventOrder.findMany as jest.Mock).mockResolvedValue([])

    const result = await cleanupExpiredPaidEventHolds()

    expect(result.expiredCount).toBe(0)
    expect(result.promotedCount).toBe(0)
    expect(offerNextPaidWaitlistSpot).not.toHaveBeenCalled()
  })

  it('atomically transitions expired holds to EXPIRED, fails payments, and triggers waitlist promotion', async () => {
    const expiredOrders = [
      {
        id: 'order-expired-1',
        eventId: 'event-101',
        ticketTierId: 'tier-vip',
        promotionRegistrationId: 'reg-waitlist-1',
      },
      {
        id: 'order-expired-2',
        eventId: 'event-101',
        ticketTierId: 'tier-standard',
        promotionRegistrationId: null,
      },
    ]

    ;(prisma.paidEventOrder.findMany as jest.Mock).mockResolvedValue(expiredOrders)
    ;(prisma.paidEventOrder.update as jest.Mock).mockResolvedValue({ id: 'order-expired-1' })
    ;(prisma.payment.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.registration.update as jest.Mock).mockResolvedValue({ id: 'reg-waitlist-1' })
    ;(offerNextPaidWaitlistSpot as jest.Mock).mockResolvedValue({ success: true })

    const result = await cleanupExpiredPaidEventHolds()

    expect(result.expiredCount).toBe(2)
    expect(result.promotedCount).toBe(2)

    // Verify order updates
    expect(prisma.paidEventOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-expired-1' },
      data: { status: 'EXPIRED' },
    })
    expect(prisma.paidEventOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-expired-2' },
      data: { status: 'EXPIRED' },
    })

    // Verify payment fails
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { paidEventOrderId: 'order-expired-1', status: 'PENDING' },
      data: { status: 'FAILED' },
    })

    // Verify waitlist promotion registration update
    expect(prisma.registration.update).toHaveBeenCalledWith({
      where: { id: 'reg-waitlist-1' },
      data: { status: 'waitlist-offer-expired' },
    })

    // Verify next waitlist candidate is invited
    expect(offerNextPaidWaitlistSpot).toHaveBeenCalledWith('event-101', 'tier-vip')
    expect(offerNextPaidWaitlistSpot).toHaveBeenCalledWith('event-101', 'tier-standard')
  })

  it('continues cleanly and processes subsequent orders even if one update throws an error', async () => {
    const expiredOrders = [
      {
        id: 'order-failing',
        eventId: 'event-101',
        ticketTierId: 'tier-vip',
        promotionRegistrationId: null,
      },
      {
        id: 'order-succeeding',
        eventId: 'event-101',
        ticketTierId: 'tier-standard',
        promotionRegistrationId: null,
      },
    ]

    ;(prisma.paidEventOrder.findMany as jest.Mock).mockResolvedValue(expiredOrders)
    ;(prisma.$transaction as jest.Mock)
      .mockRejectedValueOnce(new Error('Deadlock / Connection abort'))
      .mockImplementationOnce(async (cb) => cb(prisma))

    const result = await cleanupExpiredPaidEventHolds()

    // 1 failed, 1 succeeded
    expect(result.expiredCount).toBe(1)
    expect(result.promotedCount).toBe(1)
  })
})
