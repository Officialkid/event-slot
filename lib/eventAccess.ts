import prisma from '@/lib/prisma'

type TeamAccessParams = {
  userId: string
  organizerId: string | null
  eventId: string
}

export async function hasTeamEventAccess({ userId, organizerId, eventId }: TeamAccessParams): Promise<boolean> {
  if (!organizerId || userId === organizerId) return false

  const membership = await prisma.teamMember.findFirst({
    where: {
      ownerId: organizerId,
      memberId: userId,
      status: 'accepted',
    },
    select: {
      id: true,
      _count: { select: { eventAccess: true } },
      eventAccess: {
        where: { eventId },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!membership) return false

  // If no specific event assignments exist for this member, treat as full owner-team access.
  if (membership._count.eventAccess === 0) return true

  return membership.eventAccess.length > 0
}
