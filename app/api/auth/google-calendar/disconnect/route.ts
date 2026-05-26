// POST /api/auth/google-calendar/disconnect
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }          from 'next-auth';
import { authOptions }               from '@/lib/auth';
import { disconnectGoogleCalendar }  from '@/lib/googleCalendar';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await disconnectGoogleCalendar(session.user.id);
  return NextResponse.json({ disconnected: true });
}
