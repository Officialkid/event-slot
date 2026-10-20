import type { SupportedCurrency } from "@/lib/organizerPayments"
import { toMinorUnits } from "@/lib/financialLedger"
import {
  createPaystackTransferRecipient,
  initiatePaystackTransfer,
} from "@/lib/paystackPayouts"
import crypto from "crypto"

type PayoutParams = {
  amount: number
  currency: SupportedCurrency
  narrative: string
  reference?: string
}

export type PayoutResponse = {
  raw: unknown
  trackingId: string
  transferCode?: string
  recipientCode?: string
}

/**
 * Sends an M-Pesa mobile money payout via Paystack Transfers.
 */
export async function sendMpesaPayout(
  params: PayoutParams & { phone: string }
): Promise<PayoutResponse> {
  const reference = params.reference?.trim() || `trf_mp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
  const amountMinorUnits = toMinorUnits(params.amount, params.currency)

  // 1. Create transfer recipient on Paystack
  const recipient = await createPaystackTransferRecipient({
    type: "mobile_money",
    name: params.narrative,
    accountNumber: params.phone,
    currency: params.currency,
    description: `M-Pesa payout for ${params.phone}`,
  })

  // 2. Initiate payout transfer
  const transfer = await initiatePaystackTransfer({
    amountMinorUnits,
    recipientCode: recipient.recipientCode,
    reference,
    reason: params.narrative,
    currency: params.currency,
  })

  return {
    raw: transfer.raw,
    trackingId: transfer.reference,
    transferCode: transfer.transferCode,
    recipientCode: recipient.recipientCode,
  }
}

/**
 * Sends a bank transfer payout via Paystack Transfers.
 */
export async function sendBankPayout(
  params: PayoutParams & {
    bankName: string
    accountNumber: string
    accountName: string
    branchCode: string
  }
): Promise<PayoutResponse> {
  const reference = params.reference?.trim() || `trf_bk_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
  const amountMinorUnits = toMinorUnits(params.amount, params.currency)

  // 1. Create bank transfer recipient on Paystack
  const recipient = await createPaystackTransferRecipient({
    type: "basa",
    name: params.accountName,
    accountNumber: params.accountNumber,
    bankCode: params.branchCode,
    currency: params.currency,
    description: `Bank payout to ${params.bankName} (${params.accountName})`,
  })

  // 2. Initiate bank transfer
  const transfer = await initiatePaystackTransfer({
    amountMinorUnits,
    recipientCode: recipient.recipientCode,
    reference,
    reason: params.narrative,
    currency: params.currency,
  })

  return {
    raw: transfer.raw,
    trackingId: transfer.reference,
    transferCode: transfer.transferCode,
    recipientCode: recipient.recipientCode,
  }
}

/**
 * Paybill payout limitation notice:
 * Paystack in Kenya supports M-Pesa Person-to-Person (B2C) and Bank transfers.
 * Paybill B2B disbursements are not natively supported through Paystack's standard Transfers API.
 */
export async function sendPaybillPayout(
  params: PayoutParams & { paybillNumber: string; accountNumber: string }
): Promise<PayoutResponse> {
  throw new Error(
    "Paystack does not support Paybill B2B transfers in Kenya. Please select M-Pesa or Bank transfer for withdrawal."
  )
}
