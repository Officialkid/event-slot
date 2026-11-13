import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess, getPermittedVacancyIds } from "@/lib/recruitment/permissions"
import { Prisma } from "@prisma/client"

function escapeCsvField(val: string | null | undefined): string {
  if (val === null || val === undefined) return '""'
  const stringVal = String(val).replace(/"/g, '""')
  return `"${stringVal}"`
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session)

    if (!access.authorized) {
      return NextResponse.json({ error: access.error || "Unauthorized" }, { status: 403 })
    }

    if (!access.isGlobalAdmin && access.role !== "HIRING_MANAGER") {
      return NextResponse.json(
        { error: "Insufficient privileges to export candidate records" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const vacancyId = searchParams.get("vacancyId") || undefined
    const status = searchParams.get("status") || undefined

    const permittedVacancies = await getPermittedVacancyIds(
      access.userId!,
      access.isGlobalAdmin
    )

    const where: Prisma.JobApplicationWhereInput = {}

    if (permittedVacancies !== null) {
      where.vacancyId = { in: permittedVacancies }
    }

    if (vacancyId) {
      if (permittedVacancies !== null && !permittedVacancies.includes(vacancyId)) {
        return NextResponse.json({ error: "Access denied to this vacancy" }, { status: 403 })
      }
      where.vacancyId = vacancyId
    }

    if (status) {
      where.status = status as any
    }

    const applications = await prisma.jobApplication.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      include: {
        vacancy: {
          select: {
            title: true,
            department: true,
            type: true,
          },
        },
      },
    })

    const csvHeaders = [
      "Reference Code",
      "Candidate Name",
      "Email",
      "Phone",
      "Location",
      "Role Title",
      "Department",
      "Opportunity Type",
      "Status",
      "Submitted At (Nairobi)",
    ].join(",")

    const csvRows = applications.map((app) => {
      const nairobiDate = new Date(app.submittedAt).toLocaleString("en-KE", {
        timeZone: "Africa/Nairobi",
      })

      return [
        escapeCsvField(app.referenceCode),
        escapeCsvField(app.fullName),
        escapeCsvField(app.email),
        escapeCsvField(app.phone),
        escapeCsvField(app.location),
        escapeCsvField(app.vacancy.title),
        escapeCsvField(app.vacancy.department),
        escapeCsvField(app.vacancy.type),
        escapeCsvField(app.status),
        escapeCsvField(nairobiDate),
      ].join(",")
    })

    const csvContent = "\uFEFF" + [csvHeaders, ...csvRows].join("\r\n")

    // Record audit log
    await prisma.recruitmentAuditLog.create({
      data: {
        action: "APPLICATIONS_CSV_EXPORTED",
        targetType: "JOB_APPLICATIONS_EXPORT",
        targetId: vacancyId || "ALL",
        actorId: access.userId!,
        actorEmail: access.userEmail || "unknown",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
        details: `Exported ${applications.length} applications to CSV (vacancy: ${vacancyId || "ALL"}, status: ${status || "ALL"})`,
      },
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="eventslot-applications-${timestamp}.csv"`,
      },
    })
  } catch (err: any) {
    console.error("[ADMIN_APPLICATIONS_EXPORT_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to export applications to CSV" },
      { status: 500 }
    )
  }
}
