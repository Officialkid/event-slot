import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasOrganiserAccess } from '@/lib/adminMode'
import { parseEventContact, validateAndEncodeEventContact } from "@/lib/eventContact"

// PUT /api/events/[slug]/whatsapp
// Body: { whatsappNumber: string | null, contactMode?: "WHATSAPP" | "CALL" }
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { whatsappNumber, contactMode } = (await req.json()) as { whatsappNumber: string | null; contactMode?: "WHATSAPP" | "CALL" }

  const event = await prisma.event.findUnique({ where: { slug } })
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (event.organizerId !== session.user.id && !(await hasOrganiserAccess(session, event.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let storedEventContact: string | null = null
  if (whatsappNumber?.trim()) {
    const validatedContact = validateAndEncodeEventContact(whatsappNumber, contactMode === 'CALL' ? 'CALL' : 'WHATSAPP')
    if (!validatedContact.ok) {
      return NextResponse.json({ error: validatedContact.error }, { status: 400 })
    }
    storedEventContact = validatedContact.stored
  }

  await prisma.event.update({
    where: { id: event.id },
    data: { whatsappNumber: storedEventContact },
  })

  const parsedContact = parseEventContact(storedEventContact)
  return NextResponse.json({
    ok: true,
    whatsappNumber: parsedContact?.number ?? null,
    contactMode: parsedContact?.mode ?? 'WHATSAPP',
  })
}
