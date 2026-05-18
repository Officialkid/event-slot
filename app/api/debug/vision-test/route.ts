import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { groq, VISION_MODEL } from "@/lib/groq"
import { authOptions } from "@/lib/auth"
import { isAdminEmail } from "@/lib/isAdmin"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    const session = await getServerSession(authOptions)
    const allowed = Boolean(
      session?.user?.role === "SUPER_ADMIN" ||
      session?.user?.isAdmin ||
      isAdminEmail(session?.user?.email)
    )

    if (!allowed) {
      return NextResponse.json(
        { error: "Debug endpoint disabled in production" },
        { status: 403 }
      )
    }
  }

  try {
    const testImagePath = path.join(process.cwd(), "public", "icons", "icon-192x192.png")
    const testImageBase64 = (await readFile(testImagePath)).toString("base64")

    const completion = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${testImageBase64}` },
            },
            {
              type: "text",
              text: "What do you see in this image? Reply in one sentence.",
            },
          ],
        },
      ],
      max_tokens: 100,
    })

    return NextResponse.json({
      success: true,
      model: VISION_MODEL,
      reply: completion.choices[0]?.message?.content,
    })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number; code?: string | number }
    return NextResponse.json({
      success: false,
      error: err.message ?? "Unknown error",
      code: err.status ?? err.code,
    })
  }
}
