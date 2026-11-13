import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { careerApplicationRatelimit } from "@/lib/ratelimit"
import { generateUniqueReferenceCode } from "@/lib/recruitment/reference-code"
import {
  saveRecruitmentDocument,
  ALLOWED_DOCUMENT_MIMES,
  MAX_DOCUMENT_SIZE,
} from "@/lib/recruitment/storage"
import { type VacancyQuestion, type SubmittedAnswer } from "@/lib/recruitment/types"

interface RouteProps {
  params: Promise<{ slug: string }>
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const { slug } = await params

  // 1. Abuse Protection & Rate Limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1"
  const limitRes = await careerApplicationRatelimit.limit(ip)
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many application attempts. Please wait a few minutes before trying again." },
      { status: 429 }
    )
  }

  // 2. Lookup Vacancy & Enforce Server-Side Deadline / Status
  const vacancy = await prisma.vacancy.findUnique({
    where: { slug },
  })

  if (!vacancy || vacancy.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "This position is not currently accepting applications." },
      { status: 404 }
    )
  }

  const now = new Date()
  if (vacancy.closesAt && new Date(vacancy.closesAt) <= now) {
    return NextResponse.json(
      { error: "Applications for this position have closed." },
      { status: 400 }
    )
  }

  // 3. Process Multi-part Form Data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form submission data" }, { status: 400 })
  }

  // Extract Section 1: Personal Info
  const fullName = String(formData.get("fullName") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const phone = String(formData.get("phone") || "").trim() || null
  const location = String(formData.get("location") || "").trim() || null

  if (!fullName || !email) {
    return NextResponse.json({ error: "Full name and email are mandatory." }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 })
  }

  // Extract Section 2: Background & Experience
  const education = String(formData.get("education") || "").trim() || null
  const experience = String(formData.get("experience") || "").trim() || null
  const skillsRaw = String(formData.get("skills") || "")
  const skills = skillsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const portfolioLinksRaw = String(formData.get("portfolioLinks") || "")
  const portfolioLinks = portfolioLinksRaw
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean)

  // Extract Section 3: Vacancy-Specific Questions
  const answersJsonRaw = String(formData.get("answers") || "[]")
  let submittedAnswers: SubmittedAnswer[] = []
  try {
    submittedAnswers = JSON.parse(answersJsonRaw)
  } catch {
    submittedAnswers = []
  }

  // Validate required questions against vacancy definition
  const vacancyQuestions = (Array.isArray(vacancy.questions)
    ? (vacancy.questions as unknown as VacancyQuestion[])
    : [])

  for (const q of vacancyQuestions) {
    if (q.required) {
      const answer = submittedAnswers.find((a) => a.questionId === q.id)
      const val = answer?.value
      if (
        val === undefined ||
        val === null ||
        (typeof val === "string" && !val.trim()) ||
        (Array.isArray(val) && val.length === 0)
      ) {
        return NextResponse.json(
          { error: `Missing required question answer: "${q.label}"` },
          { status: 400 }
        )
      }
    }
  }

  // Extract Privacy Notice Acknowledgment
  const privacyAcknowledged = formData.get("privacyAcknowledged") === "true"
  if (!privacyAcknowledged) {
    return NextResponse.json(
      { error: "You must acknowledge the recruitment privacy notice before submitting." },
      { status: 400 }
    )
  }

  // Extract Section 4: Supporting Documents
  const uploadedFiles: { file: File; documentType: string }[] = []

  // Check CV/Resume
  const resumeFile = formData.get("resume")
  if (resumeFile instanceof File && resumeFile.size > 0) {
    uploadedFiles.push({ file: resumeFile, documentType: "RESUME" })
  } else {
    // If vacancy requires resume
    const requiredDocs = Array.isArray(vacancy.requiredDocuments)
      ? (vacancy.requiredDocuments as string[])
      : []
    if (requiredDocs.includes("RESUME")) {
      return NextResponse.json({ error: "A CV or résumé document is required." }, { status: 400 })
    }
  }

  // Check Portfolio
  const portfolioFile = formData.get("portfolio")
  if (portfolioFile instanceof File && portfolioFile.size > 0) {
    uploadedFiles.push({ file: portfolioFile, documentType: "PORTFOLIO" })
  }

  // Check Cover Letter
  const coverLetterFile = formData.get("coverLetter")
  if (coverLetterFile instanceof File && coverLetterFile.size > 0) {
    uploadedFiles.push({ file: coverLetterFile, documentType: "COVER_LETTER" })
  }

  // Validate all uploaded files (MIME type & size)
  for (const { file, documentType } of uploadedFiles) {
    if (!ALLOWED_DOCUMENT_MIMES.has(file.type)) {
      return NextResponse.json(
        { error: `Disallowed file type for ${documentType}: ${file.type}. Please upload PDF, Word, or image documents.` },
        { status: 400 }
      )
    }

    if (file.size > MAX_DOCUMENT_SIZE) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds the maximum 10 MB size limit.` },
        { status: 400 }
      )
    }
  }

  // 4. Generate Unique Reference Code & Persist Everything in DB
  try {
    const referenceCode = await generateUniqueReferenceCode(prisma)

    const result = await prisma.$transaction(async (tx) => {
      // Create Application
      const application = await tx.jobApplication.create({
        data: {
          referenceCode,
          vacancyId: vacancy.id,
          fullName,
          email,
          phone,
          location,
          education: education ? { text: education } : undefined,
          experience: experience ? { text: experience } : undefined,
          skills,
          portfolioLinks,
          answers: submittedAnswers as any,
          status: "SUBMITTED",
          statusReason: "Application successfully submitted and queued for review.",
          submissionIp: ip,
        },
      })

      // Create Initial Timeline Entry
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: application.id,
          newStatus: "SUBMITTED",
          publicReason: "Application received.",
        },
      })

      // Save and attach documents privately
      for (const { file, documentType } of uploadedFiles) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const docId = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
        const savedDoc = await saveRecruitmentDocument(buffer, docId, file.type)

        await tx.applicationDocument.create({
          data: {
            applicationId: application.id,
            documentType,
            fileName: file.name.slice(0, 200),
            fileSize: savedDoc.fileSize,
            mimeType: file.type,
            storageProvider: savedDoc.storageProvider,
            storageKey: savedDoc.storageKey,
            checksum: savedDoc.checksum,
          },
        })
      }

      // Record in Audit Trail
      await tx.recruitmentAuditLog.create({
        data: {
          actorEmail: email,
          actorName: fullName,
          action: "APPLICATION_SUBMITTED",
          targetType: "APPLICATION",
          targetId: application.id,
          vacancyId: vacancy.id,
          newValue: { referenceCode, status: "SUBMITTED" },
          details: `Candidate ${fullName} submitted application for "${vacancy.title}"`,
          ipAddress: ip,
        },
      })

      return application
    })

    return NextResponse.json({
      success: true,
      referenceCode: result.referenceCode,
      vacancyTitle: vacancy.title,
      submittedAt: result.submittedAt.toISOString(),
    })
  } catch (err: any) {
    console.error("[careers/apply] Submission error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred while saving your application. Please try again." },
      { status: 500 }
    )
  }
}
