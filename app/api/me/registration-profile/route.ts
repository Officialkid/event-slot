import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isEphemeralQuestion } from '@/lib/attendeeProfileStore'

export interface AttendeeRegistrationProfile {
  name?: string
  email?: string
  phone?: string
  location?: string
  organization?: string
  jobTitle?: string
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // 1. Fetch authenticated user account identity (trusted server-side claims)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        countryName: true,
        countryCode: true,
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const profile: AttendeeRegistrationProfile = {
      name: user.name ?? undefined,
      email: user.email ?? undefined,
      location: user.countryName ?? user.countryCode ?? undefined,
    }

    // 2. If the user has a verified email, look up their most recent completed registration
    if (user.email) {
      const priorRegistration = await prisma.registration.findFirst({
        where: {
          attendeeEmail: { equals: user.email, mode: 'insensitive' },
          status: { in: ['CONFIRMED', 'ATTENDED', 'REGISTERED', 'WAITLIST'] },
        },
        orderBy: { submittedAt: 'desc' },
        select: {
          attendeeEmail: true,
          answers: true,
          submittedAt: true,
        },
      })

      if (priorRegistration?.answers) {
        let answerItems: Array<{ questionId?: string; label?: string; value?: string }> = []
        if (Array.isArray(priorRegistration.answers)) {
          answerItems = priorRegistration.answers as any[]
        } else if (typeof priorRegistration.answers === 'object') {
          answerItems = Object.entries(priorRegistration.answers).map(([key, val]) => ({
            questionId: key,
            value: typeof val === 'string' ? val : String(val),
          }))
        }

        for (const item of answerItems) {
          const val = typeof item.value === 'string' ? item.value.trim() : ''
          if (!val) continue
          const key = (item.questionId || item.label || '').toLowerCase().trim()

          // Strict privacy guard: never copy ephemeral or event-specific answers
          if (isEphemeralQuestion(key, item.questionId)) continue

          if (!profile.name && (key.includes('name') || key === 'fullname' || key === 'full_name')) {
            profile.name = val
          } else if (!profile.phone && (key.includes('phone') || key.includes('mobile') || key.includes('whatsapp') || key.includes('contact'))) {
            profile.phone = val
          } else if (!profile.location && (key.includes('city') || key.includes('county') || key.includes('residence') || key.includes('location'))) {
            profile.location = val
          } else if (!profile.organization && (key.includes('company') || key.includes('organization') || key.includes('organisation') || key.includes('institution'))) {
            profile.organization = val
          } else if (!profile.jobTitle && (key.includes('role') || key.includes('title') || key.includes('designation') || key.includes('job'))) {
            profile.jobTitle = val
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      profile,
      source: 'verified_account',
    })
  } catch (error) {
    console.error('[RegistrationProfile GET Error]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
