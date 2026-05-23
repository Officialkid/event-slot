/**
 * APP_URL — canonical public URL for this app.
 * Skips obviously-broken values like 0.0.0.0 or localhost so that
 * referral links, email callbacks, and OAuth redirects are always valid
 * even if NEXTAUTH_URL is misconfigured in the Cloud Run secret.
 */
function resolveAppUrl(): string {
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]
  for (const candidate of candidates) {
    if (
      candidate &&
      !candidate.includes('0.0.0.0') &&
      !candidate.includes('localhost')
    ) {
      return candidate.replace(/\/$/, '') // strip trailing slash
    }
  }
  return 'https://www.eventsslot.com'
}

export const APP_URL = resolveAppUrl()
