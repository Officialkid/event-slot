import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("id")

  if (!userId) {
    return new NextResponse("Invalid re-subscribe link.", { status: 400 })
  }

  await prisma.user
    .update({
      where: { id: userId },
      data: { marketingConsent: true },
    })
    .catch(() => {})

  return new NextResponse(
    `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Re-subscribed - EventSlot</title>
</head>
<body style="margin:0;background:#0A0A0A;font-family:sans-serif;display:flex;
             align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;max-width:420px;padding:40px 20px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:24px;font-weight:bold;color:#fff;">Event</span>
      <span style="font-size:24px;font-weight:bold;color:#C8F55A;">Slot</span>
    </div>
    <div style="font-size:36px;margin-bottom:12px;">🎉</div>
    <h1 style="color:#fff;font-size:20px;margin-bottom:12px;">You're re-subscribed!</h1>
    <p style="color:#A3A3A3;font-size:14px;line-height:1.6;margin-bottom:24px;">
      Welcome back! You will now receive EventSlot updates, weekly digests, and feature spotlights.
    </p>
    <a href="https://www.eventsslot.com"
       style="display:inline-block;background:#C8F55A;color:#0A0A0A;padding:12px 24px;text-decoration:none;
              border-radius:8px;font-weight:bold;font-size:14px;">
      Continue to EventSlot
    </a>
  </div>
</body>
</html>
    `,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }
  )
}
