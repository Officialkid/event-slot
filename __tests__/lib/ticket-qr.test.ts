/** @jest-environment node */

import { generateQRPayload, verifyQRPayload } from '@/lib/ticket-qr'

const TEST_SECRET = 'test-qr-secret-for-jest-1234567890'

describe('generateQRPayload', () => {
  beforeEach(() => { process.env.QR_SECRET = TEST_SECRET })
  afterEach(() => { delete process.env.QR_SECRET })

  it('produces a payload with exactly 4 colon-separated parts', () => {
    const payload = generateQRPayload('ticket-1', 'event-1', 'user-1')
    const parts = payload.split(':')
    expect(parts).toHaveLength(4)
  })

  it('embeds ticketId, eventId, userId in the correct positions', () => {
    const payload = generateQRPayload('ticket-abc', 'event-xyz', 'user-999')
    const [ticketId, eventId, userId] = payload.split(':')
    expect(ticketId).toBe('ticket-abc')
    expect(eventId).toBe('event-xyz')
    expect(userId).toBe('user-999')
  })

  it('appends a 16-character hex signature', () => {
    const payload = generateQRPayload('t', 'e', 'u')
    const sig = payload.split(':')[3]
    expect(sig).toMatch(/^[0-9a-f]{16}$/)
  })

  it('produces different signatures for different ticket IDs', () => {
    const a = generateQRPayload('ticket-1', 'event-1', 'user-1')
    const b = generateQRPayload('ticket-2', 'event-1', 'user-1')
    expect(a.split(':')[3]).not.toBe(b.split(':')[3])
  })

  it('produces the same signature for the same inputs (deterministic)', () => {
    const a = generateQRPayload('t', 'e', 'u')
    const b = generateQRPayload('t', 'e', 'u')
    expect(a).toBe(b)
  })

  it('throws when QR_SECRET env var is not set', () => {
    delete process.env.QR_SECRET
    expect(() => generateQRPayload('t', 'e', 'u')).toThrow('QR_SECRET is not configured')
  })
})

describe('verifyQRPayload', () => {
  beforeEach(() => { process.env.QR_SECRET = TEST_SECRET })
  afterEach(() => { delete process.env.QR_SECRET })

  it('validates a freshly generated payload successfully', () => {
    const payload = generateQRPayload('ticket-abc', 'event-xyz', 'user-123')
    const result = verifyQRPayload(payload)
    expect(result.valid).toBe(true)
    expect(result.ticketId).toBe('ticket-abc')
    expect(result.eventId).toBe('event-xyz')
    expect(result.userId).toBe('user-123')
  })

  it('rejects a payload with a tampered signature', () => {
    const payload = generateQRPayload('ticket-abc', 'event-xyz', 'user-123')
    const parts = payload.split(':')
    parts[3] = 'aaaaaaaaaaaaaaaa' // replace with wrong sig
    const result = verifyQRPayload(parts.join(':'))
    expect(result.valid).toBe(false)
    expect(result.ticketId).toBeNull()
  })

  it('rejects a payload with a tampered ticketId (signature no longer matches)', () => {
    const payload = generateQRPayload('ticket-abc', 'event-xyz', 'user-123')
    const parts = payload.split(':')
    parts[0] = 'ticket-TAMPERED'
    const result = verifyQRPayload(parts.join(':'))
    expect(result.valid).toBe(false)
  })

  it('rejects a payload with fewer than 4 parts', () => {
    const result = verifyQRPayload('only:three:parts')
    expect(result.valid).toBe(false)
    expect(result.ticketId).toBeNull()
    expect(result.eventId).toBeNull()
    expect(result.userId).toBeNull()
  })

  it('rejects a payload with more than 4 parts', () => {
    const result = verifyQRPayload('a:b:c:d:e')
    expect(result.valid).toBe(false)
  })

  it('rejects a completely malformed string', () => {
    const result = verifyQRPayload('not-valid-at-all')
    expect(result.valid).toBe(false)
  })

  it('rejects an empty string', () => {
    const result = verifyQRPayload('')
    expect(result.valid).toBe(false)
  })

  it('rejects payload generated with a different secret', () => {
    // Generate with original secret
    const payload = generateQRPayload('t', 'e', 'u')
    // Now switch to different secret
    process.env.QR_SECRET = 'completely-different-secret-xyz'
    const result = verifyQRPayload(payload)
    expect(result.valid).toBe(false)
  })
})
