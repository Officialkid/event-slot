import { encrypt, decrypt } from "@/lib/encrypt"
import type {
  OAuthCallbackResult,
  EncryptedStoredCredentials,
  SafeAccountMetadata,
} from "./types"

export class LinkedInIntegrationProvider {
  static getClientId(): string {
    return process.env.LINKEDIN_CLIENT_ID || ""
  }

  static getClientSecret(): string {
    return process.env.LINKEDIN_CLIENT_SECRET || ""
  }

  static getRedirectUri(requestOrigin?: string): string {
    if (process.env.LINKEDIN_REDIRECT_URI) {
      return process.env.LINKEDIN_REDIRECT_URI
    }

    if (requestOrigin && !requestOrigin.includes("0.0.0.0")) {
      return `${requestOrigin}/api/marketing/integrations/linkedin/callback`
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://marketing.eventsslot.com"
    return `${baseUrl}/api/marketing/integrations/linkedin/callback`
  }

  static getScopes(): string[] {
    if (process.env.LINKEDIN_SCOPES) {
      return process.env.LINKEDIN_SCOPES.split(",").map((s) => s.trim()).filter(Boolean)
    }

    // Default scopes for provisioned products ("Share on LinkedIn" + "Sign In with LinkedIn")
    return ["w_member_social", "openid", "profile", "email"]
  }

  /**
   * Generates the official LinkedIn OAuth 2.0 authorization URL.
   */
  static getAuthUrl(state: string, requestOrigin?: string): { url: string; error?: string } {
    const clientId = this.getClientId()
    if (!clientId) {
      return {
        url: "",
        error: "LinkedIn Client ID (LINKEDIN_CLIENT_ID) is not configured in server environment.",
      }
    }

    const redirectUri = this.getRedirectUri(requestOrigin)
    const scopes = this.getScopes().join(" ")

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state: state,
    })

    return {
      url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
    }
  }

  /**
   * Exchanges authorization code for LinkedIn access token and discovers administered organization page.
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
        accountType: "COMPANY_PAGE",
        scopes: [],
        accessToken: "",
        error: "Missing LinkedIn API credentials in server configuration.",
      }
    }

    const redirectUri = this.getRedirectUri(requestOrigin)

    try {
      // 1. Token Exchange
      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      })

      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      })

      const tokenData = await tokenRes.json()

      if (!tokenRes.ok || !tokenData.access_token) {
        return {
          success: false,
          accountName: "",
          accountIdentifier: "",
          accountUsername: "",
          accountType: "COMPANY_PAGE",
          scopes: [],
          accessToken: "",
          error: tokenData.error_description || "Failed to exchange LinkedIn authorization code.",
        }
      }

      const accessToken = tokenData.access_token
      const refreshToken = tokenData.refresh_token || undefined
      const expiresIn = tokenData.expires_in || 5184000 // default 60 days
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000)

      // 2. Discover Profile & Administered Organizations
      let organizationId = "urn:li:organization:eventslot"
      let organizationName = "EventSlot"
      let accountUsername = "EventSlot LinkedIn"
      let profilePictureUrl: string | undefined = undefined

      // Attempt userinfo (works with openid / profile)
      try {
        const userInfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (userInfoRes.ok) {
          const uData = await userInfoRes.json()
          if (uData.name) {
            organizationName = `${uData.name} (EventSlot Admin)`
            accountUsername = uData.name
          }
          if (uData.picture) {
            profilePictureUrl = uData.picture
          }
        }
      } catch {
        // non-critical
      }

      // Attempt organizationalEntityAcls (works if organization scope is active)
      try {
        const aclsRes = await fetch(
          "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&state=APPROVED",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "LinkedIn-Version": "202401",
              "X-Restli-Protocol-Version": "2.0.0",
            },
          }
        )

        if (aclsRes.ok) {
          const aclsData = await aclsRes.json()
          const element = aclsData.elements?.[0]
          if (element?.organizationalTarget) {
            organizationId = element.organizationalTarget

            // Fetch organization entity name
            const orgUrn = encodeURIComponent(organizationId)
            const orgRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgUrn}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "LinkedIn-Version": "202401",
              },
            })

            if (orgRes.ok) {
              const orgData = await orgRes.json()
              organizationName =
                orgData.localizedName ||
                orgData.vanityName ||
                organizationName
              accountUsername = organizationName
            }
          }
        }
      } catch {
        // graceful fallback if organization lookup fails
      }

      return {
        success: true,
        accountName: organizationName,
        accountIdentifier: organizationId,
        accountUsername,
        accountType: "COMPANY_PAGE",
        profilePictureUrl,
        scopes: this.getScopes(),
        accessToken,
        refreshToken,
        tokenExpiresAt,
      }
    } catch (err: any) {
      return {
        success: false,
        accountName: "",
        accountIdentifier: "",
        accountUsername: "",
        accountType: "COMPANY_PAGE",
        scopes: [],
        accessToken: "",
        error: err.message || "Network error communicating with LinkedIn API.",
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
          // malformed fallback
        }
      }
    }

    return {
      accountName: dbRecord.accountName || "EventSlot Official Page",
      accountUsername: parsed?.accountUsername || "EventSlot Company Page",
      accountIdentifier: dbRecord.accountIdentifier,
      accountType: "COMPANY_PAGE",
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
