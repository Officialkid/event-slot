/** @jest-environment node */

import { NextRequest } from 'next/server'
import { DELETE, GET, POST } from '@/app/api/register/draft/route'

const mockEventFindUnique = jest.fn()
const mockDraftFindUnique = jest.fn()
const mockDraftUpsert = jest.fn()
const mockDraftDeleteMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
    registrationDraft: {
      findUnique: (...args: unknown[]) => mockDraftFindUnique(...args),
      upsert: (...args: unknown[]) => mockDraftUpsert(...args),
      deleteMany: (...args: unknown[]) => mockDraftDeleteMany(...args),
    },
  },
}))

describe('registration draft route', () => {
  beforeEach(() => {
    mockEventFindUnique.mockReset()
    mockDraftFindUnique.mockReset()
    mockDraftUpsert.mockReset()
    mockDraftDeleteMany.mockReset()
  })

  it('returns an existing draft by event slug and email', async () => {
    mockEventFindUnique.mockResolvedValue({ id: 'event-1' })
    mockDraftFindUnique.mockResolvedValue({
      id: 'draft-1',
      email: 'saved@example.com',
      attendeeCount: 1,
    })

    const response = await GET(
      new NextRequest('http://localhost/api/register/draft?eventSlug=test-event&email=saved@example.com')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.draft?.id).toBe('draft-1')
    expect(mockDraftFindUnique).toHaveBeenCalledWith({
      where: {
        eventId_email: {
          eventId: 'event-1',
          email: 'saved@example.com',
        },
      },
    })
  })

  it('upserts a draft payload', async () => {
    mockEventFindUnique.mockResolvedValue({ id: 'event-1' })
    mockDraftUpsert.mockResolvedValue({ id: 'draft-2' })

    const response = await POST(
      new NextRequest('http://localhost/api/register/draft', {
        method: 'POST',
        body: JSON.stringify({
          eventSlug: 'test-event',
          email: 'saved@example.com',
          answers: [{ fullName: 'Jane Doe' }],
          attendeeCount: 1,
          baseEmails: ['saved@example.com'],
          consentDataProcessing: true,
          consentTransactional: true,
          consentMarketing: false,
          sendResponseCopy: true,
        }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockDraftUpsert).toHaveBeenCalled()
  })

  it('deletes a saved draft', async () => {
    mockEventFindUnique.mockResolvedValue({ id: 'event-1' })
    mockDraftDeleteMany.mockResolvedValue({ count: 1 })

    const response = await DELETE(
      new NextRequest('http://localhost/api/register/draft?eventSlug=test-event&email=saved@example.com', {
        method: 'DELETE',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockDraftDeleteMany).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        email: 'saved@example.com',
      },
    })
  })
})
