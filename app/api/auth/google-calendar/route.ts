// GET /api/auth/google-calendar
// Starts the OAuth flow — redirects user to Google consent screen
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }          from 'next-auth';
import { authOptions }               from '@/lib/auth';
import { getCalendarAuthUrl }        from '@/lib/googleCalendar';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const authUrl = getCalendarAuthUrl(session.user.id);
  return NextResponse.redirect(authUrl);
}
