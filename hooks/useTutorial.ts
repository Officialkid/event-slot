"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { TUTORIAL_STEPS } from "@/lib/tutorialSteps"

export function useTutorial() {
  const [isActive, setIsActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSections, setSelectedSections] = useState<string[] | null>(null)

  const filteredSteps = useMemo(() => {
    if (!selectedSections || selectedSections.length === 0) {
      return TUTORIAL_STEPS
    }
    const next = TUTORIAL_STEPS.filter(step => selectedSections.includes(step.sectionId))
    return next.length > 0 ? next : TUTORIAL_STEPS
  }, [selectedSections])

  const currentStep = filteredSteps[currentStepIndex]

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const res = await fetch("/api/user/onboarding")
        if (!res.ok) return
        const data = await res.json()
        if (!data.onboardingCompleted && !data.onboardingSkipped) {
          setSelectedSections(null)
          setCurrentStepIndex(0)
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
    if (!isActive) return
    if (currentStep) return
    setIsActive(false)
  }, [currentStep, isActive])

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
    await Promise.all([
      fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      }).catch(() => {}),
      fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      }).catch(() => {}),
    ])
    setIsActive(false)
  }, [])

  const handleNext = useCallback(async () => {
    if (!currentStep) return
    await markStep(currentStep.id)
    if (currentStepIndex < filteredSteps.length - 1) {
      setCurrentStepIndex(i => i + 1)
    } else {
      await handleComplete()
    }
  }, [currentStep, currentStepIndex, filteredSteps.length, handleComplete, markStep])

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(i => i - 1)
    }
  }, [currentStepIndex])

  const handleSkip = useCallback(async () => {
    await Promise.all([
      fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      }).catch(() => {}),
      fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipped: true }),
      }).catch(() => {}),
    ])
    setIsActive(false)
  }, [])

  const handleAction = useCallback(async () => {
    if (!currentStep) return

    await markStep(currentStep.id)
    await handleNext()
  }, [currentStep, handleNext, markStep])

  const restartTutorial = useCallback(() => {
    setSelectedSections(null)
    setCurrentStepIndex(0)
    setIsActive(true)
  }, [])

  const startTour = useCallback((sections: string[]) => {
    setSelectedSections(sections)
    setCurrentStepIndex(0)
    setIsActive(true)
  }, [])

  return {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps: filteredSteps.length,
    targetRect,
    isLoading,
    handleNext,
    handleBack,
    handleSkip,
    handleComplete,
    handleAction,
    restartTutorial,
    startTour,
  }
}
