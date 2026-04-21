"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { TUTORIAL_STEPS } from "@/lib/tutorialSteps"

export function useTutorial() {
  const router = useRouter()
  const [isActive, setIsActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const currentStep = TUTORIAL_STEPS[currentStepIndex]

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const res = await fetch("/api/onboarding")
        if (!res.ok) return
        const data = await res.json()
        if (!data.tutorialCompleted && !data.tutorialSkipped) {
          setTimeout(() => setIsActive(true), 1000)
        }
      } catch {
        // Silently fail so dashboard UX is unaffected.
      } finally {
        setIsLoading(false)
      }
    }

    checkOnboarding()
  }, [])

  useEffect(() => {
    if (!isActive || !currentStep) return

    if (currentStep.target === "body" || currentStep.position === "center") {
      setTargetRect(null)
      return
    }

    const updateRect = () => {
      const el = document.querySelector(currentStep.target)
      if (el) {
        setTargetRect(el.getBoundingClientRect())
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
      }
    }

    updateRect()
    window.addEventListener("resize", updateRect)
    window.addEventListener("scroll", updateRect, true)
    return () => {
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("scroll", updateRect, true)
    }
  }, [currentStep, currentStepIndex, isActive])

  const markStep = useCallback(async (stepId: string) => {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId }),
    }).catch(() => {})
  }, [])

  const handleComplete = useCallback(async () => {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    }).catch(() => {})
    setIsActive(false)
  }, [])

  const handleNext = useCallback(async () => {
    if (!currentStep) return
    await markStep(currentStep.id)
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex(i => i + 1)
    } else {
      await handleComplete()
    }
  }, [currentStep, currentStepIndex, handleComplete, markStep])

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(i => i - 1)
    }
  }, [currentStepIndex])

  const handleSkip = useCallback(async () => {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skipped: true }),
    }).catch(() => {})
    setIsActive(false)
  }, [])

  const handleAction = useCallback(async () => {
    if (!currentStep) return

    await markStep(currentStep.id)

    if (currentStep.actionRoute) {
      if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
        setCurrentStepIndex(i => i + 1)
      } else {
        await handleComplete()
      }
      router.push(currentStep.actionRoute)
      return
    }

    await handleNext()
  }, [currentStep, currentStepIndex, handleComplete, handleNext, markStep, router])

  const restartTutorial = useCallback(() => {
    setCurrentStepIndex(0)
    setIsActive(true)
  }, [])

  return {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    targetRect,
    isLoading,
    handleNext,
    handleBack,
    handleSkip,
    handleComplete,
    handleAction,
    restartTutorial,
  }
}
