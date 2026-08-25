// app/api/admin/event-mode/route.ts
// POST   - enter Admin Mode for a specific event (supports target: 'edit' | 'dashboard')
// DELETE - exit Admin Mode
// GET    - return current Admin Mode state (used by the banner component)

import { NextRequest, NextResponse }                      from 'next/server'
import { getServerSession }                               from 'next-auth'
import { authOptions }                                    from '@/lib/auth'
import { prisma }                                         from '@/lib/prisma'
import { isAdminEmail }                                   from '@/lib/isAdmin'
import { encodeAdminModeState, getAdminModeFromCookie,
         ADMIN_MODE_COOKIE_OPTIONS }                      from '@/lib/adminMode'

const ADMIN_MODE_COOKIE = 'es_admin_mode'

function canUseAdminMode(session: Awaited<ReturnType<typeof getServerSession>>) {
  const user = (session as { user?: { role?: string | null; email?: string | null } } | null)?.user
  if (!user) return false
  return user.role === 'SUPER_ADMIN' || isAdminEmail(user.email)
}

// POST /api/admin/event-mode
// Body: { eventId: string, target?: 'edit' | 'dashboard' }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!canUseAdminMode(session)) {
    return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { eventId, target } = body as { eventId?: string; target?: 'edit' | 'dashboard' }
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }

  const event = await prisma.event.findUnique({
    where:  { id: eventId },
    select: {
      id:          true,
      slug:        true,
      title:       true,
      organizerId: true,
      organizer:   { select: { name: true, email: true } },
    },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Audit trail - fire-and-forget
  if (session?.user?.id) {
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action:  target === 'edit' ? 'ADMIN_MODE_EDIT_ACTIVATED' : 'ADMIN_MODE_ACTIVATED',
        metadata: {
          eventId:        event.id,
          eventTitle:     event.title,
          target:         target ?? 'dashboard',
          organiserId:    event.organizerId,
          organiserName:  event.organizer?.name  ?? null,
          organiserEmail: event.organizer?.email ?? null,
        },
      },
    }).catch(err => console.error('[audit] Failed to log admin mode activation:', err))
  }

  const adminModeState = {
    active:      true,
    eventId:     event.id,
    eventSlug:   event.slug,
    eventTitle:  event.title,
    organiserId: event.organizerId,
    activatedAt: new Date().toISOString(),
  }

  const cookieValue = encodeAdminModeState(adminModeState)

  const destination = target === 'edit' ? `/edit/${event.slug}` : `/dashboard/events/${event.slug}`

  const response = NextResponse.json({
    ok:         true,
    eventSlug:  event.slug,
    eventTitle: event.title,
    redirectTo: destination,
  })

  response.cookies.set(ADMIN_MODE_COOKIE, cookieValue, ADMIN_MODE_COOKIE_OPTIONS)

  return response
}

// DELETE /api/admin/event-mode
export async function DELETE() {
  const session = await getServerSession(authOptions)

  if (!canUseAdminMode(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Audit trail - fire-and-forget
  if (session?.user?.id) {
    prisma.auditLog.create({
      data: {
        actorId:  session.user.id,
        action:   'ADMIN_MODE_EXITED',
        metadata: {},
      },
    }).catch(() => {})
  }

  const response = NextResponse.json({ ok: true, redirectTo: '/admin/events' })

  response.cookies.set(ADMIN_MODE_COOKIE, '', {
    ...ADMIN_MODE_COOKIE_OPTIONS,
    maxAge: 0, // immediately expire
  })

  return response
}

// GET /api/admin/event-mode
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!canUseAdminMode(session)) {
    return NextResponse.json({ active: false })
  }

  const state = await getAdminModeFromCookie()
  return NextResponse.json(state)
}
