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
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  const { searchParams } = new URL(req.url);
  const code             = searchParams.get('code');
  const error            = searchParams.get('error');
  const state            = searchParams.get('state');

  // User denied access
  if (error || !code) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/profile?calendar=denied`
    );
  }

  // Verify state matches (CSRF protection)
  try {
    const { userId } = JSON.parse(Buffer.from(state ?? '', 'base64').toString());
    if (userId !== session.user.id) {
      throw new Error('State mismatch');
    }
  } catch {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?calendar=error`);
  }

  try {
    await connectGoogleCalendar(session.user.id, code);
    return NextResponse.redirect(
      `${APP_URL}/dashboard/profile?calendar=connected`
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error('[calendar/callback] Error:', e.message);
    return NextResponse.redirect(
      `${APP_URL}/dashboard/profile?calendar=error`
    );
  }
}
