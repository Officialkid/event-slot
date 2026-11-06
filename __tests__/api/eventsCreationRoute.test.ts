/** @jest-environment node */

import { POST } from '@/app/api/events/route'
import { getServerSession } from 'next-auth'
import { createEventDomainService } from '@/lib/events/event-creation-service'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/geoip', () => ({
  detectCountry: jest.fn().mockResolvedValue('KE'),
}))

jest.mock('@/lib/events/event-creation-service', () => ({
  createEventDomainService: jest.fn(),
}))

const mockedGetServerSession = getServerSession as jest.Mock
const mockedCreateEventDomainService = createEventDomainService as jest.Mock

describe('POST /api/events', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function buildRequest(body: any, isMalformedJson = false): NextRequest {
    return {
      json: isMalformedJson
        ? jest.fn().mockRejectedValue(new Error('SyntaxError'))
        : jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest
  }

  it('returns 401 when user is not authenticated', async () => {
    mockedGetServerSession.mockResolvedValue(null)

    const res = await POST(buildRequest({}))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when body is malformed JSON', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' },
    })

    const res = await POST(buildRequest({}, true))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Invalid JSON body')
  })

  it('returns 400 when body fails schema validation', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' },
    })

    // Missing title and organizerName
    const res = await POST(buildRequest({ title: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBeDefined()
    expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
  })

  it('delegates to createEventDomainService and returns 201 on success', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' },
    })

    mockedCreateEventDomainService.mockResolvedValue({
      success: true,
      event: {
        id: 'event-uuid-1',
        title: 'Valid Event',
        slug: 'valid-event-1234',
        dashboardToken: 'tok-1',
        verifierCode: 'VER1',
        visibility: 'PRIVATE',
        accessType: 'REGISTRATION',
        capacity: 100,
      },
    })

    const validBody = {
      title: 'Valid Event',
      organizerName: 'Organizer Name',
      visibility: 'PRIVATE',
      accessType: 'REGISTRATION',
      eventType: 'PHYSICAL',
      location: 'Nairobi',
      capacity: 100,
    }

    const res = await POST(buildRequest(validBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.event.title).toBe('Valid Event')

    expect(mockedCreateEventDomainService).toHaveBeenCalledTimes(1)
    const callArgs = mockedCreateEventDomainService.mock.calls[0][0]
    expect(callArgs.actor.userId).toBe('user-1')
    expect(callArgs.countryCode).toBe('KE')
    expect(callArgs.sideEffects).toBe(true)
  })

  it('maps domain service failures with the exact status code and payload', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' },
    })

    mockedCreateEventDomainService.mockResolvedValue({
      success: false,
      status: 403,
      code: 'FORBIDDEN',
      error: 'You are not authorized to create events in this workspace.',
    })

    const validBody = {
      title: 'Valid Event',
      organizerName: 'Organizer Name',
      asOrganizationId: 'forbidden-org-id',
    }

    const res = await POST(buildRequest(validBody))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('FORBIDDEN')
    expect(json.error).toBe('You are not authorized to create events in this workspace.')
  })
})
