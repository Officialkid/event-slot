/**
 * Telephone utility functions for EventSlot.
 * Standardizes Kenyan M-Pesa phone numbers to MSISDN format (254XXXXXXXXX).
 */

export function normalizeMpesaPhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.startsWith('254')) return digits
  if (digits.length === 9) return `254${digits}`
  return digits
}

export function isValidMpesaPhone(phone: string): boolean {
  const normalized = normalizeMpesaPhone(phone)
  // Valid Kenyan phone numbers in international format: 254 followed by 9 digits
  // Safaricom: 25470X, 25471X, 25472X, 25474X, 25479X, 25475X, 25476X, 25411X, 25410X, etc.
  return /^254\d{9}$/.test(normalized)
}
