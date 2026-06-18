"use client"

import React from "react"
import { normalizePlanKey } from "@/lib/effectivePlanPolicy"

const PLAN_STYLES = {
  free: {
    label: "Free",
    color: "#C9CED6",
    background: "rgba(201,206,214,0.12)",
    border: "rgba(201,206,214,0.24)",
  },
  standard: {
    label: "Standard",
    color: "#7CC7FF",
    background: "rgba(124,199,255,0.12)",
    border: "rgba(124,199,255,0.24)",
  },
  pro: {
    label: "Pro",
    color: "#C8F55A",
    background: "rgba(200,245,90,0.12)",
    border: "rgba(200,245,90,0.28)",
  },
  business: {
    label: "Business",
    color: "#FFCB7A",
    background: "rgba(255,203,122,0.12)",
    border: "rgba(255,203,122,0.28)",
  },
} as const

export function PlanBadge({ plan }: { plan: string | null | undefined }) {
  const key = normalizePlanKey(plan)
  const style = PLAN_STYLES[key]

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: "0.62rem",
        padding: "2px 8px",
        borderRadius: 999,
        color: style.color,
        background: style.background,
        border: `0.5px solid ${style.border}`,
        fontFamily: "var(--font-dm-sans)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        width: "fit-content",
        fontWeight: 700,
      }}
    >
      {style.label}
    </span>
  )
}
