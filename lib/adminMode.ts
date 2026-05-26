// lib/adminMode.ts
// Core helpers for reading and setting Admin Mode in the server session.
// Uses an encoded cookie so the state survives page navigations.

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const ADMIN_MODE_COOKIE = 'es_admin_mode'

export const ADMIN_MODE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge:   60 * 60 * 4, // 4 hours — admin mode expires automatically
  path:     '/',
}

export interface AdminModeState {
  active:       boolean
  eventId:      string | null
  eventSlug:    string | null
  eventTitle:   string | null
  organiserId:  string | null
  activatedAt:  string | null
}

const EMPTY_STATE: AdminModeState = {
  active:      false,
  eventId:     null,
  eventSlug:   null,
  eventTitle:  null,
  organiserId: null,
  activatedAt: null,
}

export async function getAdminModeFromCookie(): Promise<AdminModeState> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(ADMIN_MODE_COOKIE)?.value
  if (!raw) return { ...EMPTY_STATE }
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    return parsed as AdminModeState
  } catch {
    return { ...EMPTY_STATE }
  }
}

export function encodeAdminModeState(state: AdminModeState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64')
}

// The key permission resolver — use this in every API route instead of
// checking event.organizerId === session.user.id directly.
export async function resolveOrganiserAccess(params: {
  userId:   string
  userRole: string
  eventId:  string
}): Promise<{
  hasAccess:   boolean
  isAdminMode: boolean
  organiserId: string | null
}> {
  const event = await prisma.event.findUnique({
    where:  { id: params.eventId },
    select: { organizerId: true },
  })

  if (!event) return { hasAccess: false, isAdminMode: false, organiserId: null }

  // Organiser owns the event
  if (event.organizerId === params.userId) {
    return { hasAccess: true, isAdminMode: false, organiserId: params.userId }
  }

  // SuperAdmin in Admin Mode for this event
  if (params.userRole === 'SUPER_ADMIN') {
    const adminMode = await getAdminModeFromCookie()
    if (adminMode.active && adminMode.eventId === params.eventId) {
      return {
        hasAccess:   true,
        isAdminMode: true,
        organiserId: adminMode.organiserId,
      }
    }
  }

  return { hasAccess: false, isAdminMode: false, organiserId: null }
}

// Simpler check — does the current user have organiser-level write access?
// Use in place of: event.organizerId !== session.user.id
export async function hasOrganiserAccess(
  session: { user: { id: string; role: string } },
  eventId: string
): Promise<boolean> {
  const result = await resolveOrganiserAccess({
    userId:   session.user.id,
    userRole: session.user.role ?? '',
    eventId,
  })
  return result.hasAccess
}
