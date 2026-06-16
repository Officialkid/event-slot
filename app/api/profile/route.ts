import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateProfileSchema } from "@/lib/schemas/profile.schema"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        image: true,
        password: true,
        googleCalendarConnected: true,
        twoFactorEnabled: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      image: user.image,
      hasPassword: !!user.password,
      calendarConnected: !!user.googleCalendarConnected,
      twoFactorEnabled: !!user.twoFactorEnabled,
    })
  } catch (err) {
    console.error("[profile] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = updateProfileSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    const { name, twoFactorEnabled } = parsed.data
    const data: { name?: string; twoFactorEnabled?: boolean } = {}

    if (typeof name === "string" && name.trim().length > 0) {
      data.name = name.trim()
    }
    if (typeof twoFactorEnabled === "boolean") {
      data.twoFactorEnabled = twoFactorEnabled
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[profile] PATCH error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const eventOwnerFilters: Array<{ organizerId?: string; organizerEmail?: string }> = [{ organizerId: user.id }]
    if (user.email) {
      eventOwnerFilters.push({ organizerEmail: user.email })
    }

    await prisma.$transaction(async (tx) => {
      await tx.event.deleteMany({
        where: {
          OR: eventOwnerFilters,
        },
      })

      // These relations are not guaranteed to cascade in every deployed schema.
      await tx.organizerFeedback.deleteMany({ where: { organizerId: user.id } })
      await tx.eventUnlock.deleteMany({ where: { userId: user.id } })

      await tx.user.delete({ where: { id: user.id } })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[profile] DELETE error:", err)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
