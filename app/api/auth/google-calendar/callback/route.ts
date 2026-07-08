// GET /api/auth/google-calendar/callback
// Google redirects here after user grants/denies permission
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }          from 'next-auth';
import { authOptions }               from '@/lib/auth';
import { connectGoogleCalendar }     from '@/lib/googleCalendar';
import { APP_URL }                   from '@/lib/config';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(`${APP_URL}/signin`);
  }

  const { searchParams } = new URL(req.url);
  const code             = searchParams.get('code');
  const error            = searchParams.get('error');
  const state            = searchParams.get('state');

  function redirectWithCalendarStatus(status: string) {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?calendar=${status}#calendar`);
  }

  // User denied access or Google blocked the app before consent could complete.
  if (error || !code) {
    const errorDescription = searchParams.get('error_description')?.toLowerCase() ?? '';
    if (
      error === 'access_denied' &&
      /verification|testing|test user|approved tester|access blocked/.test(errorDescription)
    ) {
      return redirectWithCalendarStatus('testing');
    }
    return redirectWithCalendarStatus('denied');
  }

  // Verify state matches (CSRF protection)
  try {
    const { userId } = JSON.parse(Buffer.from(state ?? '', 'base64').toString());
    if (userId !== session.user.id) {
      throw new Error('State mismatch');
    }
  } catch {
    return redirectWithCalendarStatus('error');
  }

  try {
    await connectGoogleCalendar(session.user.id, code);
    return redirectWithCalendarStatus('connected');
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error('[calendar/callback] Error:', e.message);
    const message = e.message?.toLowerCase() ?? '';
    if (/access blocked|verification|testing|test user|access_denied/.test(message)) {
      return redirectWithCalendarStatus('testing');
    }
    return redirectWithCalendarStatus('error');
  }
}
