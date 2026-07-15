import NextAuth from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { loginRatelimit } from '@/lib/ratelimit'
import { APP_URL } from '@/lib/config'

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
}

function isLocalHost(value: string | null | undefined): boolean {
  if (!value) return false
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value)
}

function getAuthBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = forwardedHost ?? req.headers.get('host') ?? req.nextUrl.host
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const protocol = forwardedProto ?? req.nextUrl.protocol.replace(/:$/, '') ?? (isLocalHost(host) ? 'http' : 'https')

  if (host && !isLocalHost(host)) {
    return `${protocol}://${host}`.replace(/\/$/, '')
  }

  return APP_URL
}

function getAuthHandler(req: NextRequest) {
  const resolvedUrl = getAuthBaseUrl(req)
  const envKey = 'NEXTAUTH_URL'
  const currentValue = process.env[envKey]
  if (!currentValue || currentValue !== resolvedUrl) {
    process.env[envKey] = resolvedUrl
  }
  return NextAuth(authOptions)
}

async function POST(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  // Only rate-limit the credentials callback (not OAuth callbacks)
  const { nextauth } = await context.params
  const segments = nextauth
  if (segments.join('/') === 'callback/credentials') {
    const ip = getClientIp(req)
    const { success } = await loginRatelimit.limit(ip)
    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Too many login attempts. Please try again in 1 minute.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
      )
    }
  }
  const handler = getAuthHandler(req)
  return handler(req, context)
}

async function GET(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  try {
    const handler = getAuthHandler(req)
    return await handler(req, context)
  } catch (err) {
    const { nextauth } = await context.params
    const isSessionRoute = nextauth.join('/') === 'session'
    const isJwtDecryptionError =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'ERR_JWE_DECRYPTION_FAILED'

    if (isSessionRoute && isJwtDecryptionError) {
      const response = NextResponse.json({})
      response.cookies.set('next-auth.session-token', '', {
        expires: new Date(0),
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      })
      response.cookies.set('__Secure-next-auth.session-token', '', {
        expires: new Date(0),
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: true,
      })
      return response
    }

    console.error('[NextAuth GET error]', err)
    throw err
  }
}

export { GET, POST }
