import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkAndAwardPioneerBadge } from "@/lib/referral"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ isPioneer: false, showCongratulations: false })
  }

  const userId = session.user.id

  // Auto-award Pioneer badge to any eligible existing user who hasn't received it yet
  await checkAndAwardPioneerBadge(userId).catch(() => {})

  const pioneer = await prisma.pioneerBadge.findUnique({
    where: { userId },
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
