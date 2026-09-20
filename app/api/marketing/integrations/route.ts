import { NextRequest, NextResponse } from "next/server"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import { MarketingIntegrationsManager } from "@/lib/marketing/integrations/manager"

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const integrations = await MarketingIntegrationsManager.getAllIntegrations()
    const isMarketingAdmin = Boolean(
      auth.context.role === "MARKETING_ADMIN" || auth.context.isSuperAdmin
    )

    return NextResponse.json({
      integrations,
      isMarketingAdmin,
      userRole: auth.context.role,
    })
  } catch (error) {
    console.error("[Integrations GET error]", error)
    return NextResponse.json(
      { error: "Failed to fetch marketing integrations." },
      { status: 500 }
    )
  }
}
