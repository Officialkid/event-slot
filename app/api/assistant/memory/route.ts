import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveMemoryPreference } from '@/lib/assistant-md4'

export async function GET() {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.id) {
    return NextResponse.json({ available: false, memoryEnabled: false })
  }

  const memoryEnabled = await resolveMemoryPreference(authSession.user.id)
  return NextResponse.json({ available: true, memoryEnabled })
}

export async function PUT(req: NextRequest) {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as { memoryEnabled?: unknown } | null
  const memoryEnabledInput = body?.memoryEnabled

  if (typeof memoryEnabledInput !== 'boolean') {
    return NextResponse.json({ error: 'memoryEnabled must be boolean' }, { status: 400 })
  }

  const memoryEnabled = await resolveMemoryPreference(authSession.user.id, memoryEnabledInput)
  return NextResponse.json({ available: true, memoryEnabled })
}
