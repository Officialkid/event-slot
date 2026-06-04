import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveEventGrant } from '@/lib/permissions'
import prisma from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string; registrationId: string }> }
) {
  const { slug, registrationId } = await props.params

  const session = await getServerSession(authOptions)
  const grant = await resolveEventGrant(slug, session)

  if (!grant) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  if (!grant.hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get('status') ?? 'confirmed'

  const allIds = await prisma.registration.findMany({
    where: { eventId: grant.eventId, status: statusFilter },
    orderBy: { submittedAt: 'asc' },
    select: { id: true },
  })

  const ids = allIds.map((r) => r.id)
  const currentIndex = ids.indexOf(registrationId)

  return NextResponse.json({
    total: ids.length,
    currentIndex,
    prevId: currentIndex > 0 ? ids[currentIndex - 1] : null,
    nextId: currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null,
  })
}
