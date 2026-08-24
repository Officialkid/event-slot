import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { ratelimit } from "@/lib/ratelimit"
import { sendAppTesterSignupEmail } from "@/lib/email"

const FEATURE_NAME = "EventSlot Play Store early tester"
const PLAY_TESTING_OPT_IN_URL = process.env.PLAY_TESTING_OPT_IN_URL?.trim()

export async function POST(req: NextRequest) {
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
    const { success } = await ratelimit.limit(`app-tester:${ip}`)
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 })
    }

    const body = await req.json()
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }

    const existingInterest = await prisma.featureInterest.findUnique({
      where: { email_featureName: { email, featureName: FEATURE_NAME } },
      select: { id: true },
    })

    await prisma.featureInterest.upsert({
      where: { email_featureName: { email, featureName: FEATURE_NAME } },
      create: { email, featureName: FEATURE_NAME },
      update: {},
    })
    await prisma.appTesterProgress.upsert({
      where: { email },
      create: {
        email,
        optInLinkSentAt: PLAY_TESTING_OPT_IN_URL ? new Date() : null,
        inviteSentAt: PLAY_TESTING_OPT_IN_URL ? new Date() : null,
      },
      update: PLAY_TESTING_OPT_IN_URL ? { optInLinkSentAt: new Date(), inviteSentAt: new Date() } : {},
    })

    if (!existingInterest) {
      const adminUsers = await prisma.user.findMany({
        where: { isAdmin: true, email: { not: null } },
        select: { id: true },
      })

      if (adminUsers.length > 0) {
        await prisma.notification.createMany({
          data: adminUsers.map((admin) => ({
            userId: admin.id,
            type: "PLATFORM",
            title: "New app tester signup",
            message: `${email} joined the EventSlot Play Store tester registry.`,
            link: "/admin/app-testers",
          })),
        })
      }
    }

    let emailSent = true
    try {
      await sendAppTesterSignupEmail({ to: email, optInUrl: PLAY_TESTING_OPT_IN_URL })
    } catch (error) {
      emailSent = false
      console.error("[app-testers] confirmation email failed:", error)
    }

    return NextResponse.json({ ok: true, emailSent, optInUrlAvailable: Boolean(PLAY_TESTING_OPT_IN_URL) })
  } catch (error) {
    console.error("[app-testers] POST error:", error)
    return NextResponse.json({ error: "Could not save your tester request right now." }, { status: 500 })
  }
}
