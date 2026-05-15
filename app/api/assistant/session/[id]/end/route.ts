import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { updateMemoryAfterSession } from "@/lib/assistant-memory"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authSession = await getServerSession(authOptions)
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const existingSession = await prisma.assistantSession.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existingSession || existingSession.userId !== authSession.user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const endedSession = await prisma.assistantSession.update({
      where: { id },
      data: { status: "ENDED", endedAt: new Date() },
      select: {
        userId: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true },
        },
      },
    })

    if (endedSession.userId) {
      await updateMemoryAfterSession(
        endedSession.userId,
        endedSession.messages.map((message) => ({
          role: message.role,
          content: message.content,
        }))
      )
    }

    return NextResponse.json({
      message:
        "Thank you for contacting EventSlot. This session has ended. " +
        "Have a wonderful day!",
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }
    console.error("[assistant/session/:id/end] failed", error)
    return NextResponse.json(
      {
        error: "SESSION_END_FAILED",
        message: "Unable to end this session right now. Please try again.",
      },
      { status: 500 }
    )
  }
}
