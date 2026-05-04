"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { TutorialStep } from "@/lib/tutorialSteps"

type TooltipPosition = { top: number; left: number }

type TutorialOverlayProps = {
  step: TutorialStep
  currentStepIndex: number
  totalSteps: number
  targetRect: DOMRect | null
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

function SpotlightMask({ rect }: { rect: DOMRect }) {
  return (
    <svg
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9998 }}
      aria-hidden="true"
    >
      <defs>
        <mask id="tutorial-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={rect.left - 8}
            y={rect.top - 8}
            width={rect.width + 16}
            height={rect.height + 16}
            rx="8"
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.75)"
        mask="url(#tutorial-spotlight-mask)"
      />
      <rect
        x={rect.left - 8}
        y={rect.top - 8}
        width={rect.width + 16}
        height={rect.height + 16}
        rx="8"
        fill="none"
        stroke="#a3e635"
        strokeWidth="2"
      />
    </svg>
  )
}

function getTooltipPosition(
  targetRect: DOMRect,
  position: TutorialStep["position"],
  tooltipSize: { w: number; h: number },
): TooltipPosition {
  const padding = 16
  const viewportPadding = 12

  let top: number
  let left: number

  switch (position) {
    case "bottom":
      top = targetRect.bottom + padding
      left = targetRect.left
      break
    case "top":
      top = targetRect.top - tooltipSize.h - padding
      left = targetRect.left
      break
    case "right":
      top = targetRect.top
      left = targetRect.right + padding
      break
    case "left":
      top = targetRect.top
      left = targetRect.left - tooltipSize.w - padding
      break
    case "center":
    default:
      top = window.innerHeight / 2 - tooltipSize.h / 2
      left = window.innerWidth / 2 - tooltipSize.w / 2
      break
  }

  const maxLeft = window.innerWidth - tooltipSize.w - viewportPadding
  const maxTop = window.innerHeight - tooltipSize.h - viewportPadding

  return {
    top: Math.max(viewportPadding, Math.min(top, maxTop)),
    left: Math.max(viewportPadding, Math.min(left, maxLeft)),
  }
}

export function TutorialOverlay({
  step,
  currentStepIndex,
  totalSteps,
  targetRect,
  onNext,
  onBack,
  onSkip,
}: TutorialOverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardSize, setCardSize] = useState({ w: 360, h: 320 })

  useEffect(() => {
    const updateSize = () => {
      if (!cardRef.current) return
      setCardSize({
        w: cardRef.current.offsetWidth,
        h: cardRef.current.offsetHeight,
      })
    }

    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [step.id])

  const centered = step.position === "center" || !step.spotlight || !targetRect

  const tooltipPos = useMemo(() => {
    if (centered || !targetRect) {
      return getTooltipPosition(
        new DOMRect(window.innerWidth / 2 - 1, window.innerHeight / 2 - 1, 2, 2),
        "center",
        cardSize,
      )
    }
    return getTooltipPosition(targetRect, step.position, cardSize)
  }, [cardSize, centered, step.position, targetRect])

  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100

  return (
    <>
      {centered ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9998 }} />
      ) : (
        targetRect && <SpotlightMask rect={targetRect} />
      )}

      <div
        ref={cardRef}
        key={step.id}
        style={{
          position: "fixed",
          top: tooltipPos.top,
          left: tooltipPos.left,
          zIndex: 9999,
          width: "min(360px, calc(100vw - 24px))",
          animation: "tutorial-fade-in 220ms ease",
        }}
        className="bg-[#0f1a0f] border border-[#a3e635]/30 rounded-2xl p-6 shadow-2xl shadow-black/50"
      >
        <style>{`@keyframes tutorial-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        <div className="w-full bg-white/10 rounded-full h-1 mb-4">
          <div
            className="bg-[#a3e635] h-1 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-white/40 text-xs mb-3">
          Step {currentStepIndex + 1} of {totalSteps}
        </p>

        <div className="text-4xl mb-3">{step.icon}</div>

        <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>

        <p className="text-white/70 text-sm leading-relaxed mb-6">{step.description}</p>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onSkip}
            className="text-white/40 text-sm hover:text-white/70 transition-colors"
          >
            Skip tour
          </button>

          <div className="flex gap-2">
            {currentStepIndex > 0 && (
              <button
                onClick={onBack}
                className="px-4 py-2 rounded-xl border border-white/20 text-white/70 text-sm hover:border-white/40 transition-all"
              >
                Back
              </button>
            )}

            <button
              onClick={onNext}
              className="px-5 py-2 rounded-xl bg-[#a3e635] text-black font-semibold text-sm hover:bg-[#b5f542] transition-all"
            >
              {currentStepIndex + 1 === totalSteps ? "Finish" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
