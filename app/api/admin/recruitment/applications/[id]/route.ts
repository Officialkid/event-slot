import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session, { applicationId: id })

    if (!access.authorized) {
      return NextResponse.json({ error: access.error || "Unauthorized" }, { status: 403 })
    }

    const application = await prisma.jobApplication.findUnique({
      where: { id },
      include: {
        vacancy: {
          select: {
            id: true,
            title: true,
            slug: true,
            department: true,
            type: true,
            workArrangement: true,
            location: true,
            status: true,
            questions: true,
          },
        },
        documents: {
          select: {
            id: true,
            documentType: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
          },
        },
        timeline: {
          orderBy: { createdAt: "desc" },
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    // Role-based capabilities
    const canUpdateStatus = access.isGlobalAdmin || access.role === "HIRING_MANAGER"
    const canAddNote = access.isGlobalAdmin || access.role === "HIRING_MANAGER" || access.role === "REVIEWER"

    return NextResponse.json({
      application,
      permissions: {
        canUpdateStatus,
        canAddNote,
        role: access.role,
        isGlobalAdmin: access.isGlobalAdmin,
      },
    })
  } catch (err: any) {
    console.error("[ADMIN_RECRUITMENT_APPLICATION_DETAIL_GET_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to retrieve application details" },
      { status: 500 }
    )
  }
}
