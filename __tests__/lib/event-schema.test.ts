import { createEventSchema } from '@/lib/schemas/event.schema'

const BASE_QUESTION = { id: 'q1', label: 'Full Name', type: 'text' as const, required: true }

const physicalBase = {
  title: 'Nairobi Tech Summit 2026',
  eventType: 'PHYSICAL' as const,
  organizerName: 'Tech Kenya',
  questions: [BASE_QUESTION],
}

const virtualBase = {
  ...physicalBase,
  eventType: 'VIRTUAL' as const,
  virtualLink: 'https://meet.google.com/abc-defg-hij',
}

const paidTierBase = {
  name: 'Regular',
  priceKes: 1500,
  capacity: 100,
}

describe('createEventSchema â€” physical events', () => {
  it('accepts a minimal valid physical event', () => {
    const result = createEventSchema.safeParse(physicalBase)
    expect(result.success).toBe(true)
  })

  it('rejects an empty title', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a title longer than 200 characters', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, title: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects an empty organizerName', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, organizerName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty questions array', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, questions: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/question/i)
    }
  })

  it('rejects more than 30 questions', () => {
    const questions = Array.from({ length: 31 }, (_, i) => ({
      id: `q${i}`,
      label: `Question ${i}`,
      type: 'text' as const,
    }))
    const result = createEventSchema.safeParse({ ...physicalBase, questions })
    expect(result.success).toBe(false)
  })

  it('accepts an optional description', () => {
    const result = createEventSchema.safeParse({
      ...physicalBase,
      description: 'A full-day technology conference in Nairobi.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a description longer than 5000 characters', () => {
    const result = createEventSchema.safeParse({
      ...physicalBase,
      description: 'D'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })
})

describe('createEventSchema â€” virtual event Google Meet link', () => {
  it('accepts a full https://meet.google.com/ link', () => {
    const result = createEventSchema.safeParse(virtualBase)
    expect(result.success).toBe(true)
  })

  it('accepts a bare meet.google.com/ link without the https:// prefix', () => {
    const result = createEventSchema.safeParse({
      ...virtualBase,
      virtualLink: 'meet.google.com/abc-defg-hij',
    })
    expect(result.success).toBe(true)
  })

  it('accepts UPPERCASE Meet.Google.Com/ normalisation', () => {
    const result = createEventSchema.safeParse({
      ...virtualBase,
      virtualLink: 'Meet.Google.Com/abc-defg-hij',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a virtual event with no link (empty string)', () => {
    const result = createEventSchema.safeParse({ ...virtualBase, virtualLink: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path).flat()
      expect(paths).toContain('virtualLink')
    }
  })

  it('rejects a virtual event with null virtualLink', () => {
    const result = createEventSchema.safeParse({ ...virtualBase, virtualLink: null })
    expect(result.success).toBe(false)
  })

  it('rejects a Zoom link', () => {
    const result = createEventSchema.safeParse({
      ...virtualBase,
      virtualLink: 'https://zoom.us/j/123456789',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Google Meet/i)
    }
  })

  it('rejects a Microsoft Teams link', () => {
    const result = createEventSchema.safeParse({
      ...virtualBase,
      virtualLink: 'https://teams.microsoft.com/l/meetup-join/123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a plain string that is not a URL', () => {
    const result = createEventSchema.safeParse({ ...virtualBase, virtualLink: 'just some text' })
    expect(result.success).toBe(false)
  })

  it('normalises http:// Google Meet links to https://', () => {
    const result = createEventSchema.safeParse({
      ...virtualBase,
      virtualLink: 'http://meet.google.com/abc-defg-hij',
    })
    expect(result.success).toBe(true)
  })
})

describe('createEventSchema â€” paid event ticket pricing', () => {
  it('rejects isPaid=true without ticket tiers', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, isPaid: true })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path).flat()
      expect(paths).toContain('ticketTiers')
    }
  })

  it('rejects tier price below the minimum of KSh 50', () => {
    const result = createEventSchema.safeParse({
      ...physicalBase,
      isPaid: true,
      ticketTiers: [{ ...paidTierBase, priceKes: 30 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => /50/.test(issue.message))).toBe(true)
    }
  })

  it('rejects tier price of exactly KSh 49', () => {
    const result = createEventSchema.safeParse({
      ...physicalBase,
      isPaid: true,
      ticketTiers: [{ ...paidTierBase, priceKes: 49 }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts tier price of exactly KSh 50 (boundary)', () => {
    const result = createEventSchema.safeParse({
      ...physicalBase,
      isPaid: true,
      ticketTiers: [{ ...paidTierBase, priceKes: 50 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a mid-range tier price of KSh 1,500', () => {
    const result = createEventSchema.safeParse({
      ...physicalBase,
      isPaid: true,
      ticketTiers: [{ ...paidTierBase, priceKes: 1500 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts tier price of exactly KSh 500,000 (upper boundary)', () => {
    const result = createEventSchema.safeParse({
      ...physicalBase,
      isPaid: true,
      ticketTiers: [{ ...paidTierBase, priceKes: 500000 }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects tier price above KSh 500,000', () => {
    const result = createEventSchema.safeParse({
      ...physicalBase,
      isPaid: true,
      ticketTiers: [{ ...paidTierBase, priceKes: 500001 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => /500,000/.test(issue.message))).toBe(true)
    }
  })

  it('rejects a non-integer tier price', () => {
    const result = createEventSchema.safeParse({
      ...physicalBase,
      isPaid: true,
      ticketTiers: [{ ...paidTierBase, priceKes: 99.99 }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts isPaid=false without ticket tiers', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, isPaid: false })
    expect(result.success).toBe(true)
  })
})

describe('createEventSchema â€” WhatsApp number validation', () => {
  it('accepts a valid Kenyan number with country code', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, whatsappNumber: '+254712345678' })
    expect(result.success).toBe(true)
  })

  it('accepts a local 9-digit number', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, whatsappNumber: '0712345678' })
    expect(result.success).toBe(true)
  })

  it('rejects a number with fewer than 8 digits', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, whatsappNumber: '12345' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/8 and 15 digits/i)
    }
  })

  it('rejects a number with more than 15 digits', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, whatsappNumber: '1234567890123456' })
    expect(result.success).toBe(false)
  })

  it('accepts an empty string (WhatsApp is optional)', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, whatsappNumber: '' })
    expect(result.success).toBe(true)
  })

  it('accepts null (WhatsApp is optional)', () => {
    const result = createEventSchema.safeParse({ ...physicalBase, whatsappNumber: null })
    expect(result.success).toBe(true)
  })
})
