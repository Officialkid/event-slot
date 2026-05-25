import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { processSignupReferral } from "@/lib/referral"
import { cookies } from "next/headers"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ claimed: false }, { status: 401 })
    }

    const cookieStore = await cookies()
    const referralCode = cookieStore.get("eventslot_ref")?.value

    if (!referralCode) {
      return NextResponse.json({ claimed: false })
    }

    await processSignupReferral(session.user.id, referralCode)
    cookieStore.delete("eventslot_ref")

    return NextResponse.json({ claimed: true })
  } catch {
    return NextResponse.json({ claimed: false })
  }
}
