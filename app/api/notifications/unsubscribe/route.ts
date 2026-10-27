import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyFollowerUnsubscribeToken } from '@/lib/followerSecurity'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return new Response('Invalid or missing unsubscribe token.', { status: 400 })
    }

    const payload = verifyFollowerUnsubscribeToken(token)
    if (!payload) {
      return new Response('Invalid or expired unsubscribe link.', { status: 403 })
    }

    const { followerId, organiserId } = payload

    const [updated, organiser] = await Promise.all([
      prisma.organiserFollower.updateMany({
        where: { followerId, organiserId },
        data: { notifyNewEvents: false },
      }),
      prisma.user.findUnique({
        where: { id: organiserId },
        select: { name: true, username: true },
      }),
    ])

    const organiserDisplayName = organiser?.name || organiser?.username || 'this organiser'

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed - EventSlot</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0A0A0A;
      color: #F5F5F5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
    }
    .card {
      background: #141414;
      border: 1px solid #282828;
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      padding: 2.25rem;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.35rem;
      margin: 0 0 0.5rem;
      color: #FFFFFF;
    }
    p {
      font-size: 0.9rem;
      color: #A0A0A0;
      line-height: 1.6;
      margin: 0 0 1.5rem;
    }
    a.btn {
      display: inline-block;
      background: #C8F55A;
      color: #0A0A0A;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.88rem;
      padding: 0.75rem 1.5rem;
      border-radius: 100px;
      transition: opacity 0.15s;
    }
    a.btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔕</div>
    <h1>Email Notifications Muted</h1>
    <p>
      You have successfully unsubscribed from new event announcements by <strong>${organiserDisplayName}</strong>.
      You are still following them in your EventSlot account and can re-enable alerts anytime from your dashboard.
    </p>
    <a href="/dashboard" class="btn">Go to Dashboard</a>
  </div>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('[Unsubscribe Error]', error)
    return new Response('Unable to process unsubscribe request.', { status: 500 })
  }
}

// Support RFC 8058 POST One-Click Unsubscribe
export async function POST(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 })
    }

    const payload = verifyFollowerUnsubscribeToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 403 })
    }

    await prisma.organiserFollower.updateMany({
      where: { followerId: payload.followerId, organiserId: payload.organiserId },
      data: { notifyNewEvents: false },
    })

    return NextResponse.json({ success: true, message: 'Unsubscribed successfully' })
  } catch (error) {
    console.error('[Unsubscribe POST Error]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
