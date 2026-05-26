import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, organizerId: true, dashboardToken: true, questions: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))
    const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

    if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: { id: true, answers: true, submittedAt: true, status: true },
    })

    // Extract name from answers JSON using the event's questions
    const questions = Array.isArray(event.questions) ? event.questions as Array<{ id: string; label: string }> : []
    const nameQuestion = questions.find(q =>
      /name/i.test(q.label)
    )

    const recent = registrations.map((reg) => {
      const answers = Array.isArray(reg.answers)
        ? (reg.answers as Array<{ questionId: string; value: string }>)
        : []
      let name = 'Attendee'
      if (nameQuestion) {
        const ans = answers.find(a => a.questionId === nameQuestion.id)
        if (ans?.value) name = ans.value
      } else if (answers.length > 0 && answers[0]?.value) {
        name = answers[0].value
      }
      return {
        id: reg.id,
        name,
        submittedAt: reg.submittedAt.toISOString(),
        status: reg.status,
      }
    })

    return NextResponse.json({ recent })
  } catch (err) {
    console.error('Recent registrations error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
