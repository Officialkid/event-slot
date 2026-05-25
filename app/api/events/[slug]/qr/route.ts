import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateEventQRCodeBuffer } from "@/lib/qrcode"
import { APP_URL } from "@/lib/config"

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params

  try {
    const { slug } = params

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const registrationUrl = `${APP_URL}/${slug}`
    const buffer = await generateEventQRCodeBuffer(registrationUrl)

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="qr-${slug}.png"`,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 })
  }
}
