import { withAuth } from 'next-auth/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/isAdmin'

const verifierHosts = new Set(['verify.eventsslot.com', 'verify.www.eventsslot.com', 'verify.localhost'])
const marketingHosts = new Set(['marketing.eventsslot.com', 'marketing.www.eventsslot.com', 'marketing.localhost'])
const adminHosts = new Set(['admin.eventsslot.com', 'admin.www.eventsslot.com', 'admin.localhost'])
const appHosts = new Set(['app.eventsslot.com', 'app.www.eventsslot.com', 'app.localhost'])

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
  '/marketing',
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

export function middlewareHandler(req: NextRequest & { nextauth?: { token?: any } }) {
  const token = req.nextauth?.token
  const pathname = req.nextUrl.pathname
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(':')[0].toLowerCase()

    const isSuperAdmin = Boolean(
      token?.role === 'SUPER_ADMIN' ||
      token?.isAdmin === true ||
      isAdminEmail(token?.email)
    )

    // 1. Marketing Hub Subdomain (marketing.eventsslot.com)
    if (marketingHosts.has(host)) {
      if (!pathname.startsWith('/api') && !pathname.startsWith('/_next') && !pathname.startsWith('/l/')) {
        let targetPath = pathname
        if (pathname === '/' || pathname === '') {
          targetPath = '/marketing'
        } else if (!pathname.startsWith('/marketing')) {
          targetPath = `/marketing${pathname}`
        }

        // Auth guard for marketing
        if (!token) {
          const signInUrl = new URL('/signin', req.url)
          signInUrl.searchParams.set('callbackUrl', req.url)
          return NextResponse.redirect(signInUrl)
        }

        if (targetPath !== pathname) {
          const rewriteUrl = req.nextUrl.clone()
          rewriteUrl.pathname = targetPath
          return applySecurityHeaders(NextResponse.rewrite(rewriteUrl))
        }
      }
    }

    // 2. Super Admin Subdomain (admin.eventsslot.com)
    else if (adminHosts.has(host)) {
      if (!pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
        let targetPath = pathname
        if (pathname === '/' || pathname === '') {
          targetPath = '/admin'
        } else if (!pathname.startsWith('/admin')) {
          targetPath = `/admin${pathname}`
        }

        // Auth guard for admin
        if (!token) {
          const signInUrl = new URL('/signin', req.url)
          signInUrl.searchParams.set('callbackUrl', req.url)
          return NextResponse.redirect(signInUrl)
        }

        if (!isSuperAdmin) {
          return NextResponse.redirect(new URL('/unauthorized', req.url))
        }

        if (targetPath !== pathname) {
          const rewriteUrl = req.nextUrl.clone()
          rewriteUrl.pathname = targetPath
          return applySecurityHeaders(NextResponse.rewrite(rewriteUrl))
        }
      }
    }

    // 3. Organizer App Subdomain (app.eventsslot.com)
    else if (appHosts.has(host)) {
      if (!pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
        let targetPath = pathname
        if (pathname === '/' || pathname === '') {
          targetPath = '/dashboard'
        } else if (pathname === '/events') {
          targetPath = '/my-events'
        }

        if (targetPath !== pathname) {
          const rewriteUrl = req.nextUrl.clone()
          rewriteUrl.pathname = targetPath
          return applySecurityHeaders(NextResponse.rewrite(rewriteUrl))
        }
      }
    }

    // 4. Ticket Verifier Subdomain (verify.eventsslot.com)
    else if (verifierHosts.has(host)) {
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

    // 5. Standard Route Protection (Main Domain & Direct URLs)
    if (isProtectedPage(pathname) && !token) {
      const signInUrl = new URL('/signin', req.url)
      signInUrl.searchParams.set('callbackUrl', req.url)
      return NextResponse.redirect(signInUrl)
    }

    if (pathname.startsWith('/admin') && !isSuperAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    if (pathname.startsWith('/api/admin') && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return applySecurityHeaders(NextResponse.next())
}

export default withAuth(middlewareHandler, {
  callbacks: {
    authorized: () => true,
  },
  pages: {
    signIn: '/signin',
  },
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)',
  ],
}
