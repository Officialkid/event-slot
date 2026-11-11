import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasTeamEventAccess } from "@/lib/eventAccess"
import { hasOrganiserAccess } from "@/lib/adminMode"
import { generateVerifierCode } from "@/lib/verifierCode"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    const body = (await req.json().catch(() => ({}))) as { token?: string }
    const token = body?.token?.trim() ?? ""

    const event = await prisma.event.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: {
        id: true,
        slug: true,
        organizerId: true,
        dashboardToken: true,
        verifierCode: true,
        verifierCodeEnabled: true,
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const isOwner = Boolean(session?.user?.id && event.organizerId === session.user.id)
    const isPlatformAdmin = hasOrganiserAccess(session)
    const isTeamMember = session?.user?.id
      ? await hasTeamEventAccess(session.user.id, event.id)
      : false
    const hasDashboardToken = Boolean(token && event.dashboardToken && token === event.dashboardToken)

    if (!isOwner && !isPlatformAdmin && !isTeamMember && !hasDashboardToken) {
      return NextResponse.json(
        { error: "Unauthorized to manage gate verifier settings for this event" },
        { status: 403 }
      )
    }

    const newVerifierCode = generateVerifierCode()

    await prisma.event.update({
      where: { id: event.id },
      data: {
        verifierCode: newVerifierCode,
        verifierCodeEnabled: true,
      },
    })

    return NextResponse.json({
      success: true,
      verifierCode: newVerifierCode,
      message: "Verifier access code successfully reset.",
    })
  } catch (error) {
    console.error("[VERIFIER CODE RESET FAILED]", error)
    return NextResponse.json(
      { error: "Failed to reset verifier code" },
      { status: 500 }
    )
  }
}
