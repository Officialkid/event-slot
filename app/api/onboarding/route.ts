import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type OnboardingPatchBody = {
  stepId?: string
  completed?: boolean
  skipped?: boolean
  completedSteps?: string[]
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const state = await prisma.userOnboarding.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id },
      select: {
        completedSteps: true,
        tutorialCompleted: true,
        tutorialSkipped: true,
      },
    })

    return NextResponse.json(state)
  } catch {
    return NextResponse.json({ error: "Failed to fetch onboarding state" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as OnboardingPatchBody
    const existing = await prisma.userOnboarding.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id },
      select: {
        completedSteps: true,
      },
    })

    const nextSteps =
      Array.isArray(body.completedSteps)
        ? Array.from(new Set(body.completedSteps.filter(Boolean)))
        : body.stepId
          ? Array.from(new Set([...existing.completedSteps, body.stepId]))
          : existing.completedSteps

    const tutorialCompleted = body.completed === true
      ? true
      : body.completed === false
        ? false
        : undefined

    const tutorialSkipped = body.skipped === true
      ? true
      : body.skipped === false
        ? false
        : undefined

    const state = await prisma.userOnboarding.update({
      where: { userId: session.user.id },
      data: {
        completedSteps: nextSteps,
        ...(tutorialCompleted !== undefined ? { tutorialCompleted } : {}),
        ...(tutorialSkipped !== undefined ? { tutorialSkipped } : {}),
        ...(tutorialCompleted !== undefined
          ? { completedAt: tutorialCompleted ? new Date() : null }
          : {}),
      },
      select: {
        completedSteps: true,
        tutorialCompleted: true,
        tutorialSkipped: true,
      },
    })

    return NextResponse.json(state)
  } catch {
    return NextResponse.json({ error: "Failed to update onboarding state" }, { status: 500 })
  }
}
