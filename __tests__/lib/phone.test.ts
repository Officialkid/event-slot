import { normalizeMpesaPhone, isValidMpesaPhone } from '@/lib/phone'

describe('Telephone Utilities (lib/phone.ts)', () => {
  describe('normalizeMpesaPhone', () => {
    it('normalizes 10-digit phone starting with 07', () => {
      expect(normalizeMpesaPhone('0712345678')).toBe('254712345678')
    })

    it('normalizes 10-digit phone starting with 01', () => {
      expect(normalizeMpesaPhone('0112345678')).toBe('254112345678')
    })

    it('normalizes phone with international plus prefix +254', () => {
      expect(normalizeMpesaPhone('+254712345678')).toBe('254712345678')
    })

    it('preserves phone already in 254 format', () => {
      expect(normalizeMpesaPhone('254712345678')).toBe('254712345678')
    })

    it('normalizes 9-digit phone without leading zero', () => {
      expect(normalizeMpesaPhone('712345678')).toBe('254712345678')
    })

    it('strips non-digit characters (spaces, dashes, parens)', () => {
      expect(normalizeMpesaPhone('+254 (712) 345-678')).toBe('254712345678')
    })

    it('handles empty string safely', () => {
      expect(normalizeMpesaPhone('')).toBe('')
    })
  })

  describe('isValidMpesaPhone', () => {
    it('returns true for valid Kenyan numbers', () => {
      expect(isValidMpesaPhone('0712345678')).toBe(true)
      expect(isValidMpesaPhone('0112345678')).toBe(true)
      expect(isValidMpesaPhone('+254712345678')).toBe(true)
      expect(isValidMpesaPhone('254712345678')).toBe(true)
    })

    it('returns false for invalid lengths or invalid characters', () => {
      expect(isValidMpesaPhone('12345')).toBe(false)
      expect(isValidMpesaPhone('07123456789999')).toBe(false)
      expect(isValidMpesaPhone('not-a-phone')).toBe(false)
      expect(isValidMpesaPhone('')).toBe(false)
    })
  })
})
