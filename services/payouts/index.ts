import * as paystackPayouts from "./paystack"
import * as intasendPayouts from "./intrasend"
import type { SupportedCurrency } from "@/lib/organizerPayments"

const usePaystack = () => (process.env.PAYOUT_PROVIDER || "paystack").toLowerCase() === "paystack"

export async function sendMpesaPayout(params: {
  phone: string
  amount: number
  currency: SupportedCurrency
  narrative: string
  reference?: string
}) {
  if (usePaystack()) {
    return paystackPayouts.sendMpesaPayout(params)
  }
  return intasendPayouts.sendMpesaPayout(params)
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
  if (usePaystack()) {
    return paystackPayouts.sendBankPayout(params)
  }
  return intasendPayouts.sendBankPayout(params)
}

export async function sendPaybillPayout(params: {
  paybillNumber: string
  accountNumber: string
  amount: number
  currency: SupportedCurrency
  narrative: string
}) {
  if (usePaystack()) {
    return paystackPayouts.sendPaybillPayout(params)
  }
  return intasendPayouts.sendPaybillPayout(params)
}
