import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"

export async function POST(
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

    const body = await req.json()
    const noteText = body.noteText?.trim()

    if (!noteText) {
      return NextResponse.json({ error: "Note content cannot be empty" }, { status: 400 })
    }

    const note = await prisma.applicationInternalNote.create({
      data: {
        applicationId: id,
        authorId: access.userId!,
        note: noteText,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Audit log
    await prisma.recruitmentAuditLog.create({
      data: {
        action: "INTERNAL_NOTE_ADDED",
        targetType: "APPLICATION",
        targetId: id,
        actorId: access.userId!,
        actorEmail: access.userEmail || "unknown",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
        details: `Internal note added by ${access.userEmail || access.userId} (${noteText.length} chars)`,
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (err: any) {
    console.error("[ADMIN_APPLICATION_NOTE_POST_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to record internal note" },
      { status: 500 }
    )
  }
}
