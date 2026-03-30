import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const body = await req.json()
    const { newCapacity, token } = body

    const event = await prisma.event.findUnique({ where: { slug } })
    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    if (event.dashboardToken !== token) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    if (!Number.isInteger(newCapacity) || newCapacity <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid new capacity' }, { status: 400 })
    }

    if (event.capacity !== null && newCapacity <= event.capacity) {
      return NextResponse.json({ success: false, error: 'New capacity must be greater than current capacity' }, { status: 400 })
    }

    const addedSlots = event.capacity === null
      ? newCapacity - event.confirmedCount
      : newCapacity - event.capacity

    if (addedSlots <= 0) {
      return NextResponse.json({ success: false, error: 'New capacity must be greater than current capacity' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      const waitlistToPromote = await tx.registration.findMany({
        where: { eventId: event.id, status: 'waitlist' },
        orderBy: { waitlistPosition: 'asc' },
        take: Math.min(addedSlots, event.waitlistCount),
      })

      const promoted = waitlistToPromote.length

      const updateRegistrations = waitlistToPromote.map(item =>
        tx.registration.update({
          where: { id: item.id },
          data: { status: 'confirmed', waitlistPosition: null },
        })
      )

      const updatedEvent = await tx.event.update({
        where: { id: event.id },
        data: {
          capacity: newCapacity,
          confirmedCount: { increment: promoted },
          waitlistCount: { increment: promoted * -1 },
        },
      })

      await Promise.all(updateRegistrations)

      const remainingSlots = Math.max(0, addedSlots - promoted)

      return {
        promoted,
        newConfirmedCount: updatedEvent.confirmedCount,
        newWaitlistCount: updatedEvent.waitlistCount,
        remainingSlots,
      }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
