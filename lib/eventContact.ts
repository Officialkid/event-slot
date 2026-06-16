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

  if (!/^\+?[\d\s().-]+$/.test(value)) {
    return { ok: false, error: 'Use digits only, with an optional leading +' }
  }

  const digits = value.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, error: 'Phone number must be between 8 and 15 digits' }
  }

  if (value.startsWith('0') && digits.length === 10) {
    return { ok: true, number: `254${digits.slice(1)}` }
  }

  if (value.startsWith('254') || value.startsWith('+254')) {
    return { ok: true, number: digits.startsWith('254') ? digits : `254${digits}` }
  }

  if (value.startsWith('0')) {
    return { ok: false, error: 'Use the full country code, for example +254...' }
  }

  if (digits.startsWith('0')) {
    return { ok: false, error: 'Use the full country code, for example +254...' }
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
