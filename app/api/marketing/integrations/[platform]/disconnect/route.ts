import { NextRequest, NextResponse } from "next/server"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import { MarketingIntegrationsManager } from "@/lib/marketing/integrations/manager"

interface RouteParams {
  params: Promise<{
    platform: string
  }>
}

export async function POST(req: NextRequest, props: RouteParams) {
  const auth = await requireMarketingContext(req, "canManageIntegrations")
  if (auth.errorResponse) return auth.errorResponse

  const { platform } = await props.params
  const normalizedPlatform = platform.toUpperCase()

  if (normalizedPlatform !== "INSTAGRAM" && normalizedPlatform !== "LINKEDIN") {
    return NextResponse.json(
      { error: `Platform '${platform}' cannot be disconnected via this endpoint.` },
      { status: 400 }
    )
  }

  const result = await MarketingIntegrationsManager.disconnectIntegration(
    normalizedPlatform as "INSTAGRAM" | "LINKEDIN",
    auth.context.userId,
    auth.context.email
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `${platform} has been safely disconnected from EventSlot Marketing Hub.`,
  })
}
