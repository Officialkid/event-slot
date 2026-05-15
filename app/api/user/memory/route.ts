import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  isMemoryEnabled,
  setMemoryEnabled,
  clearMemory,
} from "@/lib/assistant-memory"
import { prisma } from "@/lib/prisma"

// GET - get memory status and summary
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const enabled = await isMemoryEnabled(session.user.id)
  const memory = await prisma.userMemory.findUnique({
    where: { userId: session.user.id },
    select: { summary: true, sessionCount: true, lastUpdated: true },
  })

  return NextResponse.json({
    memoryEnabled: enabled,
    hasSavedMemory: !!memory,
    sessionCount: memory?.sessionCount ?? 0,
    lastUpdated: memory?.lastUpdated ?? null,
    summary: enabled ? (memory?.summary ?? null) : null,
  })
}

// PATCH - toggle memory on/off
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null
  const enabled = Boolean(body?.enabled)

  await setMemoryEnabled(session.user.id, enabled)

  return NextResponse.json({
    memoryEnabled: enabled,
    message: enabled
      ? "Memory enabled. The assistant will remember your conversations."
      : "Memory disabled and cleared. The assistant will start fresh each session.",
  })
}

// DELETE - clear memory without disabling
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await clearMemory(session.user.id)

  return NextResponse.json({
    message: "Your conversation memory has been cleared.",
  })
}
