import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/isAdmin'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const res   = NextResponse.next()

    // ── Security headers on every response ───────────────
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('X-Frame-Options', 'DENY')
    res.headers.set('X-XSS-Protection', '1; mode=block')
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()')
    res.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com",
      "img-src 'self' data: blob: *.r2.dev lh3.googleusercontent.com",
      "connect-src 'self' *.groq.com *.openai.com",
      "media-src 'self' blob:",
      "frame-ancestors 'none'",
    ].join('; '))

    // ── Route protection ──────────────────────────────────
    const isSuperAdmin = token?.role === 'SUPER_ADMIN' || isAdminEmail(token?.email)

    if (req.nextUrl.pathname.startsWith('/admin') && !isSuperAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
    if (req.nextUrl.pathname.startsWith('/api/admin') && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return res
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // For API routes, let handlers enforce auth and return JSON errors.
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return true
        }
        return !!token
      },
    },
    pages: {
      signIn: '/signin',
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/my-events',
    '/create',
    '/edit/:path*',
    '/admin/:path*',
    '/tokens/:path*',
    '/api/organizer/:path*',
    '/api/admin/:path*',
    '/api/user/:path*',
    '/api/assistant/:path*',
    '/preview/:path*',
    '/render/:path*',
    '/template/:path*',
    '/email/:path*',
    '/search',
  ],
}
