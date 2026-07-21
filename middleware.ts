import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/isAdmin'

const verifierHosts = new Set(['verify.eventsslot.com', 'verify.www.eventsslot.com'])

const protectedPagePrefixes = [
  '/dashboard',
  '/my-events',
  '/create',
  '/edit',
  '/admin',
  '/tokens',
  '/preview',
  '/render',
  '/template',
  '/email',
  '/search',
]

function isProtectedPage(pathname: string) {
  return protectedPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function applySecurityHeaders(res: NextResponse) {
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
  return res
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname
    const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(':')[0].toLowerCase()

    if (verifierHosts.has(host)) {
      const rewriteUrl = req.nextUrl.clone()

      if (pathname === '/' || pathname === '/verify-tickets') {
        rewriteUrl.pathname = '/verify-tickets'
        return applySecurityHeaders(NextResponse.rewrite(rewriteUrl))
      }

      if (pathname.startsWith('/verify-tickets/')) {
        return applySecurityHeaders(NextResponse.next())
      }

      rewriteUrl.pathname = `/verify-tickets${pathname}`
      return applySecurityHeaders(NextResponse.rewrite(rewriteUrl))
    }

    const isSuperAdmin = token?.role === 'SUPER_ADMIN' || token?.isAdmin === true || isAdminEmail(token?.email)

    if (isProtectedPage(pathname) && !token) {
      return NextResponse.redirect(new URL('/signin', req.url))
    }

    if (pathname.startsWith('/admin') && !isSuperAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    if (pathname.startsWith('/api/admin') && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return applySecurityHeaders(NextResponse.next())
  },
  {
    callbacks: {
      authorized: () => true,
    },
    pages: {
      signIn: '/signin',
    },
  }
)

export const config = {
  matcher: [
    '/',
    '/:slug',
    '/verify-tickets/:path*',
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
