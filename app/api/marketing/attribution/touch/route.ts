import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      action = "VISIT",
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      utmId,
      landingPath = "/",
      userId,
      trackingLinkId,
      metadata,
    } = body

    // Read visitor ID from cookie or fallback
    const visitorId = req.cookies.get("es_mkt_vid")?.value || uuidv4()
    const referrer = req.headers.get("referer") || req.headers.get("referrer") || null

    // Determine touch type: if action is SIGNUP/EVENT_CREATED/EVENT_PUBLISHED/TICKET_PURCHASE => CONVERSION_TOUCH
    const isConversion = ["SIGNUP", "EVENT_CREATED", "EVENT_PUBLISHED", "TICKET_PURCHASE"].includes(action)
    const touchType = isConversion ? "CONVERSION_TOUCH" : "SESSION_TOUCH"

    const touch = await prisma.marketingAttributionTouch.create({
      data: {
        visitorId,
        userId: userId || null,
        touchType,
        utmSource: utmSource ? String(utmSource).toLowerCase() : null,
        utmMedium: utmMedium ? String(utmMedium).toLowerCase() : null,
        utmCampaign: utmCampaign ? String(utmCampaign).toLowerCase() : null,
        utmContent: utmContent ? String(utmContent) : null,
        utmTerm: utmTerm ? String(utmTerm) : null,
        utmId: utmId ? String(utmId) : null,
        referrer,
        landingPath: String(landingPath),
        trackingLinkId: trackingLinkId || null,
        conversionAction: String(action),
        metadata: metadata || null,
      },
    })

    const res = NextResponse.json({ success: true, touchId: touch.id })

    // Ensure visitor ID cookie is set
    if (!req.cookies.get("es_mkt_vid")) {
      res.cookies.set("es_mkt_vid", visitorId, {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
      })
    }

    return res
  } catch (error) {
    console.error("[Attribution touch error]", error)
    return NextResponse.json({ error: "Failed to record touch" }, { status: 500 })
  }
}
