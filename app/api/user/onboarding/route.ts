import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type OnboardingAction = "complete" | "skip" | "reset"

function normalizeStep(rawStep: unknown): 0 | 1 | 2 | 3 {
  const value = typeof rawStep === "number" ? rawStep : Number(rawStep)
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 3) return 3
  return value === 2 ? 2 : 1
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ onboardingCompleted: true, onboardingStep: 3, onboardingSkipped: true })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        onboardingCompleted: true,
        onboardingStep: true,
        onboardingSkipped: true,
        onboarding: {
          select: {
            tutorialCompleted: true,
            tutorialSkipped: true,
          },
        },
      },
    })

    const onboardingCompleted = Boolean(user?.onboardingCompleted || user?.onboarding?.tutorialCompleted)
    const onboardingSkipped = Boolean(user?.onboardingSkipped || user?.onboarding?.tutorialSkipped)
    const onboardingStep = onboardingCompleted ? 3 : normalizeStep(user?.onboardingStep)

    return NextResponse.json({ onboardingCompleted, onboardingSkipped, onboardingStep })
  } catch {
    // Schema drift (e.g. pending migration) — return safe defaults so the dashboard renders
    return NextResponse.json({ onboardingCompleted: false, onboardingSkipped: false, onboardingStep: 0 })
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = (await request.json()) as { action?: OnboardingAction; step?: number }

  try {
    if (payload.step !== undefined) {
      const nextStep = normalizeStep(payload.step)
      const completed = nextStep >= 3

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          onboardingStep: nextStep,
          onboardingCompleted: completed,
          onboardingSkipped: false,
        },
      })

      return NextResponse.json({ success: true, completed })
    }

    const action = payload.action
    if (action !== "complete" && action !== "skip" && action !== "reset") {
      return NextResponse.json({ error: "Invalid action or step" }, { status: 400 })
    }

    const onboardingCompleted = action === "complete"
    const onboardingSkipped = action === "skip"
    const isReset = action === "reset"

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          onboardingCompleted: isReset ? false : onboardingCompleted,
          onboardingSkipped: isReset ? false : onboardingSkipped,
          onboardingStep: isReset ? 0 : onboardingCompleted ? 3 : 0,
        },
      }),
      prisma.userOnboarding.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          tutorialCompleted: isReset ? false : onboardingCompleted,
          tutorialSkipped: isReset ? false : onboardingSkipped,
          completedAt: onboardingCompleted ? new Date() : null,
          ...(isReset ? { completedSteps: [] } : {}),
        },
        update: {
          tutorialCompleted: isReset ? false : onboardingCompleted,
          tutorialSkipped: isReset ? false : onboardingSkipped,
          completedAt: onboardingCompleted ? new Date() : null,
          ...(isReset ? { completedSteps: [] } : {}),
        },
      }),
    ])

    return NextResponse.json({ success: true, completed: onboardingCompleted })
  } catch {
    // Schema drift — gracefully degrade so client doesn't break
    return NextResponse.json({ success: true, completed: false })
  }
}
