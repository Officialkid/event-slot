import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { parseEventContact } from '@/lib/eventContact'

export async function GET(_req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const event = await prisma.event.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        accessType: true,
        eventType: true,
        capacity: true,
        deadline: true,
        eventDate: true,
        eventEndAt: true,
        joinOpensAt: true,
        location: true,
        mapDirectionsUrl: true,
        entryFeeLabel: true,
        showRemainingSpots: true,
        attendeeConsentEnabled: true,
        attendeeConsentText: true,
        communityLink: true,
        imageUrl: true,
        questions: true,
        organizerId: true,
        category: true,
        whatsappNumber: true,
        isPaid: true,
        ticketTiers: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            presetKey: true,
            badgeColor: true,
            textColor: true,
            metallic: true,
            prestige: true,
            priceKes: true,
            currency: true,
            capacity: true,
            description: true,
            bundleSize: true,
            soldCount: true,
            waitlistCount: true,
            status: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    if (event.organizerId !== session.user.id && !(await hasOrganiserAccess(session, event.id))) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const parsedContact = parseEventContact(event.whatsappNumber)

    return NextResponse.json({
      success: true,
      event: {
        ...event,
        whatsappNumber: parsedContact?.number ?? '',
        contactMode: parsedContact?.mode ?? 'WHATSAPP',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
