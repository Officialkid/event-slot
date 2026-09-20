import type { IntegrationSummary } from "./types"

/**
 * Manual publishing adapter for the current EventSlot WhatsApp community workflow.
 * 
 * IMPORTANT:
 * This provider enforces compliance with platform policies:
 * - NO unofficial WhatsApp web automation or scraping.
 * - NO capturing or asking for personal WhatsApp passwords.
 * - Provides formatted copy-paste text and official wa.me shortlinks for community organizers.
 */
export class WhatsAppWorkflowProvider {
  static getSummary(): IntegrationSummary {
    return {
      platform: "WHATSAPP",
      title: "WhatsApp",
      description: "Manual publishing for the current EventSlot WhatsApp workflow.",
      status: "MANUAL",
      isConfigured: true,
      isManual: true,
      docsUrl: "https://faq.whatsapp.com/",
      availableScopes: [
        "Manual Broadcast Formatting",
        "Community Group Distribution",
        "Shortlink UTM Tracking",
      ],
      metadata: {
        accountName: "EventSlot Official Community",
        accountUsername: "EventSlot Announcement Group",
        accountIdentifier: "eventslot-wa-community",
        accountType: "MANUAL_COMMUNITY",
        profilePictureUrl: null,
        grantedScopes: [
          "Manual Structured Copy",
          "Formatted Emojis & Spacing",
          "One-Click UTM Link Copy",
        ],
        tokenExpiresAt: null,
        connectedBy: {
          id: "system-root",
          name: "Marketing Operations",
          email: "marketing@eventsslot.com",
        },
        connectedAt: "2026-01-01T00:00:00.000Z",
        lastSyncAt: new Date().toISOString(),
        errorMessage: null,
      },
    }
  }

  /**
   * Helper to format an event announcement for WhatsApp copy-pasting
   */
  static formatMessage(title: string, date: string, location: string, shortUrl: string): string {
    return [
      `🎟️ *${title.trim()}*`,
      "",
      `📅 *Date:* ${date}`,
      `📍 *Location:* ${location}`,
      "",
      `Secure your ticket here:`,
      `👉 ${shortUrl}`,
      "",
      `_Shared via EventSlot Official Channel_`,
    ].join("\n")
  }
}
