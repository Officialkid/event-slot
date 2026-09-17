import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string }

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: "Please provide a valid email address" }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      if (existingUser.marketingConsent) {
        return NextResponse.json({
          success: true,
          message: "You are already subscribed to EventSlot updates!",
        })
      }

      await prisma.user.update({
        where: { id: existingUser.id },
        data: { marketingConsent: true },
      })

      return NextResponse.json({
        success: true,
        message: "Welcome back! Your subscription has been restored.",
      })
    }

    // Create a subscriber user record
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        marketingConsent: true,
        consentSystemEmails: true,
        name: normalizedEmail.split("@")[0],
      },
    })

    return NextResponse.json({
      success: true,
      message: "You're successfully subscribed to EventSlot updates!",
    })
  } catch (error) {
    console.error("[newsletter/subscribe] Error:", error)
    return NextResponse.json(
      { error: "Failed to subscribe. Please try again later." },
      { status: 500 }
    )
  }
}
