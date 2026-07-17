/** @jest-environment node */

import { NextRequest } from 'next/server'

const mockGetServerSession = jest.fn()
const mockEventFindUnique = jest.fn()
const mockRegistrationFindMany = jest.fn()
const mockPaymentFindMany = jest.fn()
const mockPaidEventOrderFindMany = jest.fn()
const mockIsAdminEmail = jest.fn()
const mockHasTeamEventAccess = jest.fn()
const mockReportLimit = jest.fn()
const mockDocumentRateLimit = jest.fn()
const mockGenerateEventReport = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
    registration: {
      findMany: (...args: unknown[]) => mockRegistrationFindMany(...args),
    },
    payment: {
      findMany: (...args: unknown[]) => mockPaymentFindMany(...args),
    },
    paidEventOrder: {
      findMany: (...args: unknown[]) => mockPaidEventOrderFindMany(...args),
    },
  },
}))

jest.mock('@/lib/isAdmin', () => ({
  isAdminEmail: (...args: unknown[]) => mockIsAdminEmail(...args),
}))

jest.mock('@/lib/eventAccess', () => ({
  hasTeamEventAccess: (...args: unknown[]) => mockHasTeamEventAccess(...args),
}))

jest.mock('@/lib/ratelimit', () => ({
  reportDownloadRatelimit: {
    limit: (...args: unknown[]) => mockReportLimit(...args),
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockDocumentRateLimit(...args),
}))

jest.mock('@/lib/generateEventReport', () => ({
  generateEventReport: (...args: unknown[]) => mockGenerateEventReport(...args),
}))

const event = {
  id: 'event-1',
  title: 'Free Report Event',
  slug: 'free-report-event',
  organizerId: 'owner-1',
  organizerEmail: 'owner@example.com',
  confirmedCount: 1,
  waitlistCount: 0,
  capacity: 50,
  isPaid: false,
  currency: 'KES',
  eventDate: new Date('2026-08-01T10:00:00Z'),
  location: 'Nairobi',
  deadline: new Date('2026-07-30T10:00:00Z'),
  createdAt: new Date('2026-07-01T10:00:00Z'),
  questions: [{ id: 'q1', label: 'Full name', type: 'text' }],
  dashboardToken: 'dash-token',
  organizer: { id: 'owner-1' },
}

const registration = {
  id: 'reg-1',
  status: 'confirmed',
  answers: [{ questionId: 'q1', value: 'Amina Demo' }],
  registrationNumber: 1,
  submittedAt: new Date('2026-07-10T10:00:00Z'),
  waitlistPosition: null,
}

function makeRequest(path: string) {
  return new NextRequest(`https://www.eventsslot.com${path}`)
}

function props(slug = 'free-report-event') {
  return { params: Promise.resolve({ slug }) }
}

describe('GET /api/events/[slug]/report free rollout access', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetServerSession.mockReset()
    mockEventFindUnique.mockReset()
    mockRegistrationFindMany.mockReset()
    mockPaymentFindMany.mockReset()
    mockPaidEventOrderFindMany.mockReset()
    mockIsAdminEmail.mockReset()
    mockHasTeamEventAccess.mockReset()
    mockReportLimit.mockReset()
    mockDocumentRateLimit.mockReset()
    mockGenerateEventReport.mockReset()

    mockGetServerSession.mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } })
    mockEventFindUnique.mockResolvedValue(event)
    mockRegistrationFindMany.mockResolvedValue([registration])
    mockPaymentFindMany.mockResolvedValue([])
    mockPaidEventOrderFindMany.mockResolvedValue([])
    mockIsAdminEmail.mockReturnValue(false)
    mockHasTeamEventAccess.mockResolvedValue(false)
    mockReportLimit.mockResolvedValue({ success: true })
    mockDocumentRateLimit.mockResolvedValue({ allowed: true })
    mockGenerateEventReport.mockResolvedValue(Buffer.from('fake-docx'))
  })

  it('returns a free preview for an authorized organizer without download credits or payment price', async () => {
    const { GET } = await import('@/app/api/events/[slug]/report/route')
    const response = await GET(makeRequest('/api/events/free-report-event/report?mode=preview'), props())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.downloadsRemaining).toBeNull()
    expect(body.downloadCostDownloads).toBe(0)
    expect(body.downloadPriceKsh).toBe(0)
    expect(body.accessNote).toContain('free')
    expect(mockPaymentFindMany).not.toHaveBeenCalled()
  })

  it('allows assigned team members to preview the free report', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'team-1', email: 'team@example.com' } })
    mockHasTeamEventAccess.mockResolvedValue(true)

    const { GET } = await import('@/app/api/events/[slug]/report/route')
    const response = await GET(makeRequest('/api/events/free-report-event/report?mode=preview'), props())

    expect(response.status).toBe(200)
    expect(mockHasTeamEventAccess).toHaveBeenCalledWith({
      userId: 'team-1',
      organizerId: 'owner-1',
      eventId: 'event-1',
    })
  })

  it('generates a DOCX download for authorized users without checking purchase balance', async () => {
    const { GET } = await import('@/app/api/events/[slug]/report/route')
    const response = await GET(makeRequest('/api/events/free-report-event/report?mode=download'), props())

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(mockDocumentRateLimit).toHaveBeenCalledWith('owner-1', 'DOCUMENT_GENERATION', 10, 60)
    expect(mockGenerateEventReport).toHaveBeenCalledTimes(1)
  })

  it('blocks unauthorised users before exposing report data', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'stranger-1', email: 'stranger@example.com' } })

    const { GET } = await import('@/app/api/events/[slug]/report/route')
    const response = await GET(makeRequest('/api/events/free-report-event/report?mode=preview'), props())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
    expect(mockRegistrationFindMany).not.toHaveBeenCalled()
  })
})

export {}
