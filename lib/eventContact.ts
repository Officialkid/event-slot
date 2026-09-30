export type EventContactMode = 'WHATSAPP' | 'CALL'

export type ParsedEventContact = {
  mode: EventContactMode
  number: string
}

const EVENT_CONTACT_PREFIX = /^(whatsapp|call):/i

export function normalizeInternationalPhoneNumber(raw: string | null | undefined): { ok: true; number: string } | { ok: false; error: string } {
  const value = (raw ?? '').trim()
  if (!value) {
    return { ok: false, error: 'Phone number is required' }
  }

  // Reject non-phone characters
  if (!/^\+?[\d\s().-]+$/.test(value)) {
    return { ok: false, error: 'Invalid phone number: use digits only, with an optional leading +' }
  }

  let digits = value.replace(/\D/g, '')

  // Reject dummy or repeating numbers
  if (/^(\d)\1{6,}$/.test(digits)) {
    return { ok: false, error: 'Invalid phone number: dummy or repeated digits cannot be used for WhatsApp' }
  }

  // Kenyan number format validation (07..., 01..., 254..., or +254...)
  if (value.startsWith('0') && digits.length === 10) {
    const mobilePrefix = digits.charAt(1)
    if (mobilePrefix !== '7' && mobilePrefix !== '1') {
      return { ok: false, error: 'Invalid WhatsApp number: Kenyan mobile numbers must start with 07... or 01...' }
    }
    digits = `254${digits.slice(1)}`
  } else if (digits.startsWith('254')) {
    // If user typed 25407..., strip the redundant zero
    if (digits.startsWith('2540') && digits.length === 13) {
      digits = `254${digits.slice(4)}`
    }
    if (digits.length !== 12) {
      return { ok: false, error: 'Invalid WhatsApp number: Kenyan numbers must have 9 digits after +254 (e.g. +254712345678)' }
    }
    const mobilePrefix = digits.charAt(3)
    if (mobilePrefix !== '7' && mobilePrefix !== '1') {
      return { ok: false, error: 'Invalid WhatsApp number: Kenyan mobile lines must start with 7 or 1 (e.g. +2547... or +2541...)' }
    }
  }

  if (digits.startsWith('0')) {
    return { ok: false, error: 'Invalid number: please include the full country code (e.g. +254...)' }
  }

  if (digits.length < 9 || digits.length > 15) {
    return { ok: false, error: 'Invalid phone number: WhatsApp numbers must be between 9 and 15 digits including country code' }
  }

  return { ok: true, number: digits }
}

export function encodeEventContact(number: string, mode: EventContactMode): string {
  return `${mode.toLowerCase()}:${number}`
}

export function parseEventContact(stored: string | null | undefined): ParsedEventContact | null {
  const value = (stored ?? '').trim()
  if (!value) return null

  const prefixed = value.match(EVENT_CONTACT_PREFIX)
  if (prefixed) {
    const mode = prefixed[1].toUpperCase() === 'CALL' ? 'CALL' : 'WHATSAPP'
    const digits = value.slice(prefixed[0].length).replace(/\D/g, '')
    if (!digits) return null
    return { mode, number: digits }
  }

  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  return { mode: 'WHATSAPP', number: digits }
}

export function validateAndEncodeEventContact(raw: string | null | undefined, mode: EventContactMode): { ok: true; stored: string; number: string } | { ok: false; error: string } {
  const normalized = normalizeInternationalPhoneNumber(raw)
  if (!normalized.ok) return normalized
  return {
    ok: true,
    stored: encodeEventContact(normalized.number, mode),
    number: normalized.number,
  }
}

export function toTelHref(number: string): string {
  return `tel:+${number}`
}

export function toWhatsAppHref(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
