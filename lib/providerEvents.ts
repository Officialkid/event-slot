/**
 * Webhook & Provider Event Idempotency Lifecycle
 *
 * Implements deduplication, deterministic idempotency key derivation,
 * and safe retry state transitions for external payment events (Paystack, M-Pesa, etc.).
 */

import { ProcessedEventStatus } from '@prisma/client'

export type ProcessedProviderEventRecord = {
  id: string
  provider: string
  eventId: string | null
  eventType: string
  idempotencyKey: string
  status: ProcessedEventStatus
  reference: string | null
  orderId: string | null
  paymentId: string | null
  firstSeenAt: Date
  lastAttemptAt: Date | null
  processedAt: Date | null
  attemptCount: number
  error: string | null
}

export type EventProcessingDecision = {
  shouldProcess: boolean
  action:
    | 'CREATE_AND_PROCESS'
    | 'PROCESS_RECEIVED'
    | 'RETRY_FAILED'
    | 'RETRY_EXPIRED_LOCK'
    | 'IGNORE_SUCCESS'
    | 'DEFER_CONCURRENT'
  reason: string
}

/**
 * Derives a canonical idempotency key for a provider event.
 * Priority:
 * 1. Provider-assigned unique event ID (e.g. Paystack event id).
 * 2. Fallback: Provider + eventType + transaction reference.
 * Throws if neither is available, preventing accidental merging of unrelated payments.
 */
export function generateProviderEventIdempotencyKey(input: {
  provider: string
  eventType: string
  providerEventId?: string | number | null
  reference?: string | null
}): string {
  const provider = input.provider.trim().toLowerCase()
  const eventType = input.eventType.trim().toLowerCase()

  if (input.providerEventId !== undefined && input.providerEventId !== null) {
    const eventIdStr = String(input.providerEventId).trim()
    if (eventIdStr.length > 0) {
      return `${provider}:event:${eventIdStr}`
    }
  }

  if (input.reference) {
    const refStr = String(input.reference).trim()
    if (refStr.length > 0) {
      return `${provider}:${eventType}:ref:${refStr}`
    }
  }

  throw new Error(
    `Cannot generate safe provider event idempotency key for provider "${provider}" and event "${eventType}": missing eventId and reference.`
  )
}

/**
 * Evaluates whether an incoming provider event should be processed.
 *
 * Invariants:
 * - PROCESSED: Permanently blocked from re-processing. Idempotent success response.
 * - PROCESSING: If within lock timeout (default 60s), concurrently locked; do not process.
 *               If lock expired, permits recovery retry.
 * - FAILED: Never permanently blocks a legitimate provider retry.
 * - RECEIVED: Ready for initial processing.
 * - null (new): Ready for initial processing.
 */
export function evaluateEventProcessingDecision(
  existingEvent: ProcessedProviderEventRecord | null | undefined,
  lockWindowMs = 60000,
  now = new Date()
): EventProcessingDecision {
  if (!existingEvent) {
    return {
      shouldProcess: true,
      action: 'CREATE_AND_PROCESS',
      reason: 'New event not previously recorded.',
    }
  }

  if (existingEvent.status === 'PROCESSED') {
    return {
      shouldProcess: false,
      action: 'IGNORE_SUCCESS',
      reason: 'Event was already successfully processed.',
    }
  }

  if (existingEvent.status === 'PROCESSING') {
    const lastAttemptTime = existingEvent.lastAttemptAt
      ? new Date(existingEvent.lastAttemptAt).getTime()
      : new Date(existingEvent.firstSeenAt).getTime()
    const ageMs = now.getTime() - lastAttemptTime

    if (ageMs < lockWindowMs) {
      return {
        shouldProcess: false,
        action: 'DEFER_CONCURRENT',
        reason: `Event is currently being processed by another worker (lock age: ${Math.round(ageMs / 1000)}s).`,
      }
    }

    return {
      shouldProcess: true,
      action: 'RETRY_EXPIRED_LOCK',
      reason: `Event was locked in PROCESSING state, but lock expired (${Math.round(ageMs / 1000)}s ago). Retrying.`,
    }
  }

  if (existingEvent.status === 'FAILED') {
    return {
      shouldProcess: true,
      action: 'RETRY_FAILED',
      reason: 'Previous attempt failed. Retrying legitimate provider event.',
    }
  }

  // existingEvent.status === 'RECEIVED'
  return {
    shouldProcess: true,
    action: 'PROCESS_RECEIVED',
    reason: 'Event was received and is queued for processing.',
  }
}

/**
 * Sanitizes error messages before logging or saving to error field.
 * Scrubs authorization headers, bearer tokens, and API secret keys.
 */
export function sanitizeEventError(err: unknown): string {
  if (!err) return 'Unknown error'
  const raw = err instanceof Error ? err.stack || err.message : String(err)

  return raw
    .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, '$1[REDACTED]')
    .replace(/(sk_live_[A-Za-z0-9]+)/gi, '[REDACTED_SECRET_KEY]')
    .replace(/(sk_test_[A-Za-z0-9]+)/gi, '[REDACTED_SECRET_KEY]')
    .slice(0, 2000)
}
