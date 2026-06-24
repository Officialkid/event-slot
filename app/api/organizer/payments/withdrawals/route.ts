import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getOrganizerWithdrawableBalance } from "@/lib/organizerPayments"
import { sendBankPayout, sendMpesaPayout, sendPaybillPayout } from "@/services/payouts"

const payloadSchema = z.object({
  currency: z.enum(["KES", "USD"]),
  amount: z.number().finite().positive(),
  method: z.enum(["MPESA", "PAYBILL", "BANK"]),
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
  return method === "BANK" ? "1-3 business days" : "Instant"
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

    const available = await getOrganizerWithdrawableBalance(session.user.id, currency)
    if (amount > available) {
      return NextResponse.json({ error: "Withdrawal amount exceeds your available balance." }, { status: 400 })
    }

    const destinationLabel = buildDestinationLabel(method, destination)
    const narrative = `EventSlot payout ${currency} ${amount}`

    let providerRef: string | null = null
    try {
      if (method === "MPESA") {
        if (!destination.mpesaPhone?.trim()) {
          return NextResponse.json({ error: "M-Pesa phone number is required." }, { status: 400 })
        }
        const response = await sendMpesaPayout({
          phone: destination.mpesaPhone.trim(),
          amount,
          currency,
          narrative,
        })
        providerRef = response.trackingId
      } else if (method === "PAYBILL") {
        if (!destination.paybillNumber?.trim() || !destination.paybillAccountNumber?.trim()) {
          return NextResponse.json({ error: "Complete the PayBill destination details." }, { status: 400 })
        }
        const response = await sendPaybillPayout({
          paybillNumber: destination.paybillNumber.trim(),
          accountNumber: destination.paybillAccountNumber.trim(),
          amount,
          currency,
          narrative,
        })
        providerRef = response.trackingId
      } else {
        if (!destination.bankName?.trim() || !destination.bankAccountNumber?.trim() || !destination.bankAccountName?.trim() || !destination.bankBranchCode?.trim()) {
          return NextResponse.json({ error: "Complete the bank transfer details." }, { status: 400 })
        }
        const response = await sendBankPayout({
          bankName: destination.bankName.trim(),
          accountNumber: destination.bankAccountNumber.trim(),
          accountName: destination.bankAccountName.trim(),
          branchCode: destination.bankBranchCode.trim(),
          amount,
          currency,
          narrative,
        })
        providerRef = response.trackingId
      }
    } catch (error) {
      console.error("[organizer-withdrawals] payout provider error:", error)
      const message = error instanceof Error ? error.message : "Withdrawal provider rejected the request."
      return NextResponse.json({ error: message }, { status: 502 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.organiserBalance.upsert({
        where: { organiserId: session.user.id },
        create: currency === "USD"
          ? { organiserId: session.user.id, withdrawnUSD: amount }
          : { organiserId: session.user.id, withdrawnKES: amount },
        update: currency === "USD"
          ? { withdrawnUSD: { increment: amount } }
          : { withdrawnKES: { increment: amount } },
      })

      await tx.withdrawal.create({
        data: {
          organiserId: session.user.id,
          amount,
          currency,
          method,
          destination: destinationLabel,
          status: "PROCESSING",
          providerRef,
        },
      })
    })

    return NextResponse.json({
      success: true,
      reference: providerRef ?? `WD-${Date.now().toString().slice(-6)}`,
      destinationLabel,
      processingTime: processingTime(method),
    })
  } catch (error) {
    console.error("[organizer-withdrawals] POST error:", error)
    return NextResponse.json({ error: "Withdrawal failed. Please try again." }, { status: 500 })
  }
}
