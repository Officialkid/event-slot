import { generateConfirmationCode } from '@/lib/confirmationCode'

describe('generateConfirmationCode', () => {
  it('generates a code with correct format', () => {
    const code = generateConfirmationCode()
    expect(code).toMatch(/^EVT-[A-Z0-9]{8}$/)
  })

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateConfirmationCode()))
    expect(codes.size).toBe(100)
  })
})
