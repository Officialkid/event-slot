import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const RESERVED = [
  "dashboard", "create", "signin", "signup", "pricing", "admin",
  "setup-username", "api", "verify-email", "billing", "settings",
  "my-events", "terms", "privacy", "feedback", "registration",
  "team", "clear-sw", "fonts",
]

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const username = (body.username as string)?.toLowerCase().trim()

    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 })
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: "Username must be 3–20 characters" }, { status: 400 })
    }

    if (!/^[a-z0-9-]+$/.test(username)) {
      return NextResponse.json(
        { error: "Only letters, numbers, and hyphens allowed" },
        { status: 400 }
      )
    }

    if (RESERVED.includes(username)) {
      return NextResponse.json({ error: "Username is reserved" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { username },
    })

    return NextResponse.json({ success: true, username })
  } catch (err) {
    console.error("[users/username] PATCH error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
