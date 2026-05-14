import { NextRequest, NextResponse } from "next/server"

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_MB = 4

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File)

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Please upload JPEG, PNG, WebP, or GIF.` },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_SIZE_MB}MB per image.` },
        { status: 413 }
      )
    }
  }

  return NextResponse.json({ valid: true, count: files.length })
}
