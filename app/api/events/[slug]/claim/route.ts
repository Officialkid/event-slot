import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { token } = body
  const { slug } = params

  if (!token) {
    return NextResponse.json({ success: false, error: "Token required" }, { status: 400 })
  }

  try {
    const event = await prisma.event.findUnique({ where: { slug } })
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }
    if (event.dashboardToken !== token) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 })
    }

    await prisma.event.update({
      where: { slug },
      data: { organizerId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
