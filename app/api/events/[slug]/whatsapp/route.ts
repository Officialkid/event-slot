import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasOrganiserAccess } from '@/lib/adminMode'

// PUT /api/events/[slug]/whatsapp
// Body: { whatsappNumber: string | null }
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { whatsappNumber } = (await req.json()) as { whatsappNumber: string | null }

  const event = await prisma.event.findUnique({ where: { slug } })
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (event.organizerId !== session.user.id && !(await hasOrganiserAccess(session, event.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const clean = whatsappNumber ? whatsappNumber.replace(/\D/g, "") : null

  // E.164 allows up to 15 digits; reject unrealistic short/long numbers.
  if (clean && (clean.length < 7 || clean.length > 15)) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 })
  }

  await prisma.event.update({
    where: { id: event.id },
    data: { whatsappNumber: clean },
  })

  return NextResponse.json({ ok: true, whatsappNumber: clean })
}
