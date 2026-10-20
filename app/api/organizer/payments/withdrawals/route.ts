import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { sendBankPayout, sendMpesaPayout, sendPaybillPayout } from "@/services/payouts"
import { verifyOtpForEmail } from "@/lib/emailOtp"
import {
  requestOrganizerWithdrawal,
  InsufficientSettledBalanceError,
} from "@/lib/withdrawalService"
import type { SupportedCurrency } from "@/lib/organizerPayments"

const payloadSchema = z.object({
  currency: z.enum(["KES", "USD"]),
  amount: z.number().finite().positive(),
  method: z.enum(["MPESA", "PAYBILL", "BANK"]),
  paymentPin: z.string().regex(/^\d{4,6}$/),
  emailOtp: z.string().regex(/^\d{6}$/),
  destination: z.object({
    mpesaPhone: z.string().optional(),
    mpesaAccountName: z.string().optional(),
    paybillNumber: z.string().optional(),
    paybillAccountNumber: z.string().optional(),
    paybillBusinessName: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankAccountName: z.string().optional(),
    bankBranchCode: z.string().optional(),
  }),
  clientReference: z.string().max(100).optional(),
})

function buildDestinationLabel(
  method: "MPESA" | "PAYBILL" | "BANK",
  destination: z.infer<typeof payloadSchema>["destination"]
) {
  if (method === "MPESA") return destination.mpesaPhone?.trim() || "M-Pesa"
  if (method === "PAYBILL") return `${destination.paybillNumber?.trim() || "PayBill"} / ${destination.paybillAccountNumber?.trim() || "Account"}`
  return `${destination.bankName?.trim() || "Bank"} / ${destination.bankAccountNumber?.trim() || "Account"}`
}

function processingTime(method: "MPESA" | "PAYBILL" | "BANK") {
  return method === "BANK" ? "1-3 business days" : "Instant to 1 business day"
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = payloadSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid withdrawal request." }, { status: 400 })
    }

    const { currency, amount, method, destination } = parsed.data
    const minimum = currency === "USD" ? 1 : 100
    if (amount < minimum) {
      return NextResponse.json({ error: `Minimum withdrawal is ${currency} ${minimum}.` }, { status: 400 })
    }

    // Verify User security credentials (PIN & 2FA)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        paymentPinHash: true,
        paymentPinEnabled: true,
        twoFactorEnabled: true,
      },
    })

    if (!user?.paymentPinEnabled || !user.paymentPinHash) {
      return NextResponse.json({ error: "Set your payments PIN before requesting withdrawals." }, { status: 400 })
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json({ error: "Turn on account 2FA in Profile before requesting withdrawals." }, { status: 400 })
    }

    const validPin = await bcrypt.compare(parsed.data.paymentPin, user.paymentPinHash)
    if (!validPin) {
      return NextResponse.json({ error: "The payments PIN you entered is incorrect." }, { status: 403 })
    }

    if (!user.email) {
      return NextResponse.json({ error: "Your account needs an email address before withdrawals can be approved." }, { status: 400 })
    }

    const otpRecord = await verifyOtpForEmail(user.email, parsed.data.emailOtp)
    if (!otpRecord) {
      return NextResponse.json({ error: "Invalid or expired withdrawal verification code." }, { status: 403 })
    }

    const destinationLabel = buildDestinationLabel(method, destination)
    const narrative = `EventSlot payout ${currency} ${amount}`
    const headerIdempotencyKey = req.headers.get("x-idempotency-key") || req.headers.get("idempotency-key")
    const clientReference = parsed.data.clientReference || headerIdempotencyKey?.trim() || undefined

    // Concurrency-safe atomic reservation with payout dispatch
    const result = await requestOrganizerWithdrawal(
      {
        organizerId: session.user.id,
        amount,
        currency,
        method,
        destination: destinationLabel,
        destinationPayload: {
          phone: destination.mpesaPhone?.trim(),
          accountNumber: destination.bankAccountNumber?.trim() || destination.paybillAccountNumber?.trim(),
          bankName: destination.bankName?.trim(),
          bankCode: destination.bankBranchCode?.trim(),
          accountName: destination.bankAccountName?.trim(),
        },
        narrative,
        clientReference,
      },
      async ({ amountMinorUnits, reference }) => {
        if (method === "MPESA") {
          if (!destination.mpesaPhone?.trim()) {
            throw new Error("M-Pesa phone number is required.")
          }
          const response = await sendMpesaPayout({
            phone: destination.mpesaPhone.trim(),
            amount,
            currency: currency as SupportedCurrency,
            narrative,
          })
          return {
            reference: response.trackingId || reference,
            transferCode: (response as any).transferCode,
            recipientCode: (response as any).recipientCode,
          }
        } else if (method === "PAYBILL") {
          if (!destination.paybillNumber?.trim() || !destination.paybillAccountNumber?.trim()) {
            throw new Error("Complete the PayBill destination details.")
          }
          const response = await sendPaybillPayout({
            paybillNumber: destination.paybillNumber.trim(),
            accountNumber: destination.paybillAccountNumber.trim(),
            amount,
            currency: currency as SupportedCurrency,
            narrative,
          })
          return {
            reference: response.trackingId || reference,
            transferCode: (response as any).transferCode,
            recipientCode: (response as any).recipientCode,
          }
        } else {
          if (
            !destination.bankName?.trim() ||
            !destination.bankAccountNumber?.trim() ||
            !destination.bankAccountName?.trim() ||
            !destination.bankBranchCode?.trim()
          ) {
            throw new Error("Complete the bank transfer details.")
          }
          const response = await sendBankPayout({
            bankName: destination.bankName.trim(),
            accountNumber: destination.bankAccountNumber.trim(),
            accountName: destination.bankAccountName.trim(),
            branchCode: destination.bankBranchCode.trim(),
            amount,
            currency: currency as SupportedCurrency,
            narrative,
          })
          return {
            reference: response.trackingId || reference,
            transferCode: (response as any).transferCode,
            recipientCode: (response as any).recipientCode,
          }
        }
      }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.message || "Withdrawal failed." }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      reference: result.reference,
      destinationLabel,
      status: result.status,
      processingTime: processingTime(method),
    })
  } catch (error) {
    if (error instanceof InsufficientSettledBalanceError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("[organizer-withdrawals] POST error:", error)
    const msg = error instanceof Error ? error.message : "Withdrawal failed. Please try again."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
