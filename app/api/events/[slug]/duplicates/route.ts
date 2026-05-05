import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/isAdmin'
import { hasTeamEventAccess } from '@/lib/eventAccess'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, dashboardToken: true, organizerId: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const hasValidToken = !!(token && token === event.dashboardToken)
    const userId = session?.user?.id
    const isOwner = !!(userId && event.organizerId === userId)
    const isAdmin = isAdminEmail(session?.user?.email)
    const isTeamMember = !hasValidToken && !isOwner && !isAdmin && !!(userId && await hasTeamEventAccess({
      userId,
      organizerId: event.organizerId,
      eventId: event.id,
    }))

    if (!hasValidToken && !isOwner && !isAdmin && !isTeamMember) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        registrationNumber: true,
        status: true,
        waitlistPosition: true,
        submittedAt: true,
        isDuplicate: true,
        attendeeEmail: true,
        answers: true,
      },
    })

    type Answer = { questionId: string; value: string }

    // Build fingerprint: sort answers by questionId, trim+lowercase values, join with |||
    const fingerprint = (answers: Answer[]) =>
      [...answers]
        .sort((a, b) => a.questionId.localeCompare(b.questionId))
        .map(a => a.value.trim().toLowerCase())
        .join('|||')

    const grouped = new Map<string, typeof registrations>()
    for (const reg of registrations) {
      const answers = (reg.answers as Answer[]) ?? []
      const fp = fingerprint(answers)
      if (!grouped.has(fp)) grouped.set(fp, [])
      grouped.get(fp)!.push(reg)
    }

    // Only return groups with 2+ registrations (actual duplicates)
    // Normalize answers to plain objects for the response
    const groups = Array.from(grouped.values())
      .filter(g => g.length >= 2)
      .map(g => g.map(r => ({ ...r, answers: (r.answers as Answer[]) ?? [] })))

    return NextResponse.json({ groups })
  } catch (err) {
    console.error('[duplicates]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
