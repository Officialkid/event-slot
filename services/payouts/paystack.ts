import type { SupportedCurrency } from "@/lib/organizerPayments"

type UnsupportedParams = {
  amount: number
  currency: SupportedCurrency
  narrative: string
}

export async function sendMpesaPayout(params: UnsupportedParams & { phone: string }) {
  throw new Error("Paystack payout provider is not wired yet. Switch services/payouts/index.ts when the implementation is ready.")
}

export async function sendPaybillPayout(params: UnsupportedParams & { paybillNumber: string; accountNumber: string }) {
  throw new Error("Paystack payout provider is not wired yet. Switch services/payouts/index.ts when the implementation is ready.")
}

export async function sendBankPayout(params: UnsupportedParams & { bankName: string; accountNumber: string; accountName: string; branchCode: string }) {
  throw new Error("Paystack payout provider is not wired yet. Switch services/payouts/index.ts when the implementation is ready.")
}
