import * as paystackPayouts from "./paystack"
import type { SupportedCurrency } from "@/lib/organizerPayments"

/**
 * EventSlot Payout Adapter (Paystack Only)
 * IntraSend payout processing has been decommissioned.
 * All payouts (M-Pesa and Bank) are routed strictly through Paystack Transfers.
 */

export async function sendMpesaPayout(params: {
  phone: string
  amount: number
  currency: SupportedCurrency
  narrative: string
  reference?: string
}) {
  return paystackPayouts.sendMpesaPayout(params)
}

export async function sendBankPayout(params: {
  bankName: string
  accountNumber: string
  accountName: string
  branchCode: string
  amount: number
  currency: SupportedCurrency
  narrative: string
  reference?: string
}) {
  return paystackPayouts.sendBankPayout(params)
}

export async function sendPaybillPayout(params: {
  paybillNumber: string
  accountNumber: string
  amount: number
  currency: SupportedCurrency
  narrative: string
  reference?: string
}) {
  return paystackPayouts.sendPaybillPayout(params)
}
