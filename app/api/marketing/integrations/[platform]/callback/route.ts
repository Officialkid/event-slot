import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { MarketingIntegrationsManager } from "@/lib/marketing/integrations/manager"
import { InstagramIntegrationProvider } from "@/lib/marketing/integrations/instagram"
import { LinkedInIntegrationProvider } from "@/lib/marketing/integrations/linkedin"
import type { IntegrationPlatform } from "@prisma/client"

interface RouteParams {
  params: Promise<{
    platform: string
  }>
}

export async function GET(req: NextRequest, props: RouteParams) {
  const { platform } = await props.params
  const normalizedPlatform = platform.toLowerCase()

  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host")
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https"
  const baseUrl =
    (forwardedHost && !forwardedHost.includes("0.0.0.0"))
      ? `${forwardedProto}://${forwardedHost}`
      : (process.env.NEXT_PUBLIC_APP_URL || "https://marketing.eventsslot.com")

  const redirectTarget = new URL("/marketing/integrations", baseUrl)

  if (normalizedPlatform !== "instagram" && normalizedPlatform !== "linkedin") {
    redirectTarget.searchParams.set("error", `Unsupported platform '${platform}'`)
    return NextResponse.redirect(redirectTarget)
  }

  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const errorParam = searchParams.get("error")
  const errorDescription = searchParams.get("error_description") || searchParams.get("error_reason")

  // 1. Handle user cancellation or denial on provider site
  if (errorParam || !code) {
    const errorMsg =
      errorDescription ||
      (errorParam === "access_denied"
        ? `${platform} authorization was cancelled or denied.`
        : `Failed to authorize ${platform}.`)

    redirectTarget.searchParams.set("error", errorMsg)
    redirectTarget.searchParams.set("platform", platform)
    return NextResponse.redirect(redirectTarget)
  }

  // 2. CSRF State Verification
  const cookieState = req.cookies.get("es_mkt_oauth_state")?.value
  if (!state || !cookieState || state !== cookieState) {
    redirectTarget.searchParams.set("error", "Invalid or expired OAuth state (CSRF verification failed).")
    redirectTarget.searchParams.set("platform", platform)
    return NextResponse.redirect(redirectTarget)
  }

  const verifiedState = MarketingIntegrationsManager.verifyOAuthState(state, normalizedPlatform)
  if (!verifiedState) {
    redirectTarget.searchParams.set("error", "Security verification failed for OAuth response.")
    redirectTarget.searchParams.set("platform", platform)
    return NextResponse.redirect(redirectTarget)
  }

  // 3. Complete Code Exchange with Platform
  const dbPlatform: IntegrationPlatform =
    normalizedPlatform === "instagram" ? "INSTAGRAM" : "LINKEDIN"

  const result =
    normalizedPlatform === "instagram"
      ? await InstagramIntegrationProvider.handleCallback(code, baseUrl)
      : await LinkedInIntegrationProvider.handleCallback(code, baseUrl)

  if (!result.success || !result.accessToken) {
    redirectTarget.searchParams.set(
      "error",
      result.error || `Could not complete ${platform} connection.`
    )
    redirectTarget.searchParams.set("platform", platform)
    return NextResponse.redirect(redirectTarget)
  }

  // 4. Encrypt sensitive credentials server-side using AES-256-CBC
  const credentialsToEncrypt = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    tokenExpiresAt: result.tokenExpiresAt?.toISOString(),
    scopes: result.scopes,
    accountUsername: result.accountUsername,
    accountType: result.accountType,
    profilePictureUrl: result.profilePictureUrl,
  }

  const { encrypted, iv } =
    normalizedPlatform === "instagram"
      ? InstagramIntegrationProvider.encryptCredentials(credentialsToEncrypt)
      : LinkedInIntegrationProvider.encryptCredentials(credentialsToEncrypt)

  // 5. Store in Database
  try {
    const integration = await prisma.marketingIntegration.upsert({
      where: { platform: dbPlatform },
      create: {
        platform: dbPlatform,
        accountName: result.accountName,
        accountIdentifier: result.accountIdentifier,
        status: "CONNECTED",
        encryptedCredentials: encrypted,
        credentialsIv: iv,
        connectedById: verifiedState.userId,
        lastSyncAt: new Date(),
        errorMessage: null,
      },
      update: {
        accountName: result.accountName,
        accountIdentifier: result.accountIdentifier,
        status: "CONNECTED",
        encryptedCredentials: encrypted,
        credentialsIv: iv,
        connectedById: verifiedState.userId,
        lastSyncAt: new Date(),
        errorMessage: null,
      },
    })

    // 6. Audit Log
    await prisma.marketingAuditLog.create({
      data: {
        actorId: verifiedState.userId,
        action: "INTEGRATION_CONNECTED",
        entityType: "INTEGRATION",
        entityId: integration.id,
        metadata: {
          platform: dbPlatform,
          accountName: result.accountName,
          accountUsername: result.accountUsername,
          accountType: result.accountType,
          grantedScopes: result.scopes,
          connectedAt: new Date().toISOString(),
        },
      },
    })

    const targetUrl = verifiedState.returnUrl
      ? new URL(verifiedState.returnUrl)
      : redirectTarget

    targetUrl.searchParams.set("connected", "true")
    targetUrl.searchParams.set("platform", platform)
    targetUrl.searchParams.set("account", result.accountUsername || result.accountName)

    const response = NextResponse.redirect(targetUrl)
    response.cookies.delete("es_mkt_oauth_state")
    return response
  } catch (dbError: any) {
    console.error("[OAuth Callback Database Error]", dbError)
    redirectTarget.searchParams.set("error", "Database error storing connection.")
    return NextResponse.redirect(redirectTarget)
  }
}
