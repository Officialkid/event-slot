import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist'

type TierInput = {
  id?: string
  name: string
  priceKes: number
  capacity: number
  description?: string | null
  bundleSize?: number
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    include: { ticketTiers: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (event.organizerId !== session.user.id && !(await hasOrganiserAccess(session, event.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!event.isPaid) {
    return NextResponse.json({ error: 'This event is not a paid event' }, { status: 400 })
  }

  const body = await req.json().catch(() => null) as { ticketTiers?: TierInput[] } | null
  const ticketTiers = body?.ticketTiers ?? []

  if (!Array.isArray(ticketTiers) || ticketTiers.length === 0) {
    return NextResponse.json({ error: 'At least one ticket tier is required' }, { status: 400 })
  }

  if (ticketTiers.length > 10) {
    return NextResponse.json({ error: 'Maximum 10 ticket tiers allowed' }, { status: 400 })
  }

  for (const tier of ticketTiers) {
    if (!tier.name?.trim() || !tier.priceKes || tier.priceKes < 50 || !tier.capacity || tier.capacity < 1) {
      return NextResponse.json({ error: 'Each tier needs a name, a minimum KSh 50 price, and a capacity.' }, { status: 400 })
    }
  }

  const existingById = new Map(event.ticketTiers.map((tier) => [tier.id, tier]))
  const offeredTierIds: string[] = []

  await prisma.$transaction(async (tx) => {
    const incomingIds = new Set(ticketTiers.map((tier) => tier.id).filter(Boolean) as string[])

    for (const [index, tier] of ticketTiers.entries()) {
      if (tier.id && existingById.has(tier.id)) {
        const previous = existingById.get(tier.id)!
        await tx.ticketTier.update({
          where: { id: tier.id },
          data: {
            name: tier.name.trim(),
            priceKes: Number(tier.priceKes),
            capacity: Number(tier.capacity),
            description: tier.description?.trim() || null,
            bundleSize: Number(tier.bundleSize || 1),
            sortOrder: index,
            status: 'ACTIVE',
          },
        })
        if (tier.capacity > previous.capacity && previous.waitlistCount > 0) {
          offeredTierIds.push(tier.id)
        }
      } else {
        const created = await tx.ticketTier.create({
          data: {
            eventId: event.id,
            name: tier.name.trim(),
            priceKes: Number(tier.priceKes),
            capacity: Number(tier.capacity),
            description: tier.description?.trim() || null,
            bundleSize: Number(tier.bundleSize || 1),
            sortOrder: index,
          },
          select: { id: true },
        })
        offeredTierIds.push(created.id)
      }
    }

    for (const existing of event.ticketTiers) {
      if (!incomingIds.has(existing.id)) {
        if (existing.soldCount > 0 || existing.waitlistCount > 0) {
          await tx.ticketTier.update({
            where: { id: existing.id },
            data: { status: 'ARCHIVED' },
          })
        } else {
          await tx.ticketTier.delete({ where: { id: existing.id } })
        }
      }
    }

    await tx.event.update({
      where: { id: event.id },
      data: {
        capacity: ticketTiers.reduce((sum, tier) => sum + Number(tier.capacity || 0), 0),
        ticketPrice: Number(ticketTiers[0].priceKes),
      },
    })
  })

  for (const tierId of offeredTierIds) {
    await offerNextPaidWaitlistSpot(event.id, tierId).catch(() => {})
  }

  const updated = await prisma.ticketTier.findMany({
    where: { eventId: event.id },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      priceKes: true,
      capacity: true,
      description: true,
      bundleSize: true,
      sortOrder: true,
      soldCount: true,
      waitlistCount: true,
      status: true,
    },
  })

  return NextResponse.json({ success: true, ticketTiers: updated })
}
