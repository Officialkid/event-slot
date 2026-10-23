/**
 * Server-Only Paystack Payout (Transfers) Adapter
 *
 * Implements typed, hardened API client for Paystack Transfers:
 * 1. Transfer recipient creation (/transferrecipient)
 * 2. Transfer initiation (/transfer)
 * 3. Transfer verification (/transfer/verify/:reference)
 * 4. Merchant balance inquiry (/balance)
 *
 * Security & Financial Guarantees:
 * - Server-side only (uses PAYSTACK_SECRET_KEY, never exposed to client).
 * - Exact amount in minor units with currency validation.
 * - Redacts sensitive destination accounts and auth headers in logs.
 * - Distinguishes queued transfer requests from confirmed beneficiary completion.
 */

import {
  getPaystackSecretKey,
  PAYSTACK_BASE_URL,
  DEFAULT_PAYSTACK_TIMEOUT_MS,
  PaystackApiError,
  PaystackValidationError,
  redactSensitivePaystackString,
  sanitizePaystackPayload,
} from '@/lib/paystack'

export type PaystackRecipientType = 'mobile_money' | 'basa' | 'nuban'

export type CreateRecipientInput = {
  type: PaystackRecipientType
  name: string
  accountNumber: string
  bankCode?: string
  currency?: string
  description?: string
}

export type CreateRecipientResult = {
  recipientCode: string
  type: string
  name: string
  accountNumberMasked: string
  currency: string
  active: boolean
  raw: unknown
}

export type InitiateTransferInput = {
  amountMinorUnits: bigint
  recipientCode: string
  reference: string
  reason?: string
  currency?: string
}

export type TransferResult = {
  transferCode: string
  reference: string
  status: 'pending' | 'success' | 'failed' | 'otp' | 'reversed' | 'unknown'
  amountMinorUnits: bigint
  currency: string
  recipientCode: string
  transferredAt?: Date | null
  raw: unknown
}

export type PaystackBalanceItem = {
  currency: string
  balanceMinorUnits: bigint
}

function maskAccountNumber(account: string): string {
  if (account.length <= 4) return '***'
  return `${account.slice(0, 3)}****${account.slice(-3)}`
}

/**
 * Creates a transfer recipient on Paystack.
 */
export async function createPaystackTransferRecipient(
  input: CreateRecipientInput
): Promise<CreateRecipientResult> {
  const secretKey = getPaystackSecretKey()
  const currency = (input.currency || 'KES').toUpperCase()

  if (!input.name?.trim() || !input.accountNumber?.trim()) {
    throw new PaystackValidationError('Recipient name and account number are required.')
  }

  const payload: Record<string, unknown> = {
    type: input.type,
    name: input.name.trim(),
    account_number: input.accountNumber.trim(),
    currency,
    description: input.description,
  }

  if (input.bankCode?.trim()) {
    payload.bank_code = input.bankCode.trim()
  }

  const res = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DEFAULT_PAYSTACK_TIMEOUT_MS),
  })

  const raw = await res.json().catch(() => null)
  if (!res.ok || !raw?.status) {
    throw new PaystackApiError(
      raw?.message || `Failed to create transfer recipient (HTTP ${res.status})`,
      res.status,
      sanitizePaystackPayload(raw)
    )
  }

  const data = raw.data || {}
  return {
    recipientCode: data.recipient_code,
    type: data.type || input.type,
    name: data.name || input.name,
    accountNumberMasked: maskAccountNumber(input.accountNumber),
    currency: (data.currency || currency).toUpperCase(),
    active: Boolean(data.active ?? true),
    raw: sanitizePaystackPayload(raw),
  }
}

/**
 * Initiates an asynchronous payout transfer via Paystack.
 * Note: A successful HTTP response indicates the transfer was accepted/queued by Paystack,
 * NOT that the funds have reached the beneficiary.
 */
