import type { IntegrationSummary } from "./types"

/**
 * Read-only representation of the EventSlot Broadcast Engine.
 * 
 * IMPORTANT:
 * This provider DOES NOT modify, replace, or alter the existing EventSlot Broadcast Engine.
 * The Broadcast Engine is powered by Nodemailer (persistent SMTP pooling) with automatic
 * failover to Resend, delivering transactional and broadcast emails from hello@eventsslot.com.
 */
export class EmailBroadcastProvider {
  static getSummary(): IntegrationSummary {
    return {
      platform: "EMAIL",
      title: "Email",
      description: "EventSlot Broadcast Engine",
      status: "CONNECTED",
      isConfigured: true,
      isManual: false,
      docsUrl: "https://eventsslot.com/docs/technical/broadcast",
      availableScopes: [
        "Transactional Delivery",
        "Broadcast Engine",
        "RFC 8058 One-Click Unsubscribe",
        "Delivery Rate Limiter",
      ],
      metadata: {
        accountName: "EventSlot Official Mailer",
        accountUsername: "hello@eventsslot.com",
        accountIdentifier: "eventslot-broadcast-v1",
        accountType: "BROADCAST_ENGINE",
        profilePictureUrl: null,
        grantedScopes: [
          "Primary SMTP Pooled Delivery",
          "Automatic Failover Redundancy",
          "Dynamic Name Sanitizer",
          "Audience Suppression Lists",
        ],
        tokenExpiresAt: null, // System-level authenticated
        connectedBy: {
          id: "system-root",
          name: "System Core",
          email: "hello@eventsslot.com",
        },
        connectedAt: "2026-01-01T00:00:00.000Z",
        lastSyncAt: new Date().toISOString(),
        errorMessage: null,
      },
    }
  }
}
