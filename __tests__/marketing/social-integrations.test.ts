import { InstagramIntegrationProvider } from "@/lib/marketing/integrations/instagram"
import { LinkedInIntegrationProvider } from "@/lib/marketing/integrations/linkedin"
import { EmailBroadcastProvider } from "@/lib/marketing/integrations/email"
import { WhatsAppWorkflowProvider } from "@/lib/marketing/integrations/whatsapp"
import { MarketingIntegrationsManager } from "@/lib/marketing/integrations/manager"
import prisma from "@/lib/prisma"

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  marketingIntegration: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  marketingAuditLog: {
    create: jest.fn(),
  },
}))

describe("Social Account Integration Foundation (Step 1)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.META_APP_ID = "test-meta-app-id-123"
    process.env.META_APP_SECRET = "test-meta-secret-456"
    process.env.LINKEDIN_CLIENT_ID = "test-linkedin-client-789"
    process.env.LINKEDIN_CLIENT_SECRET = "test-linkedin-secret-abc"
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    process.env.NEXTAUTH_SECRET = "test-nextauth-secret-for-signing-state"
  })

  describe("1. Zero Password Principle & OAuth Authorization URLs", () => {
    it("generates official Meta OAuth URL without collecting passwords", () => {
      const state = "test-csrf-state"
      const { url, error } = InstagramIntegrationProvider.getAuthUrl(state, "https://marketing.eventsslot.com")

      expect(error).toBeUndefined()
      expect(url).toContain("https://www.facebook.com/v20.0/dialog/oauth")
      expect(url).toContain("client_id=test-meta-app-id-123")
      expect(url).toContain("state=test-csrf-state")
      expect(url).toContain("instagram_basic")
      expect(url).toContain("pages_show_list")
      expect(url).toContain("pages_read_engagement")
      expect(url).toContain("instagram_manage_insights")
    })

    it("generates official LinkedIn OAuth 2.0 URL without collecting passwords", () => {
      const state = "test-csrf-state"
      const { url, error } = LinkedInIntegrationProvider.getAuthUrl(state, "https://marketing.eventsslot.com")

      expect(error).toBeUndefined()
      expect(url).toContain("https://www.linkedin.com/oauth/v2/authorization")
      expect(url).toContain("client_id=test-linkedin-client-789")
      expect(url).toContain("state=test-csrf-state")
      expect(url).toContain("w_organization_social")
      expect(url).toContain("r_organization_social")
      expect(url).toContain("rw_organization_admin")
    })
  })

  describe("2. Cryptographic CSRF State Verification", () => {
    it("creates a tamper-proof signed state token and verifies it", () => {
      const { state } = MarketingIntegrationsManager.generateOAuthState("instagram", "user-123")
      expect(state).toContain(".")

      const verified = MarketingIntegrationsManager.verifyOAuthState(state, "instagram")
      expect(verified).not.toBeNull()
      expect(verified?.userId).toBe("user-123")
      expect(verified?.platform).toBe("instagram")
    })

    it("rejects tampered state tokens", () => {
      const { state } = MarketingIntegrationsManager.generateOAuthState("instagram", "user-123")
      const [encoded, sig] = state.split(".")
      const tampered = `${encoded}tampered.${sig}`

      const verified = MarketingIntegrationsManager.verifyOAuthState(tampered, "instagram")
      expect(verified).toBeNull()
    })

    it("rejects state tokens intended for a different platform", () => {
      const { state } = MarketingIntegrationsManager.generateOAuthState("instagram", "user-123")

      const verified = MarketingIntegrationsManager.verifyOAuthState(state, "linkedin")
      expect(verified).toBeNull()
    })
  })

  describe("3. Token Encryption & Server-Side Security Isolation", () => {
    it("encrypts sensitive access tokens using AES-256-CBC and extracts safe metadata", () => {
      const credentials = {
        accessToken: "EAABtestMetaAccessTokenSecret999",
        tokenExpiresAt: "2026-11-20T12:00:00.000Z",
        scopes: ["instagram_basic", "pages_show_list"],
        accountUsername: "@eventslot",
        accountType: "BUSINESS",
      }

      const { encrypted, iv } = InstagramIntegrationProvider.encryptCredentials(credentials)
      expect(encrypted).not.toContain("EAABtestMetaAccessTokenSecret999")
      expect(iv).toBeTruthy()

      // Extract safe metadata
      const safeMetadata = InstagramIntegrationProvider.extractSafeMetadata(encrypted, iv, {
        accountName: "EventSlot Official",
        accountIdentifier: "ig-account-123",
        errorMessage: null,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
        connectedById: "admin-user",
      })

      // The safe metadata MUST NOT leak the access token
      expect(safeMetadata.accountUsername).toBe("@eventslot")
      expect((safeMetadata as any).accessToken).toBeUndefined()
      expect((safeMetadata as any).refreshToken).toBeUndefined()
      expect(safeMetadata.grantedScopes).toContain("instagram_basic")
    })
  })

  describe("4. Existing Email Broadcast Engine Representation", () => {
    it("represents the existing Broadcast Engine as Connected without modifying sending logic", () => {
      const summary = EmailBroadcastProvider.getSummary()

      expect(summary.platform).toBe("EMAIL")
      expect(summary.status).toBe("CONNECTED")
      expect(summary.metadata?.accountUsername).toBe("hello@eventsslot.com")
      expect(summary.isManual).toBe(false)
      expect(summary.isConfigured).toBe(true)
    })
  })

  describe("5. WhatsApp Manual Community Workflow", () => {
    it("represents WhatsApp as Manual without unofficial automation or password prompts", () => {
      const summary = WhatsAppWorkflowProvider.getSummary()

      expect(summary.platform).toBe("WHATSAPP")
      expect(summary.status).toBe("MANUAL")
      expect(summary.isManual).toBe(true)

      const formatted = WhatsAppWorkflowProvider.formatMessage(
        "Grand Tech Summit",
        "25 Oct 2026",
        "Nairobi",
        "https://eventsslot.com/l/summit"
      )

      expect(formatted).toContain("Grand Tech Summit")
      expect(formatted).toContain("https://eventsslot.com/l/summit")
    })
  })

  describe("6. Disconnect Flow & Audit Logging", () => {
    it("safely resets credentials, updates status to NOT_CONNECTED, and creates audit log", async () => {
      ;(prisma.marketingIntegration.findUnique as jest.Mock).mockResolvedValue({
        id: "int-ig-1",
        platform: "INSTAGRAM",
        accountName: "EventSlot",
        accountIdentifier: "ig-id-999",
      })

      const result = await MarketingIntegrationsManager.disconnectIntegration(
        "INSTAGRAM",
        "user-admin-1",
        "admin@eventsslot.com"
      )

      expect(result.success).toBe(true)
      expect(prisma.marketingIntegration.update).toHaveBeenCalledWith({
        where: { platform: "INSTAGRAM" },
        data: expect.objectContaining({
          status: "NOT_CONNECTED",
          encryptedCredentials: null,
          credentialsIv: null,
        }),
      })

      expect(prisma.marketingAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "user-admin-1",
          action: "INTEGRATION_DISCONNECTED",
          entityType: "INTEGRATION",
        }),
      })
    })
  })
})
