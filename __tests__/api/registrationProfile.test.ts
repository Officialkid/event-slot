/** @jest-environment node */

/**
 * Test Suite: /api/me/registration-profile
 * 
 * Verifies Workstream 3 (Registration UX & Privacy-Guarded Prefill):
 * - Unauthenticated requests receive 401 Unauthorized
 * - Authenticated user without prior registrations returns basic user account claims
 * - Authenticated user with prior registration returns recurrent contact profile (name, phone, location, organization, jobTitle)
 * - Ephemeral/event-specific answers (expectations, sizing, dietary, breakout tracks) are strictly excluded
 * - Cross-user privacy isolation: queries are scoped strictly to the authenticated user's email
 * - Malformed answers JSON or empty records are safely handled without throwing
 */

import { GET } from '@/app/api/me/registration-profile/route'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'

jest.mock('@/lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
  registration: {
    findFirst: jest.fn(),
  },
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('GET /api/me/registration-profile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 if the session user cannot be found in the database', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'usr-missing-123' },
    })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.error).toBe('User not found')
  })

  it('returns basic account profile for first-time attendees without prior registrations', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'usr-first-time-1' },
    })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr-first-time-1',
      name: 'Alice Wambui',
      email: 'alice@example.com',
      countryName: 'Kenya',
      countryCode: 'KE',
    })
    ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.source).toBe('verified_account')
    expect(data.profile).toEqual({
      name: 'Alice Wambui',
      email: 'alice@example.com',
      location: 'Kenya',
    })
  })

  it('extracts recurrent fields from prior registration while strictly discarding ephemeral questions', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'usr-returning-2' },
    })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr-returning-2',
      name: 'Bob Kiprono',
      email: 'bob@example.com',
      countryName: null,
      countryCode: null,
    })

    // Prior registration contains both recurrent fields and ephemeral event-specific questions
    ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue({
      attendeeEmail: 'bob@example.com',
      submittedAt: new Date('2026-05-01T10:00:00Z'),
      answers: [
        { questionId: 'phone', label: 'Mobile Phone', value: '+254700112233' },
        { questionId: 'city', label: 'City of Residence', value: 'Nairobi' },
        { questionId: 'company', label: 'Company / Organization', value: 'Safari Tech Ltd' },
        { questionId: 'role', label: 'Job Title / Position', value: 'Senior Lead Architect' },
        // Ephemeral answers that must NEVER be extracted:
        { questionId: 'expectations', label: 'What do you expect to learn?', value: 'Advanced AI Scaling' },
        { questionId: 'dietary', label: 'Dietary requirements', value: 'Halal only' },
        { questionId: 'tshirt', label: 'T-Shirt Size', value: 'XL' },
        { questionId: 'track', label: 'Breakout Session Track', value: 'Track B - Web3' },
      ],
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.profile).toEqual({
      name: 'Bob Kiprono',
      email: 'bob@example.com',
      phone: '+254700112233',
      location: 'Nairobi',
      organization: 'Safari Tech Ltd',
      jobTitle: 'Senior Lead Architect',
    })

    // Assert that ephemeral fields were not attached
    expect(data.profile.expectations).toBeUndefined()
    expect(data.profile.dietary).toBeUndefined()
    expect(data.profile.tshirt).toBeUndefined()
    expect(data.profile.track).toBeUndefined()

    // Assert database query was strictly scoped to authenticated user's email
    expect(prisma.registration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          attendeeEmail: { equals: 'bob@example.com', mode: 'insensitive' },
        }),
      })
    )
  })

  it('handles object-formatted answers from legacy registrations', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'usr-returning-3' },
    })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr-returning-3',
      name: null,
      email: 'carol@example.com',
      countryName: null,
      countryCode: null,
    })

    ;(prisma.registration.findFirst as jest.Mock).mockResolvedValue({
      attendeeEmail: 'carol@example.com',
      submittedAt: new Date('2026-06-01T12:00:00Z'),
      answers: {
        fullname: 'Carol Danvers',
        phone: '+254799887766',
        organization: 'Starfleet Systems',
      },
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.profile.name).toBe('Carol Danvers')
    expect(data.profile.phone).toBe('+254799887766')
    expect(data.profile.organization).toBe('Starfleet Systems')
  })

  it('catches unexpected database errors gracefully with 500', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'usr-err' },
    })
    ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB connection failed'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Internal server error')
  })
})
