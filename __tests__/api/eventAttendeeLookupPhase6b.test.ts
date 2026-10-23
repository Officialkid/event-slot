/** @jest-environment node */

/**
 * __tests__/api/eventAttendeeLookupPhase6b.test.ts
 *
 * Phase 06B, Step 2: Automated verification of optimized attendee lookup.
 * Verifies:
 * 1. Selective indexed lookup by email (uses findFirst, does NOT call findMany).
 * 2. Selective indexed lookup by confirmation code (EVT-prefix and 8-char suffix, does NOT call findMany).
 * 3. Exact full name matching and case-insensitivity.
 * 4. Fallthrough safety for 8-char names (e.g. "Benjamin" not misrouted as confirmation code).
 * 5. Input validation (query < 3 chars rejected with 400).
 * 6. Non-existent event handling (404).
 * 7. Ineligible registration statuses (cancelled/draft rejected).
 * 8. Status envelope preservation (CONFIRMED vs WAITLISTED vs NOT_REGISTERED).
 * 9. Event scoping (registrations from other events not matched).
 * 10. Rate-limiting protection (429 when rate limit exhausted).
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/events/[slug]/lookup/route'
import prisma from '@/lib/prisma'
import { ratelimit } from '@/lib/ratelimit'

jest.mock('@/lib/prisma', () => ({
  event: {
    findUnique: jest.fn(),
  },
  registration: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
}))

jest.mock('@/lib/ratelimit', () => ({
  ratelimit: {
    limit: jest.fn(),
  },
}))

describe('Phase 06B, Step 2: Attendee Lookup Optimization', () => {
  const mockEvent = {
    id: 'evt_alpha_123',
    slug: 'tech-summit-2026',
    title: 'Tech Summit 2026',
    ticketsEnabled: true,
    eventDate: new Date('2026-11-15T09:00:00Z'),
    location: 'Nairobi Convention Centre',
    questions: [
      { id: 'q_name', type: 'text', label: 'Full Name' },
      { id: 'q_company', type: 'text', label: 'Organization' },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(ratelimit.limit as jest.Mock).mockResolvedValue({ success: true })
    ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
  })

  describe('Input Validation & Scoping', () => {
    it('returns 400 when search query is shorter than 3 characters', async () => {
      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=ab')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ error: 'Search query must be at least 3 characters' })
      expect(prisma.registration.findFirst).not.toHaveBeenCalled()
      expect(prisma.registration.findMany).not.toHaveBeenCalled()
    })

    it('returns 404 when event is not found', async () => {
      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/events/non-existent/lookup?q=jane@example.com')
      const res = await GET(req, { params: Promise.resolve({ slug: 'non-existent' }) })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data).toEqual({ error: 'Event not found' })
    })

    it('returns 429 when lookup rate limit is exceeded', async () => {
      ;(ratelimit.limit as jest.Mock).mockResolvedValue({ success: false })

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=jane@example.com')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(429)
      const data = await res.json()
      expect(data).toEqual({ error: 'Too many lookup requests. Please try again shortly.' })
      expect(prisma.event.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('Email Lookup & Database Selectivity', () => {
    it('performs selective indexed findFirst query for email and does NOT call findMany', async () => {
      const mockReg = {
        id: 'reg_101',
        status: 'confirmed',
        registrationNumber: 42,
        waitlistPosition: null,
        attendeeEmail: 'jane.doe@example.com',
        confirmationCode: 'EVT-ABC12345',
        answers: [{ questionId: 'q_name', value: 'Jane Doe' }],
      }
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(mockReg)

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=jane.doe@example.com')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(200)
      const data = await res.json()

      // Proof of selective database query
      expect(prisma.registration.findFirst).toHaveBeenCalledWith({
        where: {
          eventId: 'evt_alpha_123',
          status: { in: ['confirmed', 'waitlist'] },
          attendeeEmail: { equals: 'jane.doe@example.com', mode: 'insensitive' },
        },
        orderBy: { submittedAt: 'desc' },
        select: expect.any(Object),
      })
      expect(prisma.registration.findMany).not.toHaveBeenCalled()

      // Exact response envelope check
      expect(data).toEqual({
        found: true,
        status: 'CONFIRMED',
        attendeeName: 'Jane Doe',
        registrationNumber: 42,
        confirmationCode: 'EVT-ABC12345',
        ticketsEnabled: true,
        canDownloadTicket: true,
        ticketUrl: '/api/tickets/EVT-ABC12345',
      })
    })

    it('returns NOT_REGISTERED envelope when email is not found in database', async () => {
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=unknown@example.com')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        found: false,
        status: 'NOT_REGISTERED',
        message: 'No registration found for this exact name, email, or confirmation code.',
        ticketsEnabled: true,
      })
      expect(prisma.registration.findMany).not.toHaveBeenCalled()
    })
  })

  describe('Confirmation Code Lookup', () => {
    it('performs selective indexed query for EVT-prefixed confirmation code', async () => {
      const mockReg = {
        id: 'reg_202',
        status: 'confirmed',
        registrationNumber: 88,
        waitlistPosition: null,
        attendeeEmail: 'alice@example.com',
        confirmationCode: 'EVT-XYZ98765',
        answers: [{ questionId: 'q_name', value: 'Alice Walker' }],
      }
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(mockReg)

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=evt-xyz98765')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(200)
      const data = await res.json()

      expect(prisma.registration.findFirst).toHaveBeenCalledWith({
        where: {
          eventId: 'evt_alpha_123',
          status: { in: ['confirmed', 'waitlist'] },
          confirmationCode: { in: ['EVT-XYZ98765'], mode: 'insensitive' },
        },
        orderBy: { submittedAt: 'desc' },
        select: expect.any(Object),
      })
      expect(prisma.registration.findMany).not.toHaveBeenCalled()
      expect(data.found).toBe(true)
      expect(data.attendeeName).toBe('Alice Walker')
    })

    it('matches 8-character confirmation code suffix and queries both raw and EVT-prefixed variants', async () => {
      const mockReg = {
        id: 'reg_203',
        status: 'confirmed',
        registrationNumber: 89,
        waitlistPosition: null,
        attendeeEmail: 'bob@example.com',
        confirmationCode: 'EVT-ABC12345',
        answers: [{ questionId: 'q_name', value: 'Bob Vance' }],
      }
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(mockReg)

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=ABC12345')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(200)
      expect(prisma.registration.findFirst).toHaveBeenCalledWith({
        where: {
          eventId: 'evt_alpha_123',
          status: { in: ['confirmed', 'waitlist'] },
          confirmationCode: { in: ['ABC12345', 'EVT-ABC12345'], mode: 'insensitive' },
        },
        orderBy: { submittedAt: 'desc' },
        select: expect.any(Object),
      })
      expect(prisma.registration.findMany).not.toHaveBeenCalled()
    })
  })

  describe('Name Lookup & Fallthrough Safety', () => {
    it('safely falls through from 8-character code check to name matching when query is an 8-letter name', async () => {
      // 8-character name: "Benjamin"
      // Step 1: confirmationCode findFirst returns null
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(null)
      // Step 2: $queryRaw finds the registration by exact name
      const mockReg = {
        id: 'reg_ben',
        status: 'confirmed',
        registrationNumber: 15,
        waitlistPosition: null,
        attendeeEmail: 'ben@example.com',
        confirmationCode: 'EVT-BENJ9999',
        answers: [{ questionId: 'q_name', value: 'Benjamin' }],
      }
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([mockReg])

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=Benjamin')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.found).toBe(true)
      expect(data.attendeeName).toBe('Benjamin')
      expect(prisma.registration.findMany).not.toHaveBeenCalled()
    })

    it('matches multi-word name case-insensitively and requires exact match to prevent harvesting', async () => {
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(null)
      const mockReg = {
        id: 'reg_alex',
        status: 'confirmed',
        registrationNumber: 77,
        waitlistPosition: null,
        attendeeEmail: 'alex@example.com',
        confirmationCode: 'EVT-ALEX1234',
        answers: [{ questionId: 'q_name', value: 'Alexander Hamilton' }],
      }
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([mockReg])

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=alexander hamilton')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.found).toBe(true)
      expect(data.attendeeName).toBe('Alexander Hamilton')
    })

    it('immediately returns NOT_REGISTERED without querying registrations if event has no name questions', async () => {
      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue({
        ...mockEvent,
        questions: [{ id: 'q_feedback', type: 'text', label: 'Any dietary restrictions?' }],
      })

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=Alexander')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.found).toBe(false)
      expect(prisma.registration.findFirst).not.toHaveBeenCalled()
      expect(prisma.registration.findMany).not.toHaveBeenCalled()
      expect(prisma.$queryRaw).not.toHaveBeenCalled()
    })
  })

  describe('Status Scoping and Waitlist Envelope', () => {
    it('returns WAITLISTED status envelope with position and ticketUrl null', async () => {
      const mockWaitlistReg = {
        id: 'reg_wait_1',
        status: 'waitlist',
        registrationNumber: null,
        waitlistPosition: 7,
        attendeeEmail: 'waitlist.user@example.com',
        confirmationCode: null,
        answers: [{ questionId: 'q_name', value: 'Waitlist User' }],
      }
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(mockWaitlistReg)

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=waitlist.user@example.com')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        found: true,
        status: 'WAITLISTED',
        attendeeName: 'Waitlist User',
        registrationNumber: null,
        waitlistPosition: 7,
        ticketsEnabled: true,
        canDownloadTicket: false,
        ticketUrl: null,
      })
    })

    it('rejects ineligible registration statuses (cancelled/draft) via database filter', async () => {
      // prisma.registration.findFirst enforces status: { in: ['confirmed', 'waitlist'] }
      // A cancelled registration will not be returned by findFirst
      ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/events/tech-summit-2026/lookup?q=cancelled.user@example.com')
      const res = await GET(req, { params: Promise.resolve({ slug: 'tech-summit-2026' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.found).toBe(false)
      expect(data.status).toBe('NOT_REGISTERED')
    })
  })
})
