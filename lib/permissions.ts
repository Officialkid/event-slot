/**
 * lib/permissions.ts
 *
 * Centralised event access resolution. Use `resolveEventGrant` to determine
 * WHO the caller is relative to a given event, then enforce rules in each route.
 *
 * All checks happen server-side; the result is never trusted from the client.
 */

import prisma from '@/lib/prisma'
import { isAdminEmail } from '@/lib/isAdmin'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import type { Session } from 'next-auth'

export type EventGrant = {
  /** Prisma event id */
  eventId: string
  /** The authenticated user's id, or null for unauthenticated requests */
  userId: string | null
  /** The event's owning organizer id */
  organizerId: string | null
  /** Caller owns the event */
  isOwner: boolean
  /** Caller is a super-admin (email env var match) */
  isAdmin: boolean
  /** Caller is an accepted team member with access to this event */
  isTeamMember: boolean
  /** The request presented a valid dashboardToken */
  hasValidToken: boolean
  /**
   * Convenience: true when the caller has ANY form of access.
   * Equivalent to: isOwner || isAdmin || isTeamMember || hasValidToken
   */
  hasAccess: boolean
}

/**
 * Resolves the caller's permissions for a given event.
 *
 * @param slug        Event slug
 * @param session     Result of `getServerSession(authOptions)` — may be null
 * @param token       The `token` query/body param (dashboardToken), if any
 * @returns           `EventGrant` object, or `null` when the event doesn't exist
 */
export async function resolveEventGrant(
  slug: string,
  session: Session | null,
  token?: string | null
): Promise<EventGrant | null> {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizerId: true, dashboardToken: true },
  })

  if (!event) return null

  const userId = session?.user?.id ?? null
  const isOwner = !!(userId && event.organizerId === userId)
  const isAdmin = isAdminEmail(session?.user?.email)
  const hasValidToken = !!(token && token === event.dashboardToken)

  let isTeamMember = false
  if (userId && !isOwner && !isAdmin && event.organizerId) {
    isTeamMember = await hasTeamEventAccess({
      userId,
      organizerId: event.organizerId,
      eventId: event.id,
    })
  }

  return {
    eventId: event.id,
    userId,
    organizerId: event.organizerId,
    isOwner,
    isAdmin,
    isTeamMember,
    hasValidToken,
    hasAccess: isOwner || isAdmin || isTeamMember || hasValidToken,
  }
}
