import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("id")

  if (!userId) {
    return new NextResponse("Invalid unsubscribe link.", { status: 400 })
  }

  await prisma.user
    .update({
      where: { id: userId },
      data: { marketingConsent: false },
    })
    .catch(() => {})

  return new NextResponse(
    `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed - EventSlot</title>
</head>
<body style="margin:0;background:#0A0A0A;font-family:sans-serif;display:flex;
             align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;max-width:400px;padding:40px 20px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:24px;font-weight:bold;color:#fff;">Event</span>
      <span style="font-size:24px;font-weight:bold;color:#C8F55A;">Slot</span>
    </div>
    <h1 style="color:#fff;font-size:20px;margin-bottom:12px;">You've unsubscribed</h1>
    <p style="color:#A3A3A3;font-size:14px;line-height:1.6;margin-bottom:24px;">
      You will no longer receive marketing emails from EventSlot.
      You'll still receive important account and event notifications.
    </p>
    <a href="https://www.eventsslot.com"
       style="background:#C8F55A;color:#000;padding:12px 24px;text-decoration:none;
              border-radius:8px;font-weight:bold;font-size:14px;">
      Back to EventSlot
    </a>
    <p style="color:#525252;font-size:11px;margin-top:20px;">
      Changed your mind? Update your preferences in Account Settings.
    </p>
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
