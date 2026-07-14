import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({
      visible: false,
      hasWithdrawableBalance: false,
      badgeCount: 0,
    })
  } catch (error) {
    console.error("[organizer-payments-summary] GET error:", error)
    return NextResponse.json({
      visible: false,
      hasWithdrawableBalance: false,
      badgeCount: 0,
    })
  }
}
