/**
 * Email Deliverability & Bounce Shield
 * Filters out disposable, temporary, and test domains to prevent relay bounce loops.
 */

const DISPOSABLE_DOMAINS = new Set([
  // Throwaway / Temporary email providers
  'dropons.com',
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  '10minutemail.com',
  'throwawaymail.com',
  'yopmail.com',
  'sharklasers.com',
  'dispostable.com',
  'trashmail.com',
  'fakeinbox.com',
  'getairmail.com',
  'generator.email',
  'nada.ltd',
  'temp-mail.org',
  'burnermail.io',
  'mohmal.com',
  'crazymailing.com',
  'mytemp.email',
  'tempail.com',
  'inboxkitten.com',
  'minutemailbox.com',
])

const INVALID_TLDS = ['.test', '.example', '.invalid', '.localhost']

export function isDeliverableEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim().toLowerCase()

  // Must contain an @ symbol with characters before and after
  const atIndex = trimmed.lastIndexOf('@')
  if (atIndex < 1 || atIndex === trimmed.length - 1) return false

  const domain = trimmed.slice(atIndex + 1)
  if (!domain || !domain.includes('.')) return false

  // Check invalid test TLDs
  for (const tld of INVALID_TLDS) {
    if (domain.endsWith(tld)) return false
  }

  // Check disposable domains
  if (DISPOSABLE_DOMAINS.has(domain)) return false

  return true
}

export function extractDomain(email: string): string {
  const atIndex = email.lastIndexOf('@')
  return atIndex > -1 ? email.slice(atIndex + 1).toLowerCase() : ''
}
