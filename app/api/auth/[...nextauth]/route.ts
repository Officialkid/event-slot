import NextAuth from 'next-auth'
import { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { loginRatelimit } from '@/lib/ratelimit'

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
}

const handler = NextAuth(authOptions)

async function POST(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  // Only rate-limit the credentials callback (not OAuth callbacks)
  const { nextauth } = await context.params
  const segments = nextauth
  if (segments.join('/') === 'callback/credentials') {
    const ip = getClientIp(req)
    const { success } = await loginRatelimit.limit(ip)
    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Too many login attempts. Please try again in 10 minutes.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '600' } }
      )
    }
  }
  return handler(req, context)
}

async function GET(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  try {
    return await handler(req, context)
  } catch (err) {
    console.error('[NextAuth GET error]', err)
    throw err
  }
}

export { GET, POST }
