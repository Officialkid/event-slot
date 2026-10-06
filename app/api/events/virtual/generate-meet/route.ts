import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateGoogleMeetConference, isCalendarConnected } from '@/lib/googleCalendar'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const isConnected = await isCalendarConnected(session.user.id)
    if (!isConnected) {
      return NextResponse.json({
        success: false,
        error: 'Google Calendar is not connected to your EventSlot account. Please connect it in your profile settings or enter a manual meeting link.',
      }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { title, description, startDate, durationMins } = body

    const eventDate = startDate ? new Date(startDate) : new Date(Date.now() + 24 * 60 * 60 * 1000)
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid event start date.' }, { status: 400 })
    }

    const result = await generateGoogleMeetConference({
      userId: session.user.id,
      title: (title || 'EventSlot Virtual Event').trim(),
      description: description?.trim(),
      startDate: eventDate,
      durationMins: Number(durationMins) > 0 ? Number(durationMins) : 60,
    })

    if (!result.success || !result.meetingUrl) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to generate Google Meet room.',
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      meetingUrl: result.meetingUrl,
      googleEventId: result.googleEventId,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
