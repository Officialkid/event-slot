import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import type { IntegrationPlatform, IntegrationStatus } from "@prisma/client"

const ALL_PLATFORMS: IntegrationPlatform[] = [
  "INSTAGRAM",
  "LINKEDIN",
  "WHATSAPP_BUSINESS",
  "TWITTER_X",
]

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const existing = await prisma.marketingIntegration.findMany({
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountIdentifier: true,
        status: true,
        lastSyncAt: true,
        errorMessage: true,
        updatedAt: true,
      },
    })

    const integrationMap = new Map(existing.map((i) => [i.platform, i]))

    // Ensure all supported platforms are represented
    const integrations = ALL_PLATFORMS.map((platform) => {
      const record = integrationMap.get(platform)
      if (record) return record

      return {
        id: `mock-${platform.toLowerCase()}`,
        platform,
        accountName: null,
        accountIdentifier: null,
        status: "NOT_CONNECTED" as IntegrationStatus,
        lastSyncAt: null,
        errorMessage: null,
        updatedAt: null,
      }
    })

    return NextResponse.json({ integrations })
  } catch (error) {
    console.error("[Integrations GET error]", error)
    return NextResponse.json({ error: "Failed to fetch integrations." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canManageIntegrations")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await req.json()
    const { platform, accountName, accountIdentifier, status = "CONNECTED" } = body

    if (!platform) {
      return NextResponse.json({ error: "Platform is required." }, { status: 400 })
    }

    const integration = await prisma.marketingIntegration.upsert({
      where: { platform: platform as IntegrationPlatform },
      create: {
        platform: platform as IntegrationPlatform,
        accountName: accountName?.trim() || null,
        accountIdentifier: accountIdentifier?.trim() || null,
        status: status as IntegrationStatus,
        connectedById: auth.context.userId,
        lastSyncAt: new Date(),
      },
      update: {
        accountName: accountName?.trim() || null,
        accountIdentifier: accountIdentifier?.trim() || null,
        status: status as IntegrationStatus,
        connectedById: auth.context.userId,
        lastSyncAt: new Date(),
        errorMessage: null,
      },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountIdentifier: true,
        status: true,
        lastSyncAt: true,
      },
    })

    await prisma.marketingAuditLog.create({
      data: {
        actorId: auth.context.userId,
        actorEmail: auth.context.email,
        action: "INTEGRATION_UPDATED",
        entityType: "INTEGRATION",
        entityId: integration.id,
        metadata: { platform: integration.platform, status: integration.status },
      },
    })

    return NextResponse.json({ integration })
  } catch (error) {
    console.error("[Integrations POST error]", error)
    return NextResponse.json({ error: "Failed to update integration." }, { status: 500 })
  }
}
