import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])
// 2 MB original file limit (base64 is ~33% larger, so check estimated decoded size)
const MAX_DECODED_BYTES = 2 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { imageData } = body as { imageData?: string }

    if (!imageData || typeof imageData !== "string") {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 })
    }

    // Validate data URL: data:<mime>;base64,<data>
    const match = imageData.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/)
    if (!match) {
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 })
    }

    const mimeType = match[1]
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use JPEG, PNG, GIF, or WebP." },
        { status: 400 }
      )
    }

    // Estimate decoded byte size: base64 chars × 0.75
    const estimatedBytes = Math.floor(match[2].length * 0.75)
    if (estimatedBytes > MAX_DECODED_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Maximum size is 2 MB." },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: imageData },
    })

    return NextResponse.json({ success: true, image: imageData })
  } catch (err) {
    console.error("[profile/photo] POST error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
