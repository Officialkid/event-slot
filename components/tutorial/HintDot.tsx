"use client"

import { useEffect, useState } from "react"

type HintDotProps = {
  message: string
  show: boolean
}

export function HintDot({ message, show }: HintDotProps) {
  const [visible, setVisible] = useState(show)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  useEffect(() => {
    setVisible(show)
    if (!show) setTooltipOpen(false)
  }, [show])

  if (!visible) return null

  return (
    <div className="relative inline-flex" style={{ marginLeft: "0.4rem" }}>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setTooltipOpen(o => !o)
        }}
        className="relative"
        aria-label="Feature hint"
        type="button"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a3e635] opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#a3e635]" />
        </span>
      </button>

      {tooltipOpen && (
        <div className="absolute left-4 top-0 z-50 w-48 bg-[#0f1a0f] border border-[#a3e635]/30 rounded-xl p-3 shadow-xl">
          <p className="text-white/80 text-xs leading-relaxed">{message}</p>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setVisible(false)
            }}
            className="mt-2 text-[#a3e635] text-xs font-medium"
            type="button"
          >
            Got it ✓
          </button>
        </div>
      )}
    </div>
  )
}
