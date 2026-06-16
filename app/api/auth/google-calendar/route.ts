// GET /api/auth/google-calendar
// Starts the OAuth flow — redirects user to Google consent screen
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }          from 'next-auth';
import { authOptions }               from '@/lib/auth';
import { getCalendarAuthUrl, isCalendarConfigured } from '@/lib/googleCalendar';
import { APP_URL } from '@/lib/config';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL('/signin', req.url));
  }

  if (!isCalendarConfigured()) {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?calendar=unavailable`);
  }

  const authUrl = getCalendarAuthUrl(session.user.id);
  return NextResponse.redirect(authUrl);
}
