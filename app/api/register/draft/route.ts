import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export async function GET(req: NextRequest) {
  try {
    const eventSlug = req.nextUrl.searchParams.get('eventSlug')?.trim() ?? ''
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''

    if (!eventSlug || !email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'eventSlug and a valid email are required.' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug: eventSlug },
      select: { id: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    const draft = await prisma.registrationDraft.findUnique({
      where: {
        eventId_email: {
          eventId: event.id,
          email,
        },
      },
    })

    return NextResponse.json({ success: true, draft })
  } catch (error) {
    console.error('[register/draft] GET error:', error)
    return NextResponse.json({ error: 'Failed to load draft.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      eventSlug,
      email,
      answers,
      attendeeCount,
      baseEmails,
      consentDataProcessing,
      consentTransactional,
      consentMarketing,
      sendResponseCopy,
    } = body as {
      eventSlug?: string
      email?: string
      answers?: unknown
      attendeeCount?: number
      baseEmails?: unknown
      consentDataProcessing?: boolean
      consentTransactional?: boolean
      consentMarketing?: boolean
      sendResponseCopy?: boolean
    }

    const normalizedSlug = eventSlug?.trim() ?? ''
    const normalizedEmail = email?.trim().toLowerCase() ?? ''
    if (!normalizedSlug || !normalizedEmail || !isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'eventSlug and a valid email are required.' }, { status: 400 })
    }

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: 'answers must be an array.' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    const draft = await prisma.registrationDraft.upsert({
      where: {
        eventId_email: {
          eventId: event.id,
          email: normalizedEmail,
        },
      },
      update: {
        answers,
        attendeeCount: Math.max(1, Number(attendeeCount) || 1),
        baseEmails: Array.isArray(baseEmails) ? baseEmails : [],
        consentDataProcessing: Boolean(consentDataProcessing),
        consentTransactional: Boolean(consentTransactional),
        consentMarketing: Boolean(consentMarketing),
        sendResponseCopy: Boolean(sendResponseCopy),
      },
      create: {
        eventId: event.id,
        email: normalizedEmail,
        answers,
        attendeeCount: Math.max(1, Number(attendeeCount) || 1),
        baseEmails: Array.isArray(baseEmails) ? baseEmails : [],
        consentDataProcessing: Boolean(consentDataProcessing),
        consentTransactional: Boolean(consentTransactional),
        consentMarketing: Boolean(consentMarketing),
        sendResponseCopy: Boolean(sendResponseCopy),
      },
    })

    return NextResponse.json({ success: true, draft })
  } catch (error) {
    console.error('[register/draft] POST error:', error)
    return NextResponse.json({ error: 'Failed to save draft.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const eventSlug = req.nextUrl.searchParams.get('eventSlug')?.trim() ?? ''
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''

    if (!eventSlug || !email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'eventSlug and a valid email are required.' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug: eventSlug },
      select: { id: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    await prisma.registrationDraft.deleteMany({
      where: {
        eventId: event.id,
        email,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[register/draft] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to clear draft.' }, { status: 500 })
  }
}
