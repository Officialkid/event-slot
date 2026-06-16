import IntaSend from 'intasend-node'
import { env } from '@/lib/env'

type IntaSendStatusState = 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED' | string

export type IntaSendCollectionStatus = {
  invoice?: {
    invoice_id?: string
    id?: string
    state?: IntaSendStatusState
    provider?: string
    api_ref?: string | null
    mpesa_reference?: string | null
    failed_reason?: string | null
    failed_code?: string | null
  }
}

export function isIntaSendConfigured() {
  return Boolean(env.INTASEND_PUBLISHABLE_KEY && env.INTASEND_SECRET_KEY)
}

function getClient() {
  if (!isIntaSendConfigured()) {
    throw new Error('IntaSend is not configured. Add INTASEND_PUBLISHABLE_KEY and INTASEND_SECRET_KEY.')
  }

  return new IntaSend(
    env.INTASEND_PUBLISHABLE_KEY,
    env.INTASEND_SECRET_KEY,
    env.INTASEND_TEST_MODE !== 'false',
  )
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] ?? 'EventSlot'
  const lastName = parts.slice(1).join(' ') || 'Customer'
  return { firstName, lastName }
}

export function normalizeMpesaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.startsWith('254')) return digits
  return digits
}

export function extractInvoiceId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const invoice = data.invoice && typeof data.invoice === 'object' ? data.invoice as Record<string, unknown> : null

  const directInvoiceId = typeof data.invoice_id === 'string' ? data.invoice_id : null
  const nestedInvoiceId = typeof invoice?.invoice_id === 'string' ? invoice.invoice_id : null
  const nestedId = typeof invoice?.id === 'string' ? invoice.id : null
  const directId = typeof data.id === 'string' ? data.id : null

  return nestedInvoiceId ?? nestedId ?? directInvoiceId ?? directId
}

export function extractInvoiceState(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const invoice = data.invoice && typeof data.invoice === 'object' ? data.invoice as Record<string, unknown> : null

  const nestedState = typeof invoice?.state === 'string' ? invoice.state : null
  const directState = typeof data.state === 'string' ? data.state : null
  return nestedState ?? directState
}

export function extractApiRef(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const invoice = data.invoice && typeof data.invoice === 'object' ? data.invoice as Record<string, unknown> : null

  const nestedApiRef = typeof invoice?.api_ref === 'string' ? invoice.api_ref : null
  const directApiRef = typeof data.api_ref === 'string' ? data.api_ref : null
  return nestedApiRef ?? directApiRef
}

export function extractProviderReference(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const invoice = data.invoice && typeof data.invoice === 'object' ? data.invoice as Record<string, unknown> : null

  const mpesaReference = typeof invoice?.mpesa_reference === 'string' ? invoice.mpesa_reference : null
  const providerReference = typeof data.provider_reference === 'string' ? data.provider_reference : null
  return mpesaReference ?? providerReference
}

export async function startIntaSendStkPush(input: {
  apiRef: string
  amountKes: number
  phone: string
  email: string
  name: string
}) {
  const client = getClient()
  const collection = client.collection()
  const normalizedPhone = normalizeMpesaPhone(input.phone)
  const { firstName, lastName } = splitName(input.name)

  const response = await collection.mpesaStkPush({
    first_name: firstName,
    last_name: lastName,
    name: input.name,
    email: input.email,
    host: env.APP_URL,
    amount: input.amountKes,
    phone_number: normalizedPhone,
    api_ref: input.apiRef,
  })

  const invoiceId = extractInvoiceId(response)
  if (!invoiceId) {
    throw new Error('IntaSend did not return an invoice ID.')
  }

  return {
    raw: response,
    invoiceId,
    normalizedPhone,
  }
}

export async function getIntaSendPaymentStatus(invoiceId: string): Promise<IntaSendCollectionStatus> {
  const client = getClient()
  const collection = client.collection()
  return await collection.status(invoiceId) as IntaSendCollectionStatus
}

export function isValidIntaSendWebhookChallenge(challenge: unknown) {
  if (!env.INTASEND_WEBHOOK_CHALLENGE) return true
  return typeof challenge === 'string' && challenge === env.INTASEND_WEBHOOK_CHALLENGE
}
