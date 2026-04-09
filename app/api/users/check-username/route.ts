import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const RESERVED = [
  "dashboard", "create", "signin", "signup", "pricing", "admin",
  "setup-username", "api", "verify-email", "billing", "settings",
  "my-events", "terms", "privacy", "feedback", "registration",
  "team", "clear-sw", "fonts",
]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get("username")?.toLowerCase().trim()

    if (!username) {
      return NextResponse.json({ available: false, error: "Missing username" }, { status: 400 })
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({
        available: false,
        error: "Username must be 3–20 characters",
      })
    }

    if (!/^[a-z0-9-]+$/.test(username)) {
      return NextResponse.json({
        available: false,
        error: "Only letters, numbers, and hyphens allowed",
      })
    }

    if (RESERVED.includes(username)) {
      return NextResponse.json({ available: false, error: "Username is reserved" })
    }

    const existing = await prisma.user.findUnique({ where: { username } })
    return NextResponse.json({ available: !existing })
  } catch (err) {
    console.error("[users/check-username] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
