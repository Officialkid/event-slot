import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PATCH /api/assistant/session/[id] — rename a session
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { label } = await req.json()

  if (!label || typeof label !== 'string') {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }

  // Verify ownership
  const session = await prisma.assistantSession.findUnique({ where: { id }, select: { userId: true } })
  if (!session || session.userId !== authSession.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.assistantSession.update({
    where: { id },
    data: { label: label.trim().slice(0, 80) },
  })

  return NextResponse.json({ ok: true })
}

// DELETE /api/assistant/session/[id] — delete a session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership
  const session = await prisma.assistantSession.findUnique({ where: { id }, select: { userId: true } })
  if (!session || session.userId !== authSession.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.assistantSession.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
