import { NextRequest, NextResponse } from "next/server"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import { MarketingIntegrationsManager } from "@/lib/marketing/integrations/manager"
import { InstagramIntegrationProvider } from "@/lib/marketing/integrations/instagram"
import { LinkedInIntegrationProvider } from "@/lib/marketing/integrations/linkedin"

interface RouteParams {
  params: Promise<{
    platform: string
  }>
}

export async function GET(req: NextRequest, props: RouteParams) {
  const auth = await requireMarketingContext(req, "canManageIntegrations")
  if (auth.errorResponse) return auth.errorResponse

  const { platform } = await props.params
  const normalizedPlatform = platform.toLowerCase()

  if (normalizedPlatform !== "instagram" && normalizedPlatform !== "linkedin") {
    return NextResponse.json(
      { error: `Platform '${platform}' does not support OAuth connection.` },
      { status: 400 }
    )
  }

  const origin = req.headers.get("origin") || req.nextUrl.origin
  const { state } = MarketingIntegrationsManager.generateOAuthState(
    normalizedPlatform,
    auth.context.userId,
    `${origin}/marketing/integrations`
  )

  let authResult: { url: string; error?: string }

  if (normalizedPlatform === "instagram") {
    authResult = InstagramIntegrationProvider.getAuthUrl(state, origin)
  } else {
    authResult = LinkedInIntegrationProvider.getAuthUrl(state, origin)
  }

  if (authResult.error || !authResult.url) {
    return NextResponse.json(
      { error: authResult.error || "Failed to generate official authorization URL." },
      { status: 400 }
    )
  }

  const acceptsJson = req.headers.get("accept")?.includes("application/json")

  if (acceptsJson) {
    const response = NextResponse.json({ url: authResult.url })
    response.cookies.set("es_mkt_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 900, // 15 minutes
    })
    return response
  }

  const redirectResponse = NextResponse.redirect(authResult.url)
  redirectResponse.cookies.set("es_mkt_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  })
  return redirectResponse
}
