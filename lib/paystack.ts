/**
 * Centralized Server-Only Paystack Integration Foundation
 *
 * Implements typed, hardened API wrappers for:
 * 1. Transaction initialization
 * 2. Transaction verification
 * 3. Timing-safe HMAC-SHA512 webhook signature verification
 * 4. Error classification, request timeouts, and secret redaction
 *
 * NOTE: This module only communicates with Paystack. It does NOT finalize
 * orders, create tickets, or modify ledger balances.
 */

import crypto from 'crypto'

export const PAYSTACK_BASE_URL = 'https://api.paystack.co'
export const DEFAULT_PAYSTACK_TIMEOUT_MS = 10000

// ---------------------------------------------------------------------------
// Typed Errors
// ---------------------------------------------------------------------------

export class PaystackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaystackError'
  }
}

export class PaystackConfigError extends PaystackError {
  constructor(message: string) {
    super(message)
    this.name = 'PaystackConfigError'
  }
}

export class PaystackValidationError extends PaystackError {
  constructor(message: string) {
    super(message)
    this.name = 'PaystackValidationError'
  }
}

export class PaystackTimeoutError extends PaystackError {
  readonly reference?: string

  constructor(message: string, reference?: string) {
    super(message)
    this.name = 'PaystackTimeoutError'
    this.reference = reference
  }
}

export class PaystackApiError extends PaystackError {
  readonly statusCode: number
  readonly responseBody?: unknown

  constructor(message: string, statusCode: number, responseBody?: unknown) {
    super(message)
    this.name = 'PaystackApiError'
    this.statusCode = statusCode
    this.responseBody = responseBody
  }
}

// ---------------------------------------------------------------------------
// Security & Redaction Helpers
// ---------------------------------------------------------------------------

/**
 * Validates and retrieves the server-only Paystack secret key.
 * Throws a sanitized PaystackConfigError if the key is not set.
 */
export function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key || key.trim().length === 0) {
    throw new PaystackConfigError(
      'Paystack secret key is not configured. Set PAYSTACK_SECRET_KEY in server environment.'
    )
  }
  return key.trim()
}

/**
 * Redacts secret keys, bearer tokens, and sensitive payment data from strings and error logs.
 */
export function redactSensitivePaystackString(text: string): string {
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, '$1[REDACTED]')
    .replace(/(sk_live_[A-Za-z0-9]+)/gi, '[REDACTED_SECRET_KEY]')
    .replace(/(sk_test_[A-Za-z0-9]+)/gi, '[REDACTED_SECRET_KEY]')
}

const SENSITIVE_KEYS = new Set([
  'secret',
  'secret_key',
  'secretkey',
  'authorization',
  'auth',
  'token',
  'access_token',
  'password',
  'cvv',
  'cvc',
  'card_number',
  'cardnumber',
  'pin',
])

