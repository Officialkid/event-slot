/** @jest-environment node */

import { POST, GET } from '@/app/api/payments/intasend/webhook/route'

describe('Decommissioned IntraSend Webhook Endpoint (Phase 04b Remediation)', () => {
  it('returns HTTP 410 Gone on POST and ignores any payload', async () => {
    const res = await POST()
    expect(res.status).toBe(410)

    const data = await res.json()
    expect(data.status).toBe('DECOMMISSIONED')
    expect(data.provider).toBe('intasend')
    expect(data.error).toContain('decommissioned')
  })

  it('returns HTTP 410 Gone on GET', async () => {
    const res = await GET()
    expect(res.status).toBe(410)
    const data = await res.json()
    expect(data.status).toBe('DECOMMISSIONED')
  })
})
