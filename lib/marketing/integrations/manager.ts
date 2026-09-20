import prisma from "@/lib/prisma"
import { randomBytes, createHmac } from "crypto"
import { EmailBroadcastProvider } from "./email"
import { WhatsAppWorkflowProvider } from "./whatsapp"
import { InstagramIntegrationProvider } from "./instagram"
import { LinkedInIntegrationProvider } from "./linkedin"
import type {
  IntegrationSummary,
  ExtendedIntegrationStatus,
  OAuthStatePayload,
} from "./types"

function getStateSecret(): string {
  return process.env.NEXTAUTH_SECRET || "eventslot-oauth-state-secret-token"
}

export class MarketingIntegrationsManager {
  /**
   * Generates a cryptographically secure, tamper-proof state token for OAuth CSRF protection.
   */
  static generateOAuthState(platform: string, userId: string, returnUrl?: string): { state: string; signature: string } {
    const nonce = randomBytes(16).toString("hex")
    const payload: OAuthStatePayload = {
      platform,
      userId,
      nonce,
      issuedAt: Date.now(),
      returnUrl,
    }

    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
    const signature = createHmac("sha256", getStateSecret()).update(encoded).digest("base64url")

    return {
      state: `${encoded}.${signature}`,
      signature,
    }
  }

  /**
   * Validates the OAuth state token returned by the external provider against tampering and expiration (15m window).
   */
  static verifyOAuthState(stateString: string, expectedPlatform: string): OAuthStatePayload | null {
    try {
      const parts = stateString.split(".")
      if (parts.length !== 2) return null

      const [encoded, signature] = parts
      const expectedSignature = createHmac("sha256", getStateSecret()).update(encoded).digest("base64url")

      if (signature !== expectedSignature) {
        console.error("[OAuth] State signature mismatch")
        return null
      }

      const decoded: OAuthStatePayload = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf-8")
      )

      if (decoded.platform !== expectedPlatform) {
        console.error("[OAuth] State platform mismatch")
        return null
      }

      // 15-minute expiration
      if (Date.now() - decoded.issuedAt > 15 * 60 * 1000) {
        console.error("[OAuth] State token expired")
        return null
      }

      return decoded
    } catch {
      return null
    }
  }

  /**
   * Returns sanitized summaries for all 4 marketing channels.
   * NEVER sends access tokens, secrets, or encryption IVs to the caller.
   */
  static async getAllIntegrations(): Promise<IntegrationSummary[]> {
    const dbIntegrations = await prisma.marketingIntegration.findMany({
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountIdentifier: true,
        status: true,
        encryptedCredentials: true,
        credentialsIv: true,
        lastSyncAt: true,
        errorMessage: true,
        connectedById: true,
        updatedAt: true,
      },
    })

    const dbMap = new Map(dbIntegrations.map((i) => [i.platform, i]))

    // 1. Instagram
    const igRecord = dbMap.get("INSTAGRAM")
    const igSummary: IntegrationSummary = {
      platform: "INSTAGRAM",
      title: "Instagram",
      description:
        "Connect EventSlot's official Instagram account to the EventSlot Marketing Hub using Instagram/Meta's official authorization system.",
      status: (igRecord?.status as ExtendedIntegrationStatus) || "NOT_CONNECTED",
      isConfigured: Boolean(process.env.META_APP_ID || process.env.INSTAGRAM_CLIENT_ID),
      isManual: false,
      docsUrl: "https://developers.facebook.com/docs/instagram-api",
      availableScopes: InstagramIntegrationProvider.getScopes(),
      metadata: igRecord?.status === "CONNECTED" && igRecord
        ? InstagramIntegrationProvider.extractSafeMetadata(
            igRecord.encryptedCredentials,
            igRecord.credentialsIv,
            igRecord
          )
        : null,
    }

    // 2. LinkedIn
    const liRecord = dbMap.get("LINKEDIN")
    const liSummary: IntegrationSummary = {
      platform: "LINKEDIN",
      title: "LinkedIn",
      description:
        "Connect EventSlot's official LinkedIn organization/company page using LinkedIn's official authorization system.",
      status: (liRecord?.status as ExtendedIntegrationStatus) || "NOT_CONNECTED",
      isConfigured: Boolean(process.env.LINKEDIN_CLIENT_ID),
      isManual: false,
      docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
      availableScopes: LinkedInIntegrationProvider.getScopes(),
      metadata: liRecord?.status === "CONNECTED" && liRecord
        ? LinkedInIntegrationProvider.extractSafeMetadata(
            liRecord.encryptedCredentials,
            liRecord.credentialsIv,
            liRecord
          )
        : null,
    }

    // 3. Email (EventSlot Broadcast Engine)
    const emailSummary = EmailBroadcastProvider.getSummary()

    // 4. WhatsApp (Manual Community Workflow)
    const whatsappSummary = WhatsAppWorkflowProvider.getSummary()

    return [igSummary, liSummary, emailSummary, whatsappSummary]
  }

  /**
   * Disconnects a social account, wipes stored encrypted tokens, and logs the action to MarketingAuditLog.
   * Historical campaigns, publications, and analytics are carefully preserved.
   */
  static async disconnectIntegration(
    platform: "INSTAGRAM" | "LINKEDIN",
    userId: string,
    userEmail: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await prisma.marketingIntegration.findUnique({
        where: { platform },
      })

      if (!existing) {
        return { success: true }
      }

      await prisma.marketingIntegration.update({
        where: { platform },
        data: {
          status: "NOT_CONNECTED",
          encryptedCredentials: null,
          credentialsIv: null,
          errorMessage: null,
          lastSyncAt: null,
        },
      })

      await prisma.marketingAuditLog.create({
        data: {
          actorId: userId,
          actorEmail: userEmail,
          action: "INTEGRATION_DISCONNECTED",
          entityType: "INTEGRATION",
          entityId: existing.id,
          metadata: {
            platform,
            disconnectedAccount: existing.accountIdentifier || existing.accountName,
            timestamp: new Date().toISOString(),
          },
        },
      })

      return { success: true }
    } catch (err: any) {
      console.error("[Disconnect error]", err)
      return { success: false, error: err.message || "Failed to disconnect integration." }
    }
  }
}
