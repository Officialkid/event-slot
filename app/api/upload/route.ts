import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { validateR2Env } from '@/lib/validateEnv'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 15 * 1024 * 1024 // 15 MB

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucketName = process.env.R2_BUCKET_NAME?.trim()
  const publicUrl = process.env.R2_PUBLIC_URL?.trim()

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    throw new Error('R2 environment variables not configured')
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl }
}

function getR2Client(config: { accountId: string; accessKeyId: string; secretAccessKey: string }) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })
}

export async function POST(req: NextRequest) {
  const missing = validateR2Env()
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Image upload is not configured. Contact support.' },
      { status: 503 }
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum is 15 MB.' }, { status: 400 })
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const key = `events/${uuidv4()}.${ext}`

  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Unable to read uploaded file' }, { status: 400 })
  }

  let config: { accountId: string; accessKeyId: string; secretAccessKey: string; bucketName: string; publicUrl: string }

  try {
    config = getR2Config()
    const r2 = getR2Client(config)
    await r2.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    console.error('[upload] R2 upload failed:', message)
    return NextResponse.json(
      { error: 'Image upload service is temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    )
  }

  let normalizedPublicUrl: string
  try {
    normalizedPublicUrl = new URL(config.publicUrl).toString().replace(/\/+$/, '')
  } catch {
    return NextResponse.json(
      { error: 'Image upload is configured incorrectly. Contact support.' },
      { status: 503 }
    )
  }

  return NextResponse.json({ url: `${normalizedPublicUrl}/${key}` })
}
