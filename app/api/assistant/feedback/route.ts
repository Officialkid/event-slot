import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const body = await req.json().catch(() => null)

  const rating = Number(body?.rating)
  const comment = typeof body?.comment === "string" ? body.comment : ""

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 })
  }

  if (comment && comment.length > 200) {
    return NextResponse.json({ error: "Comment max 200 characters" }, { status: 400 })
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()
  const identifier = session?.user?.id ?? createHash("sha256").update(ip).digest("hex")

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const alreadyRated = await prisma.assistantFeedback.findFirst({
    where: { identifier, createdAt: { gte: today } },
  })

  if (alreadyRated) {
    return NextResponse.json({ message: "Already rated today - thank you!" })
  }

  await prisma.assistantFeedback.create({
    data: { identifier, rating, comment: comment.trim() || null },
  })

  return NextResponse.json({ success: true, message: "Thank you for your feedback!" })
}