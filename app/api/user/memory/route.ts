import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  isMemoryEnabled,
  setMemoryEnabled,
  clearMemory,
  sanitizeMemoryText,
} from "@/lib/assistant-memory"
import { prisma } from "@/lib/prisma"

// GET - get memory status and summary
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const enabled = await isMemoryEnabled(session.user.id)
    const memory = enabled
      ? await prisma.userMemory.findUnique({
          where: { userId: session.user.id },
          select: { summary: true, sessionCount: true, lastUpdated: true },
        })
      : null

    return NextResponse.json({
      available: true,
      memoryEnabled: enabled,
      hasSavedMemory: Boolean(enabled && memory),
      sessionCount: enabled ? (memory?.sessionCount ?? 0) : 0,
      lastUpdated: enabled ? (memory?.lastUpdated ?? null) : null,
      summary: enabled && memory?.summary ? sanitizeMemoryText(memory.summary) : null,
    })
  } catch (error) {
    console.error("[user/memory] GET error:", error)
    return NextResponse.json(
      { error: "Unable to load memory status" },
      { status: 500 }
    )
  }
}

// PATCH - toggle memory on/off
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as {
      enabled?: unknown
      memoryEnabled?: unknown
    } | null

    const rawFlag =
      typeof body?.enabled === "boolean"
        ? body.enabled
        : typeof body?.memoryEnabled === "boolean"
          ? body.memoryEnabled
          : undefined

    if (typeof rawFlag !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be boolean" },
        { status: 400 }
      )
    }

    const enabled = await setMemoryEnabled(session.user.id, rawFlag)

    return NextResponse.json({
      available: true,
      memoryEnabled: enabled,
      purged: !enabled,
      message: enabled
        ? "Memory enabled. The assistant will remember your conversations."
        : "Memory disabled and cleared. The assistant will start fresh each session.",
    })
  } catch (error) {
    console.error("[user/memory] PATCH error:", error)
    return NextResponse.json(
      { error: "Unable to update memory preference" },
      { status: 500 }
    )
  }
}

// DELETE - clear memory without disabling
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await clearMemory(session.user.id)

    return NextResponse.json({
      cleared: true,
      message: "Your conversation memory has been cleared.",
    })
  } catch (error) {
    console.error("[user/memory] DELETE error:", error)
    return NextResponse.json(
      { error: "Unable to clear memory" },
      { status: 500 }
    )
  }
}
