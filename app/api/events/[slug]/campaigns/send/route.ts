import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendBulkEmails } from '@/lib/emailCampaigns'
import { hasOrganiserAccess } from '@/lib/adminMode'

// POST /api/events/[slug]/campaigns/send — create (or retry) and execute a bulk email campaign
export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    campaignId?: string
    subject?: string
    body?: string
    type?: string
    segment?: string
    scheduledFor?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { campaignId, subject, body: emailBody, type, segment = 'ALL' } = body

  // Build registration filter according to selected segment
  let registrationWhere: Record<string, unknown> = { status: 'confirmed' }
  if (segment === 'CHECKED_IN') {
    registrationWhere = { status: 'confirmed', ticket: { is: { scannedAt: { not: null } } } }
  } else if (segment === 'NOT_CHECKED_IN') {
    registrationWhere = { status: 'confirmed', ticket: { is: { scannedAt: null } } }
  } else if (segment === 'WAITLIST') {
    registrationWhere = { status: 'waitlist' }
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      organizerId: true,
      questions: true,
      registrations: {
        where: registrationWhere,
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

  // Only the event owner or authorized admin can send bulk email
  if (event.organizerId !== session.user.id && !(await hasOrganiserAccess(session, event.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let resolvedSubject = subject?.trim() ?? ''
  let resolvedBody = emailBody?.trim() ?? ''
  let resolvedType: 'REMINDER' | 'UPDATE' | 'THANK_YOU' | 'CUSTOM' = [
    'REMINDER',
    'UPDATE',
    'THANK_YOU',
    'CUSTOM',
  ].includes(type ?? '')
    ? (type as 'REMINDER' | 'UPDATE' | 'THANK_YOU' | 'CUSTOM')
    : 'CUSTOM'

  let targetCampaignId: string | null = null

  if (campaignId) {
    const existing = await prisma.emailCampaign.findFirst({
      where: { id: campaignId, eventId: event.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    targetCampaignId = existing.id
    if (!resolvedSubject) resolvedSubject = existing.subject
    if (!resolvedBody) resolvedBody = existing.body
    resolvedType = existing.type
  }

  if (!resolvedSubject || !resolvedBody) {
    return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })
  }

  const confirmedCount = await prisma.registration.count({
    where: { eventId: event.id, status: 'confirmed' },
  })

  if (confirmedCount === 0 && segment !== 'WAITLIST') {
    return NextResponse.json(
      { error: 'This event has no confirmed registrations. No emails were sent.' },
      { status: 400 }
    )
  }

  // Extract recipients and deduplicate by lowercase email address
  const questions = Array.isArray(event.questions)
    ? (event.questions as Array<{ id: string; label: string; type: string }>)
    : []
  const nameQuestion = questions.find(
    (q) => q.type === 'text' && q.label.toLowerCase().includes('name')
  )

  const seenEmails = new Set<string>()
  const recipients: { email: string; name: string }[] = []

  for (const r of event.registrations) {
    const rawEmail = r.attendeeEmail?.trim()
    if (!rawEmail) continue
    const normalizedEmail = rawEmail.toLowerCase()
    if (seenEmails.has(normalizedEmail)) continue
    seenEmails.add(normalizedEmail)

    const answers = Array.isArray(r.answers)
      ? (r.answers as Array<{ questionId: string; value: string }>)
      : []
    const name = nameQuestion
      ? (answers.find((a) => a.questionId === nameQuestion.id)?.value?.trim() ?? '')
      : ''
    recipients.push({ email: rawEmail, name })
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: 'No confirmed attendees with email addresses found for this event.' },
      { status: 422 }
    )
  }

  const campaign = targetCampaignId
    ? await prisma.emailCampaign.update({
        where: { id: targetCampaignId },
        data: {
          subject: resolvedSubject,
          body: resolvedBody,
          type: resolvedType,
          status: 'SENDING',
          failureReason: null,
          sentAt: null,
          createdAt: new Date(),
        },
      })
    : await prisma.emailCampaign.create({
        data: {
          eventId: event.id,
          organiserId: session.user.id,
          subject: resolvedSubject,
          body: resolvedBody,
          type: resolvedType,
          status: 'SENDING',
        },
      })

  // IMPORTANT: Await sendBulkEmails inside the request lifecycle so Cloud Run
  // does not throttle/freeze CPU after returning the HTTP response.
  const sendResult = await sendBulkEmails(
    campaign.id,
    recipients,
    resolvedSubject,
    resolvedBody,
    event.title
  )

  return NextResponse.json({
    campaignId: campaign.id,
    recipientCount: sendResult.sentCount || recipients.length,
    status: sendResult.status,
    failedCount: sendResult.failedCount,
    failureReason: sendResult.failureReason,
  })
}
