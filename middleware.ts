import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // User is authenticated at this point (withAuth guarantees it).
    // Admin routes need an extra check for SUPER_ADMIN_EMAIL — handled in
    // app/admin/layout.tsx which shows notFound() for non-admins, so we just
    // let the request through here and let the layout enforce the role.
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
