import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasAdminAccess } from "@/lib/isAdmin"
import prisma from "@/lib/prisma"

const FEATURE_NAME = "EventSlot Play Store early tester"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const [testers, progressRows, settings] = await Promise.all([
      prisma.featureInterest.findMany({
      where: { featureName: FEATURE_NAME },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
      }),
      prisma.appTesterProgress.findMany({
        select: {
          id: true,
          email: true,
          createdAt: true,
          inviteSentAt: true,
          installedAt: true,
          notes: true,
          updatedAt: true,
        },
      }),
      prisma.appTesterSettings.upsert({
        where: { id: "default" },
        create: { id: "default" },
        update: {},
      }),
    ])
    const progressByEmail = new Map(progressRows.map((row) => [row.email, row]))
    const signupByEmail = new Map(testers.map((tester) => [tester.email, tester]))
    const testerEmails = Array.from(new Set([...testers.map((tester) => tester.email), ...progressRows.map((row) => row.email)]))
    const testersWithProgress = testerEmails.map((email) => {
      const tester = signupByEmail.get(email)
      const progress = progressByEmail.get(email)
      return {
        id: tester?.id ?? progress?.id ?? email,
        email,
        createdAt: tester?.createdAt ?? progress?.createdAt ?? new Date(),
        inviteSentAt: progress?.inviteSentAt ?? null,
        installedAt: progress?.installedAt ?? null,
        notes: progress?.notes ?? null,
        progressUpdatedAt: progress?.updatedAt ?? null,
      }
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      testers: testersWithProgress,
      summary: {
        total: testersWithProgress.length,
        invited: testersWithProgress.filter((tester) => tester.inviteSentAt).length,
        installed: testersWithProgress.filter((tester) => tester.installedAt).length,
        latestSignupAt: testers[0]?.createdAt ?? null,
      },
      settings: {
        promptEnabled: settings.promptEnabled,
        optInUrlConfigured: Boolean(process.env.PLAY_TESTING_OPT_IN_URL?.trim()),
      },
      playConsole: {
        track: "Internal testing",
        note: "Add these emails to the Play Console tester list, then send the opt-in testing link from Play Console.",
      },
    })
  } catch (error) {
    console.error("[admin/app-testers] GET error:", error)
    return NextResponse.json({ error: "Unable to load app testers." }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const action = typeof body?.action === "string" ? body.action : ""

    if (action === "setPromptEnabled") {
      const promptEnabled = Boolean(body?.promptEnabled)
      const settings = await prisma.appTesterSettings.upsert({
        where: { id: "default" },
        create: { id: "default", promptEnabled },
        update: { promptEnabled },
      })
      return NextResponse.json({ ok: true, settings })
    }

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid tester email is required." }, { status: 400 })
    }

    if (action === "markInviteSent") {
      const progress = await prisma.appTesterProgress.upsert({
        where: { email },
        create: { email, inviteSentAt: new Date() },
        update: { inviteSentAt: new Date() },
      })
      return NextResponse.json({ ok: true, progress })
    }

    if (action === "markInstalled") {
      const progress = await prisma.appTesterProgress.upsert({
        where: { email },
        create: { email, installedAt: new Date() },
        update: { installedAt: new Date() },
      })
      return NextResponse.json({ ok: true, progress })
    }

    if (action === "clearInstalled") {
      const progress = await prisma.appTesterProgress.upsert({
        where: { email },
        create: { email, installedAt: null },
        update: { installedAt: null },
      })
      return NextResponse.json({ ok: true, progress })
    }

    return NextResponse.json({ error: "Unsupported tester action." }, { status: 400 })
  } catch (error) {
    console.error("[admin/app-testers] PATCH error:", error)
    return NextResponse.json({ error: "Unable to update app tester progress." }, { status: 500 })
  }
}
