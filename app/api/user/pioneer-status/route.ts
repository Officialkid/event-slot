import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ isPioneer: false, showCongratulations: false })
  }

  const pioneer = await prisma.pioneerBadge.findUnique({
    where: { userId: session.user.id },
    select: { hasSeenCongratulations: true },
  })

  return NextResponse.json({
    isPioneer: !!pioneer,
    showCongratulations: pioneer ? !pioneer.hasSeenCongratulations : false,
  })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.pioneerBadge.updateMany({
    where: { userId: session.user.id },
    data: { hasSeenCongratulations: true },
  })

  return NextResponse.json({ success: true })
}
