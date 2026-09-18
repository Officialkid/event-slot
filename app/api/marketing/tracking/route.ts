import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import { APP_URL } from "@/lib/config"

function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32)
}

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId")

  try {
    const where: any = {}
    if (campaignId) where.campaignId = campaignId

    const links = await prisma.marketingTrackingLink.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        campaign: {
          select: {
            id: true,
            campaignId: true,
            name: true,
          },
        },
        _count: {
          select: {
            touches: true,
            contentAssets: true,
          },
        },
      },
    })

    return NextResponse.json({ links })
  } catch (error) {
    console.error("[Tracking GET error]", error)
    return NextResponse.json({ error: "Failed to fetch tracking links." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canGenerateLinks")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await req.json()
    const {
      campaignId,
      destinationUrl,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      utmId,
      customCode,
    } = body

    if (!destinationUrl || !utmSource || !utmMedium || !utmCampaign) {
      return NextResponse.json(
        { error: "Destination URL, utm_source, utm_medium, and utm_campaign are required." },
        { status: 400 }
      )
    }

    // Generate unique short code
    let code = customCode ? sanitizeSlug(customCode) : ""
    if (!code) {
      const prefix = sanitizeSlug(utmSource).slice(0, 3) || "es"
      const randomPart = Math.random().toString(36).substring(2, 7)
      code = `${prefix}-${randomPart}`
    }

    // Ensure code uniqueness
    const existing = await prisma.marketingTrackingLink.findUnique({
      where: { code },
    })
    if (existing) {
      code = `${code}-${Math.random().toString(36).substring(2, 5)}`
    }

    // Build the full URL with standard UTM parameters
    let targetUrl: URL
    try {
      targetUrl = new URL(destinationUrl.startsWith("http") ? destinationUrl : `${APP_URL}${destinationUrl}`)
    } catch {
      targetUrl = new URL(`${APP_URL}/${destinationUrl.replace(/^\//, "")}`)
    }

    targetUrl.searchParams.set("utm_source", utmSource.trim())
    targetUrl.searchParams.set("utm_medium", utmMedium.trim())
    targetUrl.searchParams.set("utm_campaign", utmCampaign.trim())
    if (utmContent?.trim()) targetUrl.searchParams.set("utm_content", utmContent.trim())
    if (utmTerm?.trim()) targetUrl.searchParams.set("utm_term", utmTerm.trim())
    if (utmId?.trim()) targetUrl.searchParams.set("utm_id", utmId.trim())

    const fullUrl = targetUrl.toString()
    const shortUrl = `${APP_URL}/l/${code}`

    const link = await prisma.marketingTrackingLink.create({
      data: {
        campaignId: campaignId || null,
        code,
        destinationUrl: destinationUrl.trim(),
        utmSource: utmSource.trim().toLowerCase(),
        utmMedium: utmMedium.trim().toLowerCase(),
        utmCampaign: utmCampaign.trim().toLowerCase(),
        utmContent: utmContent?.trim() || null,
        utmTerm: utmTerm?.trim() || null,
        utmId: utmId?.trim() || null,
        fullUrl,
        shortUrl,
        createdById: auth.context.userId,
      },
    })

    await prisma.marketingAuditLog.create({
      data: {
        actorId: auth.context.userId,
        actorEmail: auth.context.email,
        action: "TRACKING_LINK_CREATED",
        entityType: "TRACKING_LINK",
        entityId: link.id,
        metadata: {
          code,
          fullUrl,
          utmSource: link.utmSource,
          utmCampaign: link.utmCampaign,
        },
      },
    })

    return NextResponse.json({ link }, { status: 201 })
  } catch (error) {
    console.error("[Tracking POST error]", error)
    return NextResponse.json({ error: "Failed to generate tracking link." }, { status: 500 })
  }
}
