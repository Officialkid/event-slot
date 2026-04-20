import NextAuth from 'next-auth'
import { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { loginRateLimiter, getClientIp } from '@/lib/rateLimiter'

const handler = NextAuth(authOptions)

async function POST(req: NextRequest, context: { params: { nextauth: string[] } }) {
  // Only rate-limit the credentials callback (not OAuth callbacks)
  const segments = context.params.nextauth
  if (segments.join('/') === 'callback/credentials') {
    const ip = getClientIp(req)
    try {
      await loginRateLimiter.consume(ip)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Too many login attempts. Please try again in 10 minutes.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '600' } }
      )
    }
  }
  return handler(req, context)
}

export { handler as GET, POST }
