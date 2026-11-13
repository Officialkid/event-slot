import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session, { requireAdmin: true })

    if (!access.authorized || !access.isGlobalAdmin) {
      return NextResponse.json({ error: "Only administrators can inspect recruitment audit trails" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get("action") || undefined
    const targetType = searchParams.get("targetType") || undefined
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)))
    const skip = (page - 1) * limit

    const where: Prisma.RecruitmentAuditLogWhereInput = {}

    if (action) {
      where.action = action
    }

    if (targetType) {
      where.targetType = targetType
    }

    const [total, logs] = await Promise.all([
      prisma.recruitmentAuditLog.count({ where }),
      prisma.recruitmentAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          vacancy: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err: any) {
    console.error("[ADMIN_RECRUITMENT_AUDIT_GET_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to retrieve recruitment audit trail" },
      { status: 500 }
    )
  }
}
