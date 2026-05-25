import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendBulkEmails } from '@/lib/emailCampaigns'

// POST /api/events/[slug]/campaigns/send — create and fire a bulk email campaign
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { subject?: string; body?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { subject, body: emailBody, type } = body

  if (!subject?.trim() || !emailBody?.trim()) {
    return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      organizerId: true,
      questions: true,
      registrations: {
        where: { status: 'confirmed' },
        select: {
          attendeeEmail: true,
          answers: true,
        },
      },
    },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Only the event owner can send bulk email (not token-based access — safety measure)
  if (event.organizerId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const confirmedCount = await prisma.registration.count({
    where: { eventId: event.id, status: 'confirmed' },
  })

  if (confirmedCount === 0) {
    return NextResponse.json(
      { error: 'This event has no confirmed registrations. No emails were sent.' },
      { status: 400 }
    )
  }

  // Extract recipients — skip any registration without an email
  const questions = Array.isArray(event.questions)
    ? (event.questions as Array<{ id: string; label: string; type: string }>)
    : []
  const nameQuestion = questions.find(
    (q) => q.type === 'text' && q.label.toLowerCase().includes('name')
  )

  const recipients = event.registrations
    .filter((r) => !!r.attendeeEmail)
    .map((r) => {
      const answers = Array.isArray(r.answers)
        ? (r.answers as Array<{ questionId: string; value: string }>)
        : []
      const name = nameQuestion
        ? (answers.find((a) => a.questionId === nameQuestion.id)?.value?.trim() ?? '')
        : ''
      return { email: r.attendeeEmail as string, name }
    })

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: 'No confirmed attendees with email addresses found for this event.' },
      { status: 422 }
    )
  }

  const validType = ['REMINDER', 'UPDATE', 'THANK_YOU', 'CUSTOM'].includes(type ?? '')
    ? (type as 'REMINDER' | 'UPDATE' | 'THANK_YOU' | 'CUSTOM')
    : 'CUSTOM'

  const campaign = await prisma.emailCampaign.create({
    data: {
      eventId: event.id,
      organiserId: session.user.id,
      subject: subject.trim(),
      body: emailBody.trim(),
      type: validType,
      status: 'SENDING',
    },
  })

  // Fire-and-forget — do not await so we return immediately
  sendBulkEmails(campaign.id, recipients, subject.trim(), emailBody.trim(), event.title).catch(
    console.error
  )

  return NextResponse.json({ campaignId: campaign.id, recipientCount: recipients.length })
}
