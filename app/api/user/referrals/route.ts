import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOrCreateReferralLink } from "@/lib/referral"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const [referralUrl, referrals, tokenBalance] = await Promise.all([
      getOrCreateReferralLink(userId),
      prisma.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          signupTokens: true,
          eventTokens: true,
          totalEarned: true,
          createdAt: true,
          eventCreatedAt: true,
        },
      }),
      prisma.tokenBalance.findUnique({
        where: { userId },
        select: { balance: true },
      }),
    ])

    const totalReferrals = referrals.length
    const completedReferrals = referrals.filter((r) => r.status === "EVENT_CREATED").length
    const totalTokensEarned = referrals.reduce((sum, r) => sum + r.totalEarned, 0)

    return NextResponse.json({
      referralUrl,
      stats: {
        totalReferrals,
        completedReferrals,
        pendingReferrals: totalReferrals - completedReferrals,
        totalTokensEarned,
        currentBalance: tokenBalance?.balance ?? 0,
      },
      referrals: referrals.map((r, i) => ({
        id: r.id,
        label: `Referral ${i + 1}`,
        status: r.status,
        earned: r.totalEarned,
        signedUpAt: r.createdAt,
        eventCreatedAt: r.eventCreatedAt,
      })),
    })
  } catch {
    return NextResponse.json({
      referralUrl: "",
      stats: {
        totalReferrals: 0,
        completedReferrals: 0,
        pendingReferrals: 0,
        totalTokensEarned: 0,
        currentBalance: 0,
      },
      referrals: [],
    })
  }
}
