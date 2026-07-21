import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasAdminAccess } from "@/lib/isAdmin"
import prisma from "@/lib/prisma"

const FEATURE_NAME = "EventSlot Play Store early tester"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const testers = await prisma.featureInterest.findMany({
      where: { featureName: FEATURE_NAME },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      testers,
      summary: {
        total: testers.length,
        latestSignupAt: testers[0]?.createdAt ?? null,
      },
      playConsole: {
        track: "Internal testing",
        note: "Add these emails to the Play Console tester list, then send the opt-in testing link from Play Console.",
      },
    })
  } catch (error) {
    console.error("[admin/app-testers] GET error:", error)
    return NextResponse.json({ error: "Unable to load app testers." }, { status: 500 })
  }
}
