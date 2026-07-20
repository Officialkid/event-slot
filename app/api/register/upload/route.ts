import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { v4 as uuidv4 } from "uuid"
import prisma from "@/lib/prisma"
import { ratelimit } from "@/lib/ratelimit"
import { validateR2Env } from "@/lib/validateEnv"

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
])
const MAX_BYTES = 10 * 1024 * 1024

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucketName = process.env.R2_BUCKET_NAME?.trim()
  const publicUrl = process.env.R2_PUBLIC_URL?.trim()

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    throw new Error("R2 environment variables not configured")
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl }
}

function getR2Client(config: { accountId: string; accessKeyId: string; secretAccessKey: string }) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (fromName && fromName.length <= 8) return fromName
  if (file.type === "image/jpeg") return "jpg"
  if (file.type === "application/pdf") return "pdf"
  return "bin"
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
  const limited = await ratelimit.limit(`registration-upload:${ip}`)
  if (!limited.success) {
    return NextResponse.json({ error: "Too many uploads. Please try again shortly." }, { status: 429 })
  }

  const missing = validateR2Env()
  if (missing.length > 0) {
    return NextResponse.json({ error: "File upload is not configured yet." }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const eventSlug = String(formData.get("eventSlug") ?? "").trim()
  const questionId = String(formData.get("questionId") ?? "").trim()
  const file = formData.get("file")

  if (!eventSlug || !questionId) {
    return NextResponse.json({ error: "Missing event or question." }, { status: 400 })
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Upload an image, PDF, Word, Excel, or text file." }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. Maximum is 10 MB." }, { status: 400 })
  }

  const event = await prisma.event.findFirst({
    where: { slug: eventSlug, archived: false },
    select: { id: true, questions: true },
  })

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 })
  }

  const questions = Array.isArray(event.questions) ? event.questions as Array<{ id: string; type: string }> : []
  const question = questions.find((item) => item.id === questionId)
  if (question?.type !== "file") {
    return NextResponse.json({ error: "This question does not accept file uploads." }, { status: 400 })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: "Unable to read uploaded file." }, { status: 400 })
  }

  const ext = extensionFor(file)
  const key = `registrations/${event.id}/${questionId}/${uuidv4()}.${ext}`

  try {
    const config = getR2Config()
    const r2 = getR2Client(config)
    await r2.send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        originalName: file.name.slice(0, 180),
        eventId: event.id,
        questionId,
      },
    }))

    const publicBase = new URL(config.publicUrl).toString().replace(/\/+$/, "")
    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        url: `${publicBase}/${key}`,
      },
    })
  } catch (error) {
    console.error("[register/upload] R2 upload failed:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "File upload failed. Please try again." }, { status: 503 })
  }
}
