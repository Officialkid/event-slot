import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasOrganiserAccess } from '@/lib/adminMode'

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

    const body = await req.json()
    const title = body?.title?.trim()

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    await prisma.event.update({ where: { slug }, data: { title } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to rename event" }, { status: 500 })
  }
}
