import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const logs = await prisma.marketingAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error("[Marketing Audit GET error]", error)
    return NextResponse.json({ error: "Failed to fetch marketing audit logs." }, { status: 500 })
  }
}
