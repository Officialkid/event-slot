/**
 * GeoIP utilities — server-side only.
 * Uses Cloudflare/Vercel headers first; falls back to ip-api.com for bare Cloud Run.
 */

function normalizeCountryHeader(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase()
  if (!normalized || normalized === 'XX' || normalized === 'UNKNOWN') return null
  return normalized
}

function isLocalIp(ip: string): boolean {
  return (
    !ip ||
    ip === '0.0.0.0' ||
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    ip.startsWith('fe80:') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  )
}

export async function detectCountry(req: Request): Promise<string> {
  const edgeCountry =
    normalizeCountryHeader(req.headers.get('CF-IPCountry') ?? req.headers.get('cf-ipcountry')) ??
    normalizeCountryHeader(req.headers.get('x-vercel-ip-country')) ??
    normalizeCountryHeader(req.headers.get('x-appengine-country')) ??
    normalizeCountryHeader(req.headers.get('cloudfront-viewer-country')) ??
    normalizeCountryHeader(req.headers.get('x-geo-country')) ??
    normalizeCountryHeader(req.headers.get('fly-country')) ??
    normalizeCountryHeader(req.headers.get('x-country-code'))

  if (edgeCountry) return edgeCountry

  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim() ?? '0.0.0.0'

  // Local / dev
  if (isLocalIp(ip)) {
    return 'KE' // default to Kenya in dev
  }

  try {
    const res = await fetch(`https://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: AbortSignal.timeout(2000),
    })
    const data = await res.json() as { countryCode?: string }
    return data.countryCode ?? 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

export function getCountryName(code: string): string {
  if (!code || code === 'UNKNOWN') return code || 'Unknown'
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export function getCountryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌍'
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)))
    .join('')
}
