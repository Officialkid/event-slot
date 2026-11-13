import fs from "fs"
import path from "path"
import crypto from "crypto"
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { validateRecruitmentStorageEnv } from "@/lib/validateEnv"
import { Readable } from "stream"

export const ALLOWED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
])

export const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
}

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10 MB

const LOCAL_STORAGE_DIR = path.join(process.cwd(), "storage", "recruitment", "documents")

function ensureLocalStorageDir() {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true })
  }
}

function getRecruitmentBucketName(): string {
  const bucket =
    process.env.RECRUITMENT_R2_BUCKET_NAME?.trim() ||
    process.env.R2_BUCKET_NAME?.trim() ||
    "eventsslot"
  return bucket
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()!
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()!
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()!

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export interface SaveDocumentResult {
  storageProvider: "local" | "r2"
  storageKey: string
  fileSize: number
  checksum: string
}

/**
 * Saves a recruitment document privately (either in private R2 bucket or isolated local storage).
 * Documents are NEVER saved to the public/ directory or given public URLs.
 */
export async function saveRecruitmentDocument(
  fileBuffer: Buffer,
  documentId: string,
  mimeType: string
): Promise<SaveDocumentResult> {
  const ext = MIME_TO_EXT[mimeType] || "bin"
  const storageKey = `recruitment/documents/${documentId}.${ext}`
  const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex")

  const missingR2 = validateRecruitmentStorageEnv()
  const useR2 = missingR2.length === 0

  if (useR2) {
    const bucketName = getRecruitmentBucketName()
    const r2 = getR2Client()

    await r2.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    )

    return {
      storageProvider: "r2",
      storageKey,
      fileSize: fileBuffer.length,
      checksum,
    }
  }

  // Prevent silent candidate data loss in production container environments
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `Recruitment document storage is unconfigured in production. Missing required environment variables: [${missingR2.join(
        ", "
      )}]. Local filesystem fallback is disabled in production to protect against data loss in ephemeral containers.`
    )
  }

  // Fallback to secure local filesystem outside of public/ web root (local dev / test only)
  ensureLocalStorageDir()
  const localFilePath = path.join(LOCAL_STORAGE_DIR, `${documentId}.${ext}`)
  fs.writeFileSync(localFilePath, fileBuffer)

  return {
    storageProvider: "local",
    storageKey: localFilePath,
    fileSize: fileBuffer.length,
    checksum,
  }
}

/**
 * Retrieves the raw document buffer for an authenticated reviewer or admin.
 */
export async function readRecruitmentDocument(
  storageProvider: string,
  storageKey: string
): Promise<Buffer> {
  if (storageProvider === "r2") {
    const bucketName = getRecruitmentBucketName()
    const r2 = getR2Client()

    const response = await r2.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
      })
    )

    if (!response.Body) {
      throw new Error("Empty document stream from storage")
    }

    const stream = response.Body as Readable
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  // Local storage
  if (!fs.existsSync(storageKey)) {
    throw new Error("Document file not found on local disk")
  }
  return fs.readFileSync(storageKey)
}

/**
 * Deletes a recruitment document from storage (R2 or local).
 * Required for candidate privacy rights (e.g., Right to Erasure / GDPR).
 */
export async function deleteRecruitmentDocument(
  storageProvider: string,
  storageKey: string
): Promise<void> {
  if (storageProvider === "r2") {
    const bucketName = getRecruitmentBucketName()
    const r2 = getR2Client()
    await r2.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
      })
    )
    return
  }

  if (storageProvider === "local") {
    if (fs.existsSync(storageKey)) {
      fs.unlinkSync(storageKey)
    }
  }
}
