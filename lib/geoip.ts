/**
 * GeoIP utilities — server-side only.
 * Uses Cloudflare/Vercel headers first; falls back to ip-api.com for bare Cloud Run.
 */

export async function detectCountry(req: Request): Promise<string> {
  // Cloudflare sets this automatically when behind Cloudflare
  const cfCountry = req.headers.get('CF-IPCountry') ?? req.headers.get('cf-ipcountry')
  if (cfCountry && cfCountry !== 'XX') return cfCountry.toUpperCase()

  // Vercel edge
  const vercelCountry = req.headers.get('x-vercel-ip-country')
  if (vercelCountry && vercelCountry !== 'XX') return vercelCountry.toUpperCase()

  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim() ?? '0.0.0.0'

  // Local / dev
  if (!ip || ip === '0.0.0.0' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip === '::1') {
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
