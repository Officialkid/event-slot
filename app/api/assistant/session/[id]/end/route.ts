import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.assistantSession.update({
      where: { id },
      data: { status: "ENDED", endedAt: new Date() },
    })

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
