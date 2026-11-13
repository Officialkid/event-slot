import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import { OPPORTUNITY_TYPES, WORK_ARRANGEMENTS } from "@/lib/recruitment/types"

// GET /api/admin/recruitment/vacancies
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = await checkRecruitmentAccess(session)
  if (!access.authorized) {
    return NextResponse.json({ error: access.error || "Unauthorized" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get("status")

  const where: any = {}
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter
  }

  // If reviewer, scope to assigned vacancies only
  if (!access.isGlobalAdmin) {
    const assignments = await prisma.recruitmentReviewerAssignment.findMany({
      where: {
        userId: session!.user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { vacancyId: true },
    })

    const hasGlobalScope = assignments.some((a) => a.vacancyId === null)
    if (!hasGlobalScope) {
      const allowedIds = assignments.map((a) => a.vacancyId!).filter(Boolean)
      where.id = { in: allowedIds }
    }
  }

  const vacancies = await prisma.vacancy.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { applications: true } },
      hiringLead: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({ vacancies })
}

// POST /api/admin/recruitment/vacancies (Create vacancy — Admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const access = await checkRecruitmentAccess(session, { requireAdmin: true })
  if (!access.authorized) {
    return NextResponse.json({ error: access.error || "Administrative permission required" }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const {
    title,
    slug,
    type,
    department,
    location,
    workArrangement = "REMOTE",
    openingsCount = 1,
    shortSummary,
    description,
    responsibilities,
    qualifications,
    skills = [],
    compensation,
    coverImageUrl,
    status = "DRAFT",
    opensAt,
    closesAt,
    requiredDocuments = ["RESUME"],
    optionalDocuments = [],
    questions = [],
    hiringLeadId,
  } = body

  // Validation
  if (!title?.trim() || !slug?.trim() || !type || !department?.trim() || !shortSummary?.trim() || !description?.trim()) {
    return NextResponse.json({ error: "Missing required vacancy fields (title, slug, type, department, summary, description)" }, { status: 400 })
  }

  // Slug normalization and validation
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
  if (!cleanSlug) {
    return NextResponse.json({ error: "Invalid URL slug" }, { status: 400 })
  }

  const existingSlug = await prisma.vacancy.findUnique({
    where: { slug: cleanSlug },
    select: { id: true },
  })
  if (existingSlug) {
    return NextResponse.json({ error: "A vacancy with this URL slug already exists" }, { status: 409 })
  }

  // Validate Opportunity Type against the 7 supported types
  const validTypes = OPPORTUNITY_TYPES.map((t) => t.value)
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `Invalid opportunity type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 })
  }

  // Validate date range if provided
  let parsedOpensAt: Date | null = null
  let parsedClosesAt: Date | null = null
  if (opensAt) parsedOpensAt = new Date(opensAt)
  if (closesAt) parsedClosesAt = new Date(closesAt)

  if (parsedOpensAt && parsedClosesAt && parsedOpensAt > parsedClosesAt) {
    return NextResponse.json({ error: "Closing date must be after opening date" }, { status: 400 })
  }

  try {
    const vacancy = await prisma.$transaction(async (tx) => {
      const created = await tx.vacancy.create({
        data: {
          title: title.trim(),
          slug: cleanSlug,
          type,
          department: department.trim(),
          location: (location || "Nairobi, Kenya").trim(),
          workArrangement,
          openingsCount: Math.max(1, parseInt(String(openingsCount), 10) || 1),
          shortSummary: shortSummary.trim(),
          description: description.trim(),
          responsibilities: (responsibilities || "").trim(),
          qualifications: (qualifications || "").trim(),
          skills: Array.isArray(skills) ? skills : [],
          compensation: compensation?.trim() || null,
          coverImageUrl: coverImageUrl?.trim() || null,
          status,
          opensAt: parsedOpensAt,
          closesAt: parsedClosesAt,
          requiredDocuments,
          optionalDocuments,
          questions,
          hiringLeadId: hiringLeadId || null,
          createdById: session!.user.id,
          closedAt: status === "CLOSED" ? new Date() : null,
        },
      })

      // Record in Audit Log
      await tx.recruitmentAuditLog.create({
        data: {
          actorId: session!.user.id,
          actorEmail: session!.user.email || null,
          action: "VACANCY_CREATED",
          targetType: "VACANCY",
          targetId: created.id,
          vacancyId: created.id,
          newValue: { title: created.title, status: created.status, slug: created.slug },
          details: `Created vacancy "${created.title}" with status ${created.status}`,
        },
      })

      return created
    })

    return NextResponse.json({ success: true, vacancy })
  } catch (err) {
    console.error("[vacancies/create] Error:", err)
    return NextResponse.json({ error: "Failed to create vacancy record" }, { status: 500 })
  }
}
