/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/tickets/[confirmationCode]/route'

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockFindUnique = jest.fn()
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    registration: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

// ─── PDF generation mock ──────────────────────────────────────────────────────
const mockGenerateTicketPDF = jest.fn().mockResolvedValue(Buffer.from('fake-pdf-content'))
jest.mock('@/lib/ticket', () => ({
  generateTicketPDF: (...args: unknown[]) => mockGenerateTicketPDF(...args),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(code: string) {
  return new NextRequest(`http://localhost/api/tickets/${code}`, { method: 'GET' })
}
function makeProps(code: string) {
  return { params: Promise.resolve({ confirmationCode: code }) }
}

const confirmedRegistration = {
  id: 'reg-001',
  confirmationCode: 'EVT-ABCD1234',
  status: 'confirmed',
  answers: [{ questionId: 'q1', value: 'Alice Kamau' }],
  event: {
    id: 'event-001',
    title: 'Nairobi Tech Summit 2026',
    eventDate: new Date('2026-09-15T09:00:00Z'),
    location: 'KICC, Nairobi',
    questions: [{ id: 'q1', type: 'text', label: 'Full Name' }],
    ticketsEnabled: true,
    organizer: { name: 'Tech Kenya' },
  },
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('GET /api/tickets/[confirmationCode]', () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockGenerateTicketPDF.mockReset()
    mockGenerateTicketPDF.mockResolvedValue(Buffer.from('fake-pdf-content'))
  })

  // ── 404 / Not Found ─────────────────────────────────────────────────────────
  it('returns 404 when registration does not exist', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(makeRequest('EVT-NOTFOUND'), makeProps('EVT-NOTFOUND'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Ticket not found')
  })

  // ── 403 — wrong status ───────────────────────────────────────────────────────
  it('returns 403 when registration status is pending', async () => {
    mockFindUnique.mockResolvedValue({ ...confirmedRegistration, status: 'pending' })
    const res = await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/confirmed/i)
  })

  it('returns 403 when registration status is cancelled', async () => {
    mockFindUnique.mockResolvedValue({ ...confirmedRegistration, status: 'cancelled' })
    const res = await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    expect(res.status).toBe(403)
  })

  // ── 403 — tickets disabled ───────────────────────────────────────────────────
  it('returns 403 when ticketsEnabled is false', async () => {
    mockFindUnique.mockResolvedValue({
      ...confirmedRegistration,
      event: { ...confirmedRegistration.event, ticketsEnabled: false },
    })
    const res = await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/not enabled/i)
  })

  // ── 200 — success ─────────────────────────────────────────────────────────────
  it('returns 200 with application/pdf content-type on success', async () => {
    mockFindUnique.mockResolvedValue(confirmedRegistration)
    const res = await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('sets Content-Disposition attachment with confirmation code in filename', async () => {
    mockFindUnique.mockResolvedValue(confirmedRegistration)
    const res = await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toMatch(/attachment/)
    expect(disposition).toContain('EVT-ABCD1234')
  })

  it('passes correct data to generateTicketPDF', async () => {
    mockFindUnique.mockResolvedValue(confirmedRegistration)
    await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    expect(mockGenerateTicketPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTitle: 'Nairobi Tech Summit 2026',
        attendeeName: 'Alice Kamau',
        ticketId: 'EVT-ABCD1234',
      })
    )
  })

  // ── 500 — PDF generation failure ─────────────────────────────────────────────
  it('returns 500 when PDF generation throws', async () => {
    mockFindUnique.mockResolvedValue(confirmedRegistration)
    mockGenerateTicketPDF.mockRejectedValueOnce(new Error('render failed'))
    const res = await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to generate ticket PDF')
  })

  // ── Attendee name extraction ──────────────────────────────────────────────────
  it('falls back to "Attendee" when no name found in answers', async () => {
    mockFindUnique.mockResolvedValue({ ...confirmedRegistration, answers: [] })
    await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    expect(mockGenerateTicketPDF).toHaveBeenCalledWith(
      expect.objectContaining({ attendeeName: 'Attendee' })
    )
  })

  it('extracts name by question type "text"', async () => {
    mockFindUnique.mockResolvedValue({
      ...confirmedRegistration,
      answers: [{ questionId: 'q1', value: 'Brian Otieno' }],
      event: {
        ...confirmedRegistration.event,
        questions: [{ id: 'q1', type: 'text', label: 'Your Name' }],
      },
    })
    await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    expect(mockGenerateTicketPDF).toHaveBeenCalledWith(
      expect.objectContaining({ attendeeName: 'Brian Otieno' })
    )
  })

  it('extracts name by label hint when type does not match', async () => {
    mockFindUnique.mockResolvedValue({
      ...confirmedRegistration,
      answers: [{ questionId: 'q2', value: 'Carol Wanjiku' }],
      event: {
        ...confirmedRegistration.event,
        questions: [{ id: 'q2', type: 'email', label: 'Attendee name' }],
      },
    })
    await GET(makeRequest('EVT-ABCD1234'), makeProps('EVT-ABCD1234'))
    expect(mockGenerateTicketPDF).toHaveBeenCalledWith(
      expect.objectContaining({ attendeeName: 'Carol Wanjiku' })
    )
  })
})
