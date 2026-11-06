import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/isAdmin'
import { createEventSchema } from '@/lib/schemas/event.schema'
import { detectCountry } from '@/lib/geoip'
import { createEventDomainService } from '@/lib/events/event-creation-service'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = createEventSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issues = parsed.error.issues
      const firstIssue = issues[0]
      const fieldPath = firstIssue?.path.join('.') || ''
      const lastSegment = firstIssue?.path[firstIssue.path.length - 1] ?? 'field'
      let humanMessage = firstIssue?.message || 'Invalid form input'

      if (humanMessage === 'Invalid input' || humanMessage === 'Required' || humanMessage.startsWith('Expected ')) {
        humanMessage = `Please check "${String(lastSegment)}": ${firstIssue?.message}`
      }

      console.error('[Event Creation Validation Error]', {
        field: fieldPath,
        message: humanMessage,
        issues,
      })
      return NextResponse.json(
        {
          success: false,
          error: humanMessage,
          field: fieldPath,
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const pregeneratedGoogleEventId =
      typeof rawBody === 'object' && rawBody !== null && 'googleEventId' in rawBody
        ? String((rawBody as { googleEventId?: unknown }).googleEventId || '').trim() || null
        : null

    const eventCountryCode = await detectCountry(req).catch(() => null)

    const result = await createEventDomainService({
      actor: {
        userId: session.user.id,
        userEmail: session.user.email,
        isAdmin: Boolean(session.user.email && isAdminEmail(session.user.email)),
      },
      input: parsed.data,
      googleEventId: pregeneratedGoogleEventId,
      countryCode: eventCountryCode,
      sideEffects: true,
    })

    if (!result.success) {
      const { status, success, ...rest } = result
      return NextResponse.json(
        {
          success: false,
          ...rest,
        },
        { status }
      )
    }

    return NextResponse.json({ success: true, event: result.event }, { status: 201 })
  } catch (err) {
    console.error('[events/POST] Unexpected error creating event:', err)
    const errorMessage = err instanceof Error ? err.message : 'Failed to create event. Please try again.'
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
