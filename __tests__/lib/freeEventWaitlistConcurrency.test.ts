/** @jest-environment node */

import { promoteNextFreeWaitlistSpot } from '@/lib/freeEventWaitlist'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => {
  const mockTx = {
    $queryRaw: jest.fn(),
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    registration: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  }

  return {
    __esModule: true,
    default: {
      $transaction: jest.fn(async (cb: (tx: typeof mockTx) => Promise<any>, _opts?: any) => {
        return await cb(mockTx)
      }),
      event: mockTx.event,
      registration: mockTx.registration,
      _mockTx: mockTx,
    },
  }
})

jest.mock('@/lib/confirmationCode', () => ({
  generateConfirmationCode: jest.fn(() => 'TEST-CONFIRM-CODE'),
}))

describe('Free-event waitlist atomic promotion & concurrency safeguards', () => {
  const mockPrisma = prisma as unknown as {
    $transaction: jest.Mock
    _mockTx: {
      $queryRaw: jest.Mock
      event: {
        findUnique: jest.Mock
        update: jest.Mock
      }
      registration: {
        findFirst: jest.Mock
        updateMany: jest.Mock
      }
    }
  }
  const tx = mockPrisma._mockTx

  beforeEach(() => {
    jest.clearAllMocks()
    tx.$queryRaw.mockResolvedValue([])
  })

  it('promotes the next waitlisted attendee atomically when capacity is available', async () => {
    tx.event.findUnique.mockResolvedValue({
      id: 'event-100',
      capacity: 50,
      confirmedCount: 49,
      waitlistCount: 3,
    })

    tx.registration.findFirst.mockResolvedValue({
      id: 'reg-wait-1',
      attendeeEmail: 'first@example.com',
      waitlistPosition: 1,
      confirmationCode: null,
      qrCode: null,
      consentTransactional: true,
    })

    tx.registration.updateMany
      .mockResolvedValueOnce({ count: 1 }) // Candidate updateMany
      .mockResolvedValueOnce({ count: 2 }) // Subsequent positions decrement

    tx.event.update.mockResolvedValue({
      id: 'event-100',
      confirmedCount: 50,
      waitlistCount: 2,
    })

    const result = await promoteNextFreeWaitlistSpot('event-100')

    expect(result).toEqual({
      id: 'reg-wait-1',
      attendeeEmail: 'first@example.com',
      consentTransactional: true,
      confirmationCode: 'TEST-CONFIRM-CODE',
    })

    // Verify row lock was requested
    expect(tx.$queryRaw).toHaveBeenCalled()

    // Verify conditional update guard checked status: 'waitlist'
    expect(tx.registration.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'reg-wait-1',
        status: 'waitlist',
      },
      data: expect.objectContaining({
        status: 'confirmed',
        waitlistPosition: null,
        confirmationCode: 'TEST-CONFIRM-CODE',
      }),
    })

    // Verify position shift on remaining attendees
    expect(tx.registration.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        eventId: 'event-100',
        status: 'waitlist',
        ticketTierId: null,
        waitlistPosition: { gt: 1 },
      },
      data: {
        waitlistPosition: { decrement: 1 },
      },
    })

    // Verify event counts updated
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: 'event-100' },
      data: {
        confirmedCount: { increment: 1 },
        waitlistCount: { decrement: 1 },
      },
    })
  })

  it('returns null and aborts if event capacity is already full under the lock', async () => {
    tx.event.findUnique.mockResolvedValue({
      id: 'event-full',
      capacity: 50,
      confirmedCount: 50,
      waitlistCount: 5,
    })

    const result = await promoteNextFreeWaitlistSpot('event-full')

    expect(result).toBeNull()
    expect(tx.registration.findFirst).not.toHaveBeenCalled()
    expect(tx.registration.updateMany).not.toHaveBeenCalled()
    expect(tx.event.update).not.toHaveBeenCalled()
  })

  it('returns null if no waitlisted registrations exist for the event', async () => {
    tx.event.findUnique.mockResolvedValue({
      id: 'event-empty-waitlist',
      capacity: 100,
      confirmedCount: 10,
      waitlistCount: 0,
    })

    tx.registration.findFirst.mockResolvedValue(null)

    const result = await promoteNextFreeWaitlistSpot('event-empty-waitlist')

    expect(result).toBeNull()
    expect(tx.registration.updateMany).not.toHaveBeenCalled()
    expect(tx.event.update).not.toHaveBeenCalled()
  })

  it('safely handles competing concurrent promotion where candidate was claimed by another worker', async () => {
    tx.event.findUnique.mockResolvedValue({
      id: 'event-race',
      capacity: 20,
      confirmedCount: 19,
      waitlistCount: 2,
    })

    tx.registration.findFirst.mockResolvedValue({
      id: 'reg-race-candidate',
      attendeeEmail: 'race@example.com',
      waitlistPosition: 1,
      confirmationCode: null,
      qrCode: null,
      consentTransactional: true,
    })

    // Competing update returned 0 because another worker updated status to 'confirmed'
    tx.registration.updateMany.mockResolvedValueOnce({ count: 0 })

    const result = await promoteNextFreeWaitlistSpot('event-race')

    expect(result).toBeNull()
    // Event count must NOT be incremented if promotion conditional check failed
    expect(tx.event.update).not.toHaveBeenCalled()
  })

  it('propagates real database locking errors to prevent silent data corruption', async () => {
    const deadlockError = new Error('deadlock detected')
    ;(deadlockError as any).code = '40P01'
    ;(deadlockError as any).name = 'PrismaClientKnownRequestError'

    tx.$queryRaw.mockRejectedValue(deadlockError)

    await expect(promoteNextFreeWaitlistSpot('event-deadlock')).rejects.toThrow('deadlock detected')
  })
})
