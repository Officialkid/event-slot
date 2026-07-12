import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const [interests, totals] = await Promise.all([
      prisma.billingLaunchInterest.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          accountType: true,
          previewMode: true,
          source: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              plan: true,
            },
          },
        },
      }),
      prisma.billingLaunchInterest.groupBy({
        by: ["previewMode"],
        _count: { _all: true },
      }),
    ])

    const previewModeTotals = totals.reduce<Record<string, number>>((acc, row) => {
      acc[row.previewMode ?? "unknown"] = row._count._all
      return acc
    }, {})

    return NextResponse.json({
      interests,
      summary: {
        total: interests.length,
        visuals: previewModeTotals.visuals ?? 0,
        text: previewModeTotals.text ?? 0,
        admins: interests.filter((interest) => interest.accountType === "super_admin").length,
        organisers: interests.filter((interest) => interest.accountType !== "super_admin").length,
      },
    })
  } catch (error) {
    console.error("[admin/billing-launch-interest] GET error:", error)
    return NextResponse.json({ error: "Unable to load billing launch interest." }, { status: 500 })
  }
}
