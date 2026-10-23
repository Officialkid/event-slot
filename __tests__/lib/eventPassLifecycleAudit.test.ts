/** @jest-environment node */

import { needsEventPassSync, syncEventPassStatusForEvent, EventWithPassData } from '@/lib/eventPasses'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => {
  const eventPass = {
    update: jest.fn(),
  }
  const event = {
    findUnique: jest.fn(),
  }
  return {
    __esModule: true,
    default: { eventPass, event },
    prisma: { eventPass, event },
  }
})

describe('Event Pass Lifecycle & State Transitions Audit', () => {
  const fixedNow = new Date('2026-10-23T12:00:00Z')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('1. Active and Unexpired Pass', () => {
    it('returns false and performs no update when pass is ACTIVE and expiry matches end date', async () => {
      const futureEnd = new Date('2026-10-25T18:00:00Z')
      const event: EventWithPassData = {
        id: 'evt_1',
        status: 'active',
        archived: false,
        eventDate: new Date('2026-10-25T09:00:00Z'),
        eventEndAt: futureEnd,
        eventPass: {
          id: 'pass_1',
          status: 'ACTIVE',
          expiresAt: futureEnd,
        },
      }

      expect(needsEventPassSync(event, fixedNow)).toBe(false)
      const res = await syncEventPassStatusForEvent(event, fixedNow)
      expect(res).toBeNull()
      expect(prisma.eventPass.update).not.toHaveBeenCalled()
    })

    it('updates expiresAt without changing ACTIVE status when event end time was rescheduled', async () => {
      const oldEnd = new Date('2026-10-25T18:00:00Z')
      const newEnd = new Date('2026-10-26T20:00:00Z')
      const event: EventWithPassData = {
        id: 'evt_rescheduled',
        status: 'active',
        archived: false,
        eventDate: new Date('2026-10-26T09:00:00Z'),
        eventEndAt: newEnd,
        eventPass: {
          id: 'pass_rescheduled',
          status: 'ACTIVE',
          expiresAt: oldEnd,
        },
      }

      expect(needsEventPassSync(event, fixedNow)).toBe(true)
      ;(prisma.eventPass.update as jest.Mock).mockResolvedValue({ id: 'pass_rescheduled', expiresAt: newEnd })

      const res = await syncEventPassStatusForEvent(event, fixedNow)
      expect(prisma.eventPass.update).toHaveBeenCalledWith({
        where: { id: 'pass_rescheduled' },
        data: { expiresAt: newEnd },
      })
      expect(event.eventPass?.status).toBe('ACTIVE')
      expect(event.eventPass?.expiresAt).toEqual(newEnd)
    })
  })

  describe('2. Active but Expired Pass', () => {
    it('transitions ACTIVE pass to EXPIRED when current time is past expiry', async () => {
      const pastEnd = new Date('2026-10-20T18:00:00Z')
      const event: EventWithPassData = {
        id: 'evt_expired',
        status: 'active',
        archived: false,
        eventDate: new Date('2026-10-20T09:00:00Z'),
        eventEndAt: pastEnd,
        eventPass: {
          id: 'pass_expired',
          status: 'ACTIVE',
          expiresAt: pastEnd,
        },
      }

      expect(needsEventPassSync(event, fixedNow)).toBe(true)
      ;(prisma.eventPass.update as jest.Mock).mockResolvedValue({
        id: 'pass_expired',
        status: 'EXPIRED',
        expiresAt: pastEnd,
      })

      const res = await syncEventPassStatusForEvent(event, fixedNow)
      expect(prisma.eventPass.update).toHaveBeenCalledWith({
        where: { id: 'pass_expired' },
        data: {
          status: 'EXPIRED',
          expiresAt: pastEnd,
        },
      })
      expect(event.eventPass?.status).toBe('EXPIRED')
      expect(event.eventPass?.expiresAt).toEqual(pastEnd)
    })
  })

  describe('3. Event Cancellation and Archival', () => {
    it('transitions ACTIVE pass to CANCELLED when event is marked cancelled', async () => {
      const futureEnd = new Date('2026-10-30T18:00:00Z')
      const event: EventWithPassData = {
        id: 'evt_cancelled',
        status: 'cancelled',
        archived: false,
        eventDate: new Date('2026-10-30T09:00:00Z'),
        eventEndAt: futureEnd,
        eventPass: {
          id: 'pass_cancel',
          status: 'ACTIVE',
          expiresAt: futureEnd,
        },
      }

      expect(needsEventPassSync(event, fixedNow)).toBe(true)
      ;(prisma.eventPass.update as jest.Mock).mockResolvedValue({
        id: 'pass_cancel',
        status: 'CANCELLED',
        cancelledAt: fixedNow,
        expiresAt: fixedNow,
      })

      const res = await syncEventPassStatusForEvent(event, fixedNow)
      expect(prisma.eventPass.update).toHaveBeenCalledWith({
        where: { id: 'pass_cancel' },
        data: {
          status: 'CANCELLED',
          cancelledAt: fixedNow,
          expiresAt: fixedNow,
        },
      })
      expect(event.eventPass?.status).toBe('CANCELLED')
      expect(event.eventPass?.expiresAt).toEqual(fixedNow)
    })

    it('transitions pass to CANCELLED when event.archived is true', async () => {
      const futureEnd = new Date('2026-10-30T18:00:00Z')
      const event: EventWithPassData = {
        id: 'evt_archived',
        status: 'active',
        archived: true,
        eventDate: new Date('2026-10-30T09:00:00Z'),
        eventEndAt: futureEnd,
        eventPass: {
          id: 'pass_archived',
          status: 'ACTIVE',
          expiresAt: futureEnd,
        },
      }

      expect(needsEventPassSync(event, fixedNow)).toBe(true)
      ;(prisma.eventPass.update as jest.Mock).mockResolvedValue({
        id: 'pass_archived',
        status: 'CANCELLED',
        cancelledAt: fixedNow,
        expiresAt: fixedNow,
      })

      const res = await syncEventPassStatusForEvent(event, fixedNow)
      expect(prisma.eventPass.update).toHaveBeenCalledWith({
        where: { id: 'pass_archived' },
        data: {
          status: 'CANCELLED',
          cancelledAt: fixedNow,
          expiresAt: fixedNow,
        },
      })
      expect(event.eventPass?.status).toBe('CANCELLED')
    })
  })

  describe('4. Terminal State Protection (Non-Reactivation)', () => {
    it('does NOT reactivate a CANCELLED pass even if the event status is restored to active', async () => {
      const futureEnd = new Date('2026-10-30T18:00:00Z')
      const event: EventWithPassData = {
        id: 'evt_restored',
        status: 'active',
        archived: false,
        eventDate: new Date('2026-10-30T09:00:00Z'),
        eventEndAt: futureEnd,
        eventPass: {
          id: 'pass_terminal_cancelled',
          status: 'CANCELLED',
          expiresAt: fixedNow,
        },
      }

      // Verified: Cancelled passes are terminal; cannot transition back to ACTIVE
      expect(needsEventPassSync(event, fixedNow)).toBe(false)
      const res = await syncEventPassStatusForEvent(event, fixedNow)
      expect(res).toBeNull()
      expect(prisma.eventPass.update).not.toHaveBeenCalled()
      expect(event.eventPass?.status).toBe('CANCELLED')
    })

    it('does NOT reactivate an EXPIRED pass even if the event date is moved to the future', async () => {
      const newFutureEnd = new Date('2026-11-15T18:00:00Z')
      const event: EventWithPassData = {
        id: 'evt_expired_future_date',
        status: 'active',
        archived: false,
        eventDate: new Date('2026-11-15T09:00:00Z'),
        eventEndAt: newFutureEnd,
        eventPass: {
          id: 'pass_terminal_expired',
          status: 'EXPIRED',
          expiresAt: new Date('2026-10-01T18:00:00Z'),
        },
      }

      // Verified: EXPIRED status is terminal regarding active state
      expect(needsEventPassSync(event, fixedNow)).toBe(false)
      const res = await syncEventPassStatusForEvent(event, fixedNow)
      expect(res).toBeNull()
      expect(prisma.eventPass.update).not.toHaveBeenCalled()
      expect(event.eventPass?.status).toBe('EXPIRED')
    })
  })

  describe('5. Missing Pass and Null Safety', () => {
    it('returns false and does nothing when eventPass is null or undefined', async () => {
      const event: EventWithPassData = {
        id: 'evt_no_pass',
        status: 'active',
        eventPass: null,
      }

      expect(needsEventPassSync(event, fixedNow)).toBe(false)
      const res = await syncEventPassStatusForEvent(event, fixedNow)
      expect(res).toBeNull()
      expect(prisma.eventPass.update).not.toHaveBeenCalled()
    })

    it('does not expire an active pass when event dates are null', async () => {
      const event: EventWithPassData = {
        id: 'evt_no_dates',
        status: 'active',
        archived: false,
        eventDate: null,
        eventEndAt: null,
        eventPass: {
          id: 'pass_no_dates',
          status: 'ACTIVE',
          expiresAt: null,
        },
      }

      expect(needsEventPassSync(event, fixedNow)).toBe(false)
      const res = await syncEventPassStatusForEvent(event, fixedNow)
      expect(res).toBeNull()
      expect(prisma.eventPass.update).not.toHaveBeenCalled()
    })
  })

  describe('6. Idempotency & Repeated Executions', () => {
    it('is strictly idempotent on successive calls', async () => {
      const pastEnd = new Date('2026-10-20T18:00:00Z')
      const event: EventWithPassData = {
        id: 'evt_idempotent',
        status: 'active',
        archived: false,
        eventDate: pastEnd,
        eventEndAt: pastEnd,
        eventPass: {
          id: 'pass_idempotent',
          status: 'ACTIVE',
          expiresAt: pastEnd,
        },
      }

      ;(prisma.eventPass.update as jest.Mock).mockResolvedValue({
        id: 'pass_idempotent',
        status: 'EXPIRED',
        expiresAt: pastEnd,
      })

      // First run: executes update and changes status to EXPIRED
      const firstRes = await syncEventPassStatusForEvent(event, fixedNow)
      expect(prisma.eventPass.update).toHaveBeenCalledTimes(1)
      expect(event.eventPass?.status).toBe('EXPIRED')

      // Second run: needsEventPassSync is now false, syncEventPassStatusForEvent does nothing
      expect(needsEventPassSync(event, fixedNow)).toBe(false)
      const secondRes = await syncEventPassStatusForEvent(event, fixedNow)
      expect(secondRes).toBeNull()
      expect(prisma.eventPass.update).toHaveBeenCalledTimes(1) // Still 1!
    })
  })
})
