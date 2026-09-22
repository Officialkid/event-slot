"use client"

import React from "react"

export type RegistrationStepId = "welcome" | "personal" | "questions" | "review"

export interface RegistrationStep {
  id: RegistrationStepId
  title: string
  shortLabel: string
}

interface RegistrationStepIndicatorProps {
  steps: RegistrationStep[]
  currentStepIndex: number
  onStepClick?: (index: number) => void
}

export function RegistrationStepIndicator({
  steps,
  currentStepIndex,
  onStepClick,
}: RegistrationStepIndicatorProps) {
  // Only show when past the welcome screen
  if (currentStepIndex <= 0) return null

  const progressPercent = Math.round((currentStepIndex / (steps.length - 1)) * 100)
  const currentStep = steps[currentStepIndex]

  return (
    <div className="w-full mb-6 space-y-2 select-none" aria-label="Registration progress">
      <div className="flex items-center justify-between text-xs font-medium">
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-[0.08em] font-semibold" style={{ color: "var(--accent)" }}>
            {currentStep?.shortLabel ?? "Step"}
          </span>
          <span className="text-[var(--text-muted)]">•</span>
          <span className="text-[0.82rem] font-medium" style={{ color: "var(--text-primary)" }}>
            {currentStep?.title}
          </span>
        </div>

        {/* Subtle step dots */}
        <div className="flex items-center gap-1.5">
          {steps.slice(1).map((s, idx) => {
            const stepActualIndex = idx + 1
            const isCompleted = stepActualIndex < currentStepIndex
            const isCurrent = stepActualIndex === currentStepIndex
            const isClickable = Boolean(onStepClick && isCompleted)

            return (
              <button
                key={s.id}
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(stepActualIndex)}
                className={`transition-all duration-300 rounded-full ${
                  isCurrent
                    ? "w-6 h-1.5"
                    : "w-1.5 h-1.5"
                } ${isClickable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                style={{
                  background: isCurrent
                    ? "var(--accent)"
                    : isCompleted
                    ? "color-mix(in srgb, var(--accent) 55%, transparent)"
                    : "color-mix(in srgb, var(--text-primary) 18%, transparent)",
                }}
                aria-label={`${s.title}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
              />
            )
          })}
        </div>
      </div>

      {/* Subtle thin progress track */}
      <div
        className="h-[2px] w-full rounded-full overflow-hidden"
        style={{ background: "color-mix(in srgb, var(--text-primary) 10%, transparent)" }}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${progressPercent}%`,
            background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, white 30%))",
          }}
        />
      </div>
    </div>
  )
}
