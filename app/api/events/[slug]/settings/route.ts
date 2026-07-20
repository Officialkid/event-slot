import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeCommunityLink } from "@/lib/communityLink"
import { updateEventSettingsSchema } from "@/lib/schemas/event.schema"
import { hasOrganiserAccess } from '@/lib/adminMode'
import { purgeUserCache } from "@/lib/cache"
import { parseEventContact, validateAndEncodeEventContact } from "@/lib/eventContact"

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug } = params
    const event = await prisma.event.findUnique({ where: { slug } })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (event.organizerId !== session.user.id && !(await hasOrganiserAccess(session, event.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = updateEventSettingsSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { description, eventDate, eventEndAt, joinOpensAt, location, mapDirectionsUrl, communityLink, deadline, whatsappNumber, contactMode } = parsed.data

    let storedEventContact: string | null = null
    if (whatsappNumber?.trim()) {
      const validatedContact = validateAndEncodeEventContact(whatsappNumber, contactMode === 'CALL' ? 'CALL' : 'WHATSAPP')
      if (!validatedContact.ok) {
        return NextResponse.json({ error: validatedContact.error }, { status: 400 })
      }
      storedEventContact = validatedContact.stored
    }

    const updatedEvent = await prisma.event.update({
      where: { slug },
      data: {
        description: description !== undefined ? ((description && description.trim().length > 0) ? description : null) : undefined,
        eventDate: eventDate !== undefined ? (eventDate ? new Date(eventDate) : null) : undefined,
        eventEndAt: eventEndAt !== undefined ? (eventEndAt ? new Date(eventEndAt) : null) : undefined,
        joinOpensAt: joinOpensAt !== undefined ? (joinOpensAt ? new Date(joinOpensAt) : null) : undefined,
        location: location !== undefined ? (location?.trim() || null) : undefined,
        mapDirectionsUrl: mapDirectionsUrl !== undefined ? (mapDirectionsUrl?.trim() || null) : undefined,
        communityLink: communityLink !== undefined ? normalizeCommunityLink(communityLink) : undefined,
        whatsappNumber: whatsappNumber !== undefined ? storedEventContact : undefined,
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : undefined,
      },
      select: {
        description: true,
        eventDate: true,
        eventEndAt: true,
        joinOpensAt: true,
        location: true,
        mapDirectionsUrl: true,
        communityLink: true,
        whatsappNumber: true,
        deadline: true,
      },
    })

    purgeUserCache(session.user.id, session.user.email ?? null)

    const parsedContact = parseEventContact(updatedEvent.whatsappNumber)
    return NextResponse.json({
      success: true,
      event: {
        ...updatedEvent,
        whatsappNumber: parsedContact?.number ?? null,
        contactMode: parsedContact?.mode ?? 'WHATSAPP',
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
