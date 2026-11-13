import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import { OPPORTUNITY_TYPES } from "@/lib/recruitment/types"

interface RouteProps {
  params: Promise<{ id: string }>
}

// GET /api/admin/recruitment/vacancies/[id]
export async function GET(req: NextRequest, { params }: RouteProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const access = await checkRecruitmentAccess(session, { vacancyId: id })
  if (!access.authorized) {
    return NextResponse.json({ error: access.error || "Unauthorized" }, { status: 403 })
  }

  const vacancy = await prisma.vacancy.findUnique({
    where: { id },
    include: {
      _count: { select: { applications: true } },
      hiringLead: { select: { id: true, name: true, email: true } },
    },
  })

  if (!vacancy) {
    return NextResponse.json({ error: "Vacancy not found" }, { status: 404 })
  }

  return NextResponse.json({ vacancy })
}

// PATCH /api/admin/recruitment/vacancies/[id] (Edit or change lifecycle — Admin only)
export async function PATCH(req: NextRequest, { params }: RouteProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const access = await checkRecruitmentAccess(session, { vacancyId: id, requireAdmin: true })
  if (!access.authorized) {
    return NextResponse.json({ error: access.error || "Administrative permission required" }, { status: 403 })
  }

  const existing = await prisma.vacancy.findUnique({
    where: { id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Vacancy not found" }, { status: 404 })
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
    workArrangement,
    openingsCount,
    shortSummary,
    description,
    responsibilities,
    qualifications,
    skills,
    compensation,
    coverImageUrl,
    status,
    opensAt,
    closesAt,
    requiredDocuments,
    optionalDocuments,
    questions,
    hiringLeadId,
  } = body

  const updateData: any = {}

  if (title !== undefined) updateData.title = String(title).trim()
  if (department !== undefined) updateData.department = String(department).trim()
  if (location !== undefined) updateData.location = String(location).trim()
  if (workArrangement !== undefined) updateData.workArrangement = workArrangement
  if (openingsCount !== undefined) updateData.openingsCount = Math.max(1, parseInt(String(openingsCount), 10) || 1)
  if (shortSummary !== undefined) updateData.shortSummary = String(shortSummary).trim()
  if (description !== undefined) updateData.description = String(description).trim()
  if (responsibilities !== undefined) updateData.responsibilities = String(responsibilities).trim()
  if (qualifications !== undefined) updateData.qualifications = String(qualifications).trim()
  if (skills !== undefined) updateData.skills = Array.isArray(skills) ? skills : []
  if (compensation !== undefined) updateData.compensation = compensation?.trim() || null
  if (coverImageUrl !== undefined) updateData.coverImageUrl = coverImageUrl?.trim() || null
  if (requiredDocuments !== undefined) updateData.requiredDocuments = requiredDocuments
  if (optionalDocuments !== undefined) updateData.optionalDocuments = optionalDocuments
  if (questions !== undefined) updateData.questions = questions
  if (hiringLeadId !== undefined) updateData.hiringLeadId = hiringLeadId || null

  if (type !== undefined) {
    const validTypes = OPPORTUNITY_TYPES.map((t) => t.value)
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid opportunity type" }, { status: 400 })
    }
    updateData.type = type
  }

  if (slug !== undefined) {
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
    if (!cleanSlug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 })

    if (cleanSlug !== existing.slug) {
      const clash = await prisma.vacancy.findUnique({ where: { slug: cleanSlug } })
      if (clash) return NextResponse.json({ error: "Slug already in use" }, { status: 409 })
      updateData.slug = cleanSlug
    }
  }

  if (opensAt !== undefined) updateData.opensAt = opensAt ? new Date(opensAt) : null
  if (closesAt !== undefined) updateData.closesAt = closesAt ? new Date(closesAt) : null

  if (status !== undefined && status !== existing.status) {
    updateData.status = status
    if (status === "CLOSED" && !existing.closedAt) {
      updateData.closedAt = new Date()
    } else if (status === "ARCHIVED" && !existing.archivedAt) {
      updateData.archivedAt = new Date()
    } else if (status === "PUBLISHED" && existing.status === "CLOSED") {
      // Reopening a closed vacancy
      updateData.closedAt = null
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.vacancy.update({
        where: { id },
        data: updateData,
      })

      // Audit log entry
      await tx.recruitmentAuditLog.create({
        data: {
          actorId: session!.user.id,
          actorEmail: session!.user.email || null,
          action: "VACANCY_UPDATED",
          targetType: "VACANCY",
          targetId: id,
          vacancyId: id,
          previousValue: { status: existing.status, title: existing.title },
          newValue: { status: result.status, title: result.title },
          details: `Updated vacancy "${result.title}"`,
        },
      })

      return result
    })

    return NextResponse.json({ success: true, vacancy: updated })
  } catch (err) {
    console.error("[vacancies/update] Error:", err)
    return NextResponse.json({ error: "Failed to update vacancy" }, { status: 500 })
  }
}
