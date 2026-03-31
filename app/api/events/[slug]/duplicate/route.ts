import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) +
    "-" +
    randomBytes(3).toString("hex")
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug } = params
    const source = await prisma.event.findUnique({ where: { slug } })

    if (!source) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (source.organizerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const newTitle = `${source.title} (Copy)`
    const newSlug = generateSlug(newTitle)
    const newToken = randomBytes(20).toString("hex")

    const duplicate = await prisma.event.create({
      data: {
        title: newTitle,
        description: source.description,
        slug: newSlug,
        capacity: source.capacity,
        questions: source.questions ?? [],
        organizerEmail: session.user.email,
        organizerId: session.user.id,
        dashboardToken: newToken,
        status: "active",
        archived: false,
      },
    })

    return NextResponse.json({ success: true, slug: duplicate.slug })
  } catch {
    return NextResponse.json({ error: "Failed to duplicate event" }, { status: 500 })
  }
}
