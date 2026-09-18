import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  try {
    const link = await prisma.marketingTrackingLink.findUnique({
      where: { code },
    })

    if (!link) {
      // Fallback redirect to homepage if tracking code not found
      return NextResponse.redirect(new URL("/", req.url))
    }

    // Increment click counter asynchronously
    await prisma.marketingTrackingLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    })

    // Resolve or generate visitor ID from cookies
    const existingVisitorId = req.cookies.get("es_mkt_vid")?.value
    const visitorId = existingVisitorId || uuidv4()
    const referrer = req.headers.get("referer") || req.headers.get("referrer") || null

    // Record attribution touch in database
    await prisma.marketingAttributionTouch.create({
      data: {
        visitorId,
        touchType: "SESSION_TOUCH",
        utmSource: link.utmSource,
        utmMedium: link.utmMedium,
        utmCampaign: link.utmCampaign,
        utmContent: link.utmContent,
        utmTerm: link.utmTerm,
        utmId: link.utmId,
        referrer,
        landingPath: link.destinationUrl,
        trackingLinkId: link.id,
        conversionAction: "CLICK",
      },
    })

    // Prepare response with 302 redirect
    const res = NextResponse.redirect(link.fullUrl, 302)

    // Set 1-year first-party tracking cookie
    res.cookies.set("es_mkt_vid", visitorId, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    })

    // Store first-touch attribution payload if not already present
    if (!req.cookies.get("es_mkt_first_touch")) {
      const firstTouchData = JSON.stringify({
        utmSource: link.utmSource,
        utmMedium: link.utmMedium,
        utmCampaign: link.utmCampaign,
        utmContent: link.utmContent,
        trackingLinkId: link.id,
        timestamp: new Date().toISOString(),
      })
      res.cookies.set("es_mkt_first_touch", encodeURIComponent(firstTouchData), {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
        httpOnly: false,
      })
    }

    // Store last-touch attribution payload
    const lastTouchData = JSON.stringify({
      utmSource: link.utmSource,
      utmMedium: link.utmMedium,
      utmCampaign: link.utmCampaign,
      utmContent: link.utmContent,
      trackingLinkId: link.id,
      timestamp: new Date().toISOString(),
    })
    res.cookies.set("es_mkt_last_touch", encodeURIComponent(lastTouchData), {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    })

    return res
  } catch (error) {
    console.error("[Tracking redirect error]", error)
    return NextResponse.redirect(new URL("/", req.url))
  }
}
