import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.assistantSession.update({
    where: { id: params.id },
    data: { status: "ENDED", endedAt: new Date() },
  })

  return NextResponse.json({
    message:
      "Thank you for contacting EventSlot. This session has ended. " +
      "Have a wonderful day! 🌟",
  })
}
