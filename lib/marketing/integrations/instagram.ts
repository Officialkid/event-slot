import { encrypt, decrypt } from "@/lib/encrypt"
import type {
  OAuthCallbackResult,
  EncryptedStoredCredentials,
  SafeAccountMetadata,
} from "./types"

const META_API_VERSION = "v20.0"

export class InstagramIntegrationProvider {
  static getClientId(): string {
    return process.env.META_APP_ID || process.env.INSTAGRAM_CLIENT_ID || ""
  }

  static getClientSecret(): string {
    return process.env.META_APP_SECRET || process.env.INSTAGRAM_CLIENT_SECRET || ""
  }

  static getRedirectUri(requestOrigin?: string): string {
    if (process.env.META_REDIRECT_URI) {
      return process.env.META_REDIRECT_URI
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace("https://www.", "https://") ||
      requestOrigin ||
      "https://marketing.eventsslot.com"

    return `${baseUrl}/api/marketing/integrations/instagram/callback`
  }

  static getScopes(): string[] {
    return [
      "instagram_basic",
      "pages_show_list",
      "pages_read_engagement",
      "instagram_manage_insights",
    ]
  }

  /**
   * Generates the official Meta/Instagram OAuth 2.0 authorization URL.
   */
  static getAuthUrl(state: string, requestOrigin?: string): { url: string; error?: string } {
    const clientId = this.getClientId()
    if (!clientId) {
      return {
        url: "",
        error: "Meta App ID (META_APP_ID) is not configured in server environment.",
      }
    }

    const redirectUri = this.getRedirectUri(requestOrigin)
    const scopes = this.getScopes().join(",")

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      response_type: "code",
      state: state,
    })

    return {
      url: `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`,
    }
  }

  /**
   * Exchanges authorization code for a long-lived 60-day Instagram Graph API access token.
   */
  static async handleCallback(
    code: string,
    requestOrigin?: string
  ): Promise<OAuthCallbackResult> {
    const clientId = this.getClientId()
    const clientSecret = this.getClientSecret()

    if (!clientId || !clientSecret) {
      return {
        success: false,
        accountName: "",
        accountIdentifier: "",
        accountUsername: "",
        accountType: "BUSINESS",
        scopes: [],
        accessToken: "",
        error: "Missing Meta API credentials in server configuration.",
      }
    }

    const redirectUri = this.getRedirectUri(requestOrigin)

    try {
      // 1. Exchange authorization code for short-lived access token
      const tokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
      tokenUrl.searchParams.set("client_id", clientId)
      tokenUrl.searchParams.set("client_secret", clientSecret)
      tokenUrl.searchParams.set("redirect_uri", redirectUri)
      tokenUrl.searchParams.set("code", code)

      const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" })
      const tokenData = await tokenRes.json()

      if (!tokenRes.ok || !tokenData.access_token) {
        return {
          success: false,
          accountName: "",
          accountIdentifier: "",
          accountUsername: "",
          accountType: "BUSINESS",
          scopes: [],
          accessToken: "",
          error: tokenData.error?.message || "Failed to exchange Meta authorization code.",
        }
      }

      const shortLivedToken = tokenData.access_token

      // 2. Upgrade to a 60-day long-lived access token
      const longLivedUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token")
      longLivedUrl.searchParams.set("client_id", clientId)
      longLivedUrl.searchParams.set("client_secret", clientSecret)
      longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken)

      const longLivedRes = await fetch(longLivedUrl.toString(), { method: "GET" })
      const longLivedData = await longLivedRes.json()

      const accessToken = longLivedData.access_token || shortLivedToken
      const expiresIn = longLivedData.expires_in || 5184000 // default 60 days
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000)

      // 3. Find connected Facebook Page and Instagram Business Account
      const accountsUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/me/accounts`)
      accountsUrl.searchParams.set(
        "fields",
        "id,name,instagram_business_account{id,username,name,profile_picture_url}"
      )
      accountsUrl.searchParams.set("access_token", accessToken)

      const accountsRes = await fetch(accountsUrl.toString(), { method: "GET" })
      const accountsData = await accountsRes.json()

      const pageWithIg = accountsData.data?.find(
        (page: any) => page.instagram_business_account?.id
      )

      if (!pageWithIg || !pageWithIg.instagram_business_account) {
        return {
          success: false,
          accountName: "",
          accountIdentifier: "",
          accountUsername: "",
          accountType: "BUSINESS",
          scopes: [],
          accessToken: "",
          error:
            "No Instagram Professional/Business account found linked to your Facebook Page. Please ensure your Instagram account is switched to Professional and connected to a Facebook Page in Meta Business Suite.",
        }
      }

      const igAccount = pageWithIg.instagram_business_account

      return {
        success: true,
        accountName: igAccount.name || pageWithIg.name || "EventSlot Instagram",
        accountIdentifier: igAccount.id,
        accountUsername: igAccount.username ? `@${igAccount.username}` : "@eventslot",
        accountType: "BUSINESS",
        profilePictureUrl: igAccount.profile_picture_url || null,
        scopes: this.getScopes(),
        accessToken,
        tokenExpiresAt,
      }
    } catch (err: any) {
      return {
        success: false,
        accountName: "",
        accountIdentifier: "",
        accountUsername: "",
        accountType: "BUSINESS",
        scopes: [],
        accessToken: "",
        error: err.message || "Network error communicating with Meta API.",
      }
    }
  }

  /**
   * Helper to safely encrypt tokens before writing to PostgreSQL
   */
  static encryptCredentials(credentials: EncryptedStoredCredentials): {
    encrypted: string
    iv: string
  } {
    return encrypt(JSON.stringify(credentials))
  }

  /**
   * Helper to safely decrypt credentials server-side and extract sanitized metadata
   */
  static extractSafeMetadata(
    encryptedCredentials: string | null,
    credentialsIv: string | null,
    dbRecord: {
      accountName: string | null
      accountIdentifier: string | null
      errorMessage: string | null
      lastSyncAt: Date | null
      updatedAt: Date
      connectedById: string | null
    }
  ): SafeAccountMetadata {
    let parsed: EncryptedStoredCredentials | null = null

    if (encryptedCredentials && credentialsIv) {
      const decrypted = decrypt(encryptedCredentials, credentialsIv)
      if (decrypted) {
        try {
          parsed = JSON.parse(decrypted)
        } catch {
          // malformed json fallback
        }
      }
    }

    return {
      accountName: dbRecord.accountName || "EventSlot Instagram",
      accountUsername: parsed?.accountUsername || "@eventslot",
      accountIdentifier: dbRecord.accountIdentifier,
      accountType: (parsed?.accountType as any) || "BUSINESS",
      profilePictureUrl: parsed?.profilePictureUrl || null,
      grantedScopes: parsed?.scopes || this.getScopes(),
      tokenExpiresAt: parsed?.tokenExpiresAt || null,
      connectedBy: dbRecord.connectedById
        ? { id: dbRecord.connectedById, name: "Marketing Admin", email: "marketing@eventsslot.com" }
        : null,
      connectedAt: dbRecord.updatedAt ? dbRecord.updatedAt.toISOString() : null,
      lastSyncAt: dbRecord.lastSyncAt ? dbRecord.lastSyncAt.toISOString() : null,
      errorMessage: dbRecord.errorMessage,
    }
  }
}
