import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess, getPermittedVacancyIds } from "@/lib/recruitment/permissions"
import { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session)

    if (!access.authorized) {
      return NextResponse.json({ error: access.error || "Unauthorized" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const vacancyId = searchParams.get("vacancyId") || undefined
    const status = searchParams.get("status") || undefined
    const search = searchParams.get("search")?.trim() || undefined
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))
    const skip = (page - 1) * limit

    // Permitted vacancy IDs scoping
    const permittedVacancies = await getPermittedVacancyIds(
      access.userId!,
      access.isGlobalAdmin
    )

    const where: Prisma.JobApplicationWhereInput = {}

    // Reviewer vacancy scoping
    if (permittedVacancies !== null) {
      where.vacancyId = { in: permittedVacancies }
    }

    if (vacancyId) {
      // If user is scoped to specific vacancies, ensure requested vacancyId is allowed
      if (permittedVacancies !== null && !permittedVacancies.includes(vacancyId)) {
        return NextResponse.json(
          { error: "Access denied to this vacancy's applications" },
          { status: 403 }
        )
      }
      where.vacancyId = vacancyId
    }

    if (status) {
      where.status = status as any
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { referenceCode: { contains: search, mode: "insensitive" } },
      ]
    }

    const [total, applications] = await Promise.all([
      prisma.jobApplication.count({ where }),
      prisma.jobApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: "desc" },
        include: {
          vacancy: {
            select: {
              id: true,
              title: true,
              slug: true,
              department: true,
              type: true,
            },
          },
          documents: {
            select: {
              id: true,
              documentType: true,
              fileName: true,
              fileSize: true,
            },
          },
          _count: {
            select: {
              notes: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err: any) {
    console.error("[ADMIN_RECRUITMENT_APPLICATIONS_GET_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to retrieve recruitment applications" },
      { status: 500 }
    )
  }
}
