import type { IntegrationPlatform, IntegrationStatus } from "@prisma/client"

export type { IntegrationPlatform, IntegrationStatus }

export type ExtendedIntegrationStatus =
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "CONNECTION_EXPIRED"
  | "PERMISSION_REQUIRED"
  | "ERROR"
  | "DISCONNECTED"
  | "MANUAL"

export interface SafeAccountMetadata {
  accountName: string | null
  accountUsername: string | null
  accountIdentifier: string | null
  accountType: "BUSINESS" | "CREATOR" | "COMPANY_PAGE" | "BROADCAST_ENGINE" | "MANUAL_COMMUNITY"
  profilePictureUrl?: string | null
  grantedScopes: string[]
  tokenExpiresAt: string | null
  connectedBy: {
    id: string
    name: string | null
    email: string | null
  } | null
  connectedAt: string | null
  lastSyncAt: string | null
  errorMessage: string | null
}

export interface IntegrationSummary {
  platform: IntegrationPlatform | "EMAIL" | "WHATSAPP"
  title: string
  description: string
  status: ExtendedIntegrationStatus
  isConfigured: boolean
  isManual: boolean
  metadata: SafeAccountMetadata | null
  availableScopes: string[]
  docsUrl: string
}

export interface EncryptedStoredCredentials {
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: string
  scopes: string[]
  accountUsername?: string
  accountType?: string
  profilePictureUrl?: string
  extraData?: Record<string, unknown>
}

export interface OAuthStatePayload {
  platform: string
  userId: string
  nonce: string
  issuedAt: number
  returnUrl?: string
}

export interface OAuthCallbackResult {
  success: boolean
  accountName: string
  accountIdentifier: string
  accountUsername: string
  accountType: "BUSINESS" | "CREATOR" | "COMPANY_PAGE"
  profilePictureUrl?: string
  scopes: string[]
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: Date
  error?: string
}
