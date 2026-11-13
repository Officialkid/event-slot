import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import { readRecruitmentDocument } from "@/lib/recruitment/storage"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session, { applicationId: id })

    if (!access.authorized) {
      return NextResponse.json({ error: access.error || "Unauthorized" }, { status: 403 })
    }

    const documentRecord = await prisma.applicationDocument.findFirst({
      where: {
        id: docId,
        applicationId: id,
      },
    })

    if (!documentRecord) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const buffer = await readRecruitmentDocument(
      documentRecord.storageProvider,
      documentRecord.storageKey
    )

    // Log document access audit event
    await prisma.recruitmentAuditLog.create({
      data: {
        action: "DOCUMENT_ACCESSED",
        targetType: "ApplicationDocument",
        targetId: docId,
        actorId: access.userId!,
        actorEmail: access.userEmail || "unknown",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
        details: JSON.stringify({
          applicationId: id,
          documentType: documentRecord.documentType,
          filename: documentRecord.fileName,
          mimeType: documentRecord.mimeType,
          fileSize: documentRecord.fileSize,
        }),
      },
    })

    const safeFilename = encodeURIComponent(documentRecord.fileName)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": documentRecord.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (err: any) {
    console.error("[ADMIN_DOCUMENT_STREAM_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to stream document" },
      { status: 500 }
    )
  }
}
