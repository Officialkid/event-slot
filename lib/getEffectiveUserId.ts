import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Returns the "effective" user ID to use when querying events.
 * If the current user is a team member of someone else, returns the owner's ID.
 * Otherwise returns their own ID.
 */
export async function getEffectiveUserId(): Promise<{ userId: string; email: string | null } | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const membership = await prisma.teamMember.findFirst({
    where: { memberId: session.user.id, status: 'accepted' },
    include: { owner: { select: { id: true, email: true } } },
  })

  if (membership) {
    return { userId: membership.owner.id, email: membership.owner.email }
  }

  return { userId: session.user.id, email: session.user.email ?? null }
}
