import IntaSend from "intasend-node"
import { env } from "@/lib/env"
import type { SupportedCurrency } from "@/lib/organizerPayments"

export type PayoutTransferResponse = {
  tracking_id?: string | null
  reference?: string | null
  invoice_id?: string | null
  [key: string]: unknown
}

type IntaSendTransfersClient = {
  transfers(): {
    mpesa(args: {
      currency: SupportedCurrency
      transactions: Array<{ name: string; account: string; amount: number }>
    }): Promise<unknown>
    paybill(args: {
      currency: SupportedCurrency
      transactions: Array<{
        name: string
        account: string
        amount: number
        provider: string
      }>
    }): Promise<unknown>
    bank(args: {
      currency: SupportedCurrency
      transactions: Array<{
        name: string
        account: string
        amount: number
        bank_name: string
        branch_code: string
        narrative: string
      }>
    }): Promise<unknown>
  }
}

function getClient() {
  if (!env.INTASEND_PUBLISHABLE_KEY || !env.INTASEND_SECRET_KEY) {
    throw new Error("IntaSend payout credentials are missing.")
  }

  return new IntaSend(
    env.INTASEND_PUBLISHABLE_KEY,
    env.INTASEND_SECRET_KEY,
    env.INTASEND_TEST_MODE !== "false"
  ) as unknown as IntaSendTransfersClient
}

function readTrackingId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null
  const data = response as Record<string, unknown>
  if (typeof data.tracking_id === "string") return data.tracking_id
  if (typeof data.reference === "string") return data.reference
  if (typeof data.invoice_id === "string") return data.invoice_id
  return null
}

export async function sendMpesaPayout(params: {
  phone: string
  amount: number
  currency: SupportedCurrency
  narrative: string
}) {
  const response = await getClient().transfers().mpesa({
    currency: params.currency,
    transactions: [
      {
        name: params.narrative,
        account: params.phone,
        amount: params.amount,
      },
    ],
  })

  return {
    raw: response as PayoutTransferResponse,
    trackingId: readTrackingId(response),
  }
}

export async function sendPaybillPayout(params: {
  paybillNumber: string
  accountNumber: string
  amount: number
  currency: SupportedCurrency
  narrative: string
}) {
  const response = await getClient().transfers().paybill({
    currency: params.currency,
    transactions: [
      {
        name: params.narrative,
        account: params.accountNumber,
        amount: params.amount,
        provider: params.paybillNumber,
      },
    ],
  })

  return {
    raw: response as PayoutTransferResponse,
    trackingId: readTrackingId(response),
  }
}

export async function sendBankPayout(params: {
  bankName: string
  accountNumber: string
  accountName: string
  branchCode: string
  amount: number
  currency: SupportedCurrency
  narrative: string
}) {
  const response = await getClient().transfers().bank({
    currency: params.currency,
    transactions: [
      {
        name: params.accountName || params.narrative,
        account: params.accountNumber,
        amount: params.amount,
        bank_name: params.bankName,
        branch_code: params.branchCode,
        narrative: params.narrative,
      },
    ],
  })

  return {
    raw: response as PayoutTransferResponse,
    trackingId: readTrackingId(response),
  }
}