export function sanitizePaystackPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  if (Array.isArray(payload)) return payload.map(sanitizePaystackPayload)

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizePaystackPayload(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// ---------------------------------------------------------------------------
// Webhook Signature Verification
// ---------------------------------------------------------------------------

/**
 * Verifies the Paystack webhook signature using HMAC-SHA512 with timing-safe equality.
 * Uses the exact raw request body string (never re-serialized JSON).
 * Fails closed if the secret is missing or the signature is invalid.
 */
export function verifyPaystackWebhookSignature(params: {
  rawBody: string | Buffer
  signature: string | null | undefined
  secretKey?: string
}): boolean {
  try {
    const { rawBody, signature } = params
    if (!signature || typeof signature !== 'string') {
      return false
    }

    const secretKey = params.secretKey || process.env.PAYSTACK_SECRET_KEY
    if (!secretKey || secretKey.trim().length === 0) {
      return false
    }

    const trimmedSig = signature.trim()
    const computedHash = crypto
      .createHmac('sha512', secretKey.trim())
      .update(rawBody)
      .digest('hex')

    const sigBuffer = Buffer.from(trimmedSig, 'hex')
    const hashBuffer = Buffer.from(computedHash, 'hex')

    if (sigBuffer.length !== hashBuffer.length || sigBuffer.length === 0) {
      return false
    }

    return crypto.timingSafeEqual(hashBuffer, sigBuffer)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Typed API Contracts
// ---------------------------------------------------------------------------

export type PaystackChannel = 'card' | 'mobile_money' | 'bank' | 'ussd' | 'qr' | 'bank_transfer'

export type PaystackInitializeInput = {
  email: string
  amountMinorUnits: number | bigint
  currency: string
  reference: string
  callbackUrl?: string
  channels?: PaystackChannel[]
  metadata?: Record<string, unknown>
}

export type PaystackInitializeResult = {
  authorizationUrl: string
  accessCode: string
  reference: string
  rawStatus: boolean
  message: string
}

export type PaystackTransactionStatus = 'success' | 'failed' | 'abandoned' | 'pending' | 'unknown'

export type PaystackVerifyResult = {
  reference: string
  status: PaystackTransactionStatus
  isSuccessful: boolean
  amountMinorUnits: number
  currency: string
  channel?: string
  gatewayResponse?: string
  paidAt?: Date | null
  createdAt?: Date | null
  customerEmail?: string
  customerCode?: string
  providerId?: number
  metadata?: Record<string, unknown>
  raw: unknown
}

export type PaystackRequestOptions = {
  timeoutMs?: number
  fetchFn?: typeof fetch
}

// ---------------------------------------------------------------------------
// Transaction Initialization
// ---------------------------------------------------------------------------

/**
 * Initializes a transaction on Paystack using server credentials.
 * Rejects client-supplied amounts: caller must pass the authoritative minor unit amount.
 */
export async function initializePaystackTransaction(
  input: PaystackInitializeInput,
  options: PaystackRequestOptions = {}
): Promise<PaystackInitializeResult> {
  const secretKey = getPaystackSecretKey()

  if (!input.email || !input.email.includes('@')) {
    throw new PaystackValidationError('A valid email address is required for Paystack transaction.')
  }

  const reference = (input.reference || '').trim()
  if (!reference) {
    throw new PaystackValidationError('A valid non-empty reference is required for Paystack transaction.')
  }

  const amountMinor = typeof input.amountMinorUnits === 'bigint'
    ? Number(input.amountMinorUnits)
    : input.amountMinorUnits

  if (!Number.isFinite(amountMinor) || amountMinor <= 0 || !Number.isInteger(amountMinor)) {
    throw new PaystackValidationError('Amount must be a positive integer in minor units.')
  }

  const currency = (input.currency || 'KES').trim().toUpperCase()
  const timeoutMs = options.timeoutMs ?? DEFAULT_PAYSTACK_TIMEOUT_MS
  const fetchImpl = options.fetchFn ?? fetch

  const payload: Record<string, unknown> = {
    email: input.email.trim().toLowerCase(),
    amount: amountMinor,
    currency,
    reference,
  }

  if (input.callbackUrl) {
    payload.callback_url = input.callbackUrl
  }
  if (input.channels && input.channels.length > 0) {
    payload.channels = input.channels
  }
  if (input.metadata) {
    payload.metadata = sanitizePaystackPayload(input.metadata)
  }

  let response: Response
  try {
    response = await fetchImpl(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new PaystackTimeoutError(
        `Paystack initialization timed out after ${timeoutMs}ms for reference "${reference}".`,
        reference
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new PaystackError(`Paystack network error during initialization: ${redactSensitivePaystackString(message)}`)
  }

  const rawText = await response.text()
  let parsed: any
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new PaystackApiError(
      `Paystack returned non-JSON response (HTTP ${response.status})`,
      response.status,
      rawText
    )
  }

  if (!response.ok || !parsed.status) {
    const errorMsg = parsed.message || `Paystack initialization failed (HTTP ${response.status})`
    throw new PaystackApiError(errorMsg, response.status, sanitizePaystackPayload(parsed))
  }

  const data = parsed.data || {}
  if (!data.authorization_url || !data.access_code) {
    throw new PaystackApiError(
      'Paystack initialization response missing authorization_url or access_code',
      response.status,
      sanitizePaystackPayload(parsed)
    )
  }

  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference || reference,
    rawStatus: parsed.status,
    message: parsed.message || 'Authorization URL created',
  }
}

// ---------------------------------------------------------------------------
// Transaction Verification
// ---------------------------------------------------------------------------

/**
 * Verifies a transaction by reference via the Paystack API.
 * Does NOT mutate orders or balances; returns verified provider data for caller consumption.
 */
export async function verifyPaystackTransaction(
  reference: string,
  options: PaystackRequestOptions = {}
): Promise<PaystackVerifyResult> {
  const secretKey = getPaystackSecretKey()

  const trimmedRef = (reference || '').trim()
  if (!trimmedRef) {
    throw new PaystackValidationError('A valid transaction reference is required for verification.')
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_PAYSTACK_TIMEOUT_MS
  const fetchImpl = options.fetchFn ?? fetch

  let response: Response
  try {
    response = await fetchImpl(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(trimmedRef)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      }
    )
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      // INVARIANT: Never treat a timeout as proof that a payment failed!
      throw new PaystackTimeoutError(
        `Paystack verification timed out after ${timeoutMs}ms for reference "${trimmedRef}". Transaction state remains indeterminate.`,
        trimmedRef
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new PaystackError(`Paystack network error during verification: ${redactSensitivePaystackString(message)}`)
  }

  const rawText = await response.text()
  let parsed: any
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new PaystackApiError(
      `Paystack returned non-JSON verification response (HTTP ${response.status})`,
      response.status,
      rawText
    )
  }

  if (!response.ok || !parsed.status) {
    const errorMsg = parsed.message || `Paystack verification failed (HTTP ${response.status})`
    throw new PaystackApiError(errorMsg, response.status, sanitizePaystackPayload(parsed))
  }

  const data = parsed.data || {}
  const rawStatus = (data.status || 'unknown').toString().toLowerCase()
  const status: PaystackTransactionStatus =
    rawStatus === 'success'
      ? 'success'
      : rawStatus === 'failed'
      ? 'failed'
      : rawStatus === 'abandoned'
      ? 'abandoned'
      : rawStatus === 'pending'
      ? 'pending'
      : 'unknown'

  return {
    reference: data.reference || trimmedRef,
    status,
    isSuccessful: status === 'success',
    amountMinorUnits: Number(data.amount || 0),
    currency: (data.currency || 'KES').toUpperCase(),
    channel: data.channel || undefined,
    gatewayResponse: data.gateway_response || undefined,
    paidAt: data.paid_at ? new Date(data.paid_at) : null,
    createdAt: data.created_at ? new Date(data.created_at) : null,
    customerEmail: data.customer?.email || undefined,
    customerCode: data.customer?.customer_code || undefined,
    providerId: typeof data.id === 'number' ? data.id : undefined,
    metadata: data.metadata ? (sanitizePaystackPayload(data.metadata) as Record<string, unknown>) : undefined,
    raw: sanitizePaystackPayload(parsed),
  }
}

// ---------------------------------------------------------------------------
// Legacy / Existing Helpers (Preserved for backwards compatibility)
// ---------------------------------------------------------------------------

/**
 * Legacy authenticated request helper. Preserved for backward compatibility with existing billing routes.
 */
export async function paystackFetch(path: string, options: RequestInit = {}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || ''
  const timeoutMs = DEFAULT_PAYSTACK_TIMEOUT_MS

  try {
    const res = await fetch(`https://api.paystack.co${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      signal: options.signal ?? AbortSignal.timeout(timeoutMs),
    })

    const raw = await res.text()
    try {
      return JSON.parse(raw)
    } catch {
      return {
        status: false,
        message: `Unexpected Paystack response (HTTP ${res.status})`,
        raw,
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: false,
      message: `Paystack request failed: ${redactSensitivePaystackString(message)}`,
    }
  }
}

export function getPlanFromPlanCode(planCode: string): string {
  void planCode
  return 'free'
}

export function getBillingCycleFromPlanCode(planCode: string): string {
  const annualCodes = [
    process.env.PAYSTACK_PRO_ANNUAL_PLAN_CODE,
    process.env.PAYSTACK_BUSINESS_ANNUAL_PLAN_CODE,
  ]
  return annualCodes.includes(planCode) ? 'annual' : 'monthly'
}