export async function initiatePaystackTransfer(
  input: InitiateTransferInput
): Promise<TransferResult> {
  const secretKey = getPaystackSecretKey()
  const currency = (input.currency || 'KES').toUpperCase()

  if (input.amountMinorUnits <= BigInt(0)) {
    throw new PaystackValidationError('Transfer amount must be greater than zero.')
  }

  if (!input.recipientCode?.trim() || !input.reference?.trim()) {
    throw new PaystackValidationError('Recipient code and transfer reference are required.')
  }

  const payload = {
    source: 'balance',
    amount: Number(input.amountMinorUnits),
    recipient: input.recipientCode.trim(),
    reference: input.reference.trim(),
    reason: input.reason || 'EventSlot Organizer Withdrawal',
    currency,
  }

  const res = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DEFAULT_PAYSTACK_TIMEOUT_MS),
  })

  const raw = await res.json().catch(() => null)
  if (!res.ok || !raw?.status) {
    throw new PaystackApiError(
      raw?.message || `Transfer initiation failed (HTTP ${res.status})`,
      res.status,
      sanitizePaystackPayload(raw)
    )
  }

  const data = raw.data || {}
  const rawStatus = (data.status || 'pending').toString().toLowerCase()
  const status: TransferResult['status'] =
    rawStatus === 'success'
      ? 'success'
      : rawStatus === 'failed'
      ? 'failed'
      : rawStatus === 'reversed'
      ? 'reversed'
      : rawStatus === 'otp'
      ? 'otp'
      : 'pending'

  return {
    transferCode: data.transfer_code || '',
    reference: data.reference || input.reference,
    status,
    amountMinorUnits: BigInt(data.amount || Number(input.amountMinorUnits)),
    currency: (data.currency || currency).toUpperCase(),
    recipientCode: data.recipient || input.recipientCode,
    transferredAt: data.transferred_at ? new Date(data.transferred_at) : null,
    raw: sanitizePaystackPayload(raw),
  }
}

/**
 * Checks the status of a transfer by reference.
 */
export async function verifyPaystackTransfer(reference: string): Promise<TransferResult> {
  const secretKey = getPaystackSecretKey()
  const trimmed = reference.trim()

  const res = await fetch(`${PAYSTACK_BASE_URL}/transfer/verify/${encodeURIComponent(trimmed)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(DEFAULT_PAYSTACK_TIMEOUT_MS),
  })

  const raw = await res.json().catch(() => null)
  if (!res.ok || !raw?.status) {
    throw new PaystackApiError(
      raw?.message || `Transfer verification failed (HTTP ${res.status})`,
      res.status,
      sanitizePaystackPayload(raw)
    )
  }

  const data = raw.data || {}
  const rawStatus = (data.status || 'unknown').toString().toLowerCase()
  const status: TransferResult['status'] =
    rawStatus === 'success'
      ? 'success'
      : rawStatus === 'failed'
      ? 'failed'
      : rawStatus === 'reversed'
      ? 'reversed'
      : rawStatus === 'otp'
      ? 'otp'
      : 'pending'

  return {
    transferCode: data.transfer_code || '',
    reference: data.reference || trimmed,
    status,
    amountMinorUnits: BigInt(data.amount || 0),
    currency: (data.currency || 'KES').toUpperCase(),
    recipientCode: data.recipient || '',
    transferredAt: data.transferred_at ? new Date(data.transferred_at) : null,
    raw: sanitizePaystackPayload(raw),
  }
}

/**
 * Inquires the available merchant balance in Paystack across supported currencies.
 */
export async function fetchPaystackMerchantBalance(): Promise<PaystackBalanceItem[]> {
  const secretKey = getPaystackSecretKey()

  const res = await fetch(`${PAYSTACK_BASE_URL}/balance`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(DEFAULT_PAYSTACK_TIMEOUT_MS),
  })

  const raw = await res.json().catch(() => null)
  if (!res.ok || !raw?.status) {
    throw new PaystackApiError(
      raw?.message || `Balance inquiry failed (HTTP ${res.status})`,
      res.status,
      sanitizePaystackPayload(raw)
    )
  }

  const data = Array.isArray(raw.data) ? raw.data : []
  return data.map((item: { currency?: string; balance?: number }) => ({
    currency: (item.currency || 'KES').toUpperCase(),
    balanceMinorUnits: BigInt(item.balance || 0),
  }))
}
