import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  clearMemory,
  isMemoryEnabled,
  setMemoryEnabled,
} from '@/lib/assistant-memory'

export async function GET() {
  try {
    const authSession = await getServerSession(authOptions)
    if (!authSession?.user?.id) {
      return NextResponse.json({ available: false, memoryEnabled: false })
    }

    const memoryEnabled = await isMemoryEnabled(authSession.user.id)
    return NextResponse.json({ available: true, memoryEnabled })
  } catch (error) {
    console.error('[assistant/memory] GET error:', error)
    return NextResponse.json(
      { error: 'Unable to load memory preference' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authSession = await getServerSession(authOptions)
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as {
      memoryEnabled?: unknown
      enabled?: unknown
    } | null

    const rawFlag =
      typeof body?.memoryEnabled === 'boolean'
        ? body.memoryEnabled
        : typeof body?.enabled === 'boolean'
          ? body.enabled
          : undefined

    if (typeof rawFlag !== 'boolean') {
      return NextResponse.json({ error: 'memoryEnabled must be boolean' }, { status: 400 })
    }

    const memoryEnabled = await setMemoryEnabled(authSession.user.id, rawFlag)
    return NextResponse.json({
      available: true,
      memoryEnabled,
      purged: !memoryEnabled,
    })
  } catch (error) {
    console.error('[assistant/memory] PUT error:', error)
    return NextResponse.json(
      { error: 'Unable to update memory preference' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const authSession = await getServerSession(authOptions)
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await clearMemory(authSession.user.id)
    return NextResponse.json({
      cleared: true,
      message: 'Your conversation memory has been cleared.',
    })
  } catch (error) {
    console.error('[assistant/memory] DELETE error:', error)
    return NextResponse.json(
      { error: 'Unable to clear memory' },
      { status: 500 }
    )
  }
}
