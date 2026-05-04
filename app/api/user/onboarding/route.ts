import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type OnboardingAction = "complete" | "skip" | "reset"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      onboardingCompleted: true,
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

  return NextResponse.json({ onboardingCompleted, onboardingSkipped })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { action } = (await request.json()) as { action?: OnboardingAction }
  if (action !== "complete" && action !== "skip" && action !== "reset") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
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

  return NextResponse.json({ success: true })
}
