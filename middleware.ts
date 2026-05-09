import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/isAdmin'

export default withAuth(
  function middleware(req) {
    const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')
    const token = req.nextauth.token

    if (isAdminRoute) {
      const isSuperAdmin = token?.role === 'SUPER_ADMIN' || isAdminEmail(token?.email)
      if (!isSuperAdmin) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Return true to allow the request; false redirects to the login page.
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/signin',
    },
  }
)

export const config = {
  matcher: [
    // Authenticated organizer sections
    '/dashboard/:path*',
    '/my-events',
    '/create',
    '/edit/:path*',
    // Admin
    '/admin/:path*',
    // Scanned paths — none currently exist but protected preemptively
    '/preview/:path*',
    '/render/:path*',
    '/template/:path*',
    '/email/:path*',
    '/search',
  ],
}
