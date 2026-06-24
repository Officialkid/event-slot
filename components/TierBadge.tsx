import type { CSSProperties } from "react"

type TierBadgeProps = {
  name: string
  badgeColor: string
  textColor: string
  metallic?: boolean
  size?: "sm" | "md" | "lg"
}

const sizeStyles: Record<NonNullable<TierBadgeProps["size"]>, CSSProperties> = {
  sm: { fontSize: "0.68rem", padding: "0.22rem 0.58rem" },
  md: { fontSize: "0.78rem", padding: "0.34rem 0.78rem" },
  lg: { fontSize: "0.92rem", padding: "0.46rem 1rem" },
}

export function TierBadge({
  name,
  badgeColor,
  textColor,
  metallic = false,
  size = "md",
}: TierBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        fontFamily: "var(--font-dm-sans)",
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        border: `1px solid ${badgeColor}CC`,
        color: textColor,
        background: metallic
          ? `linear-gradient(135deg, ${badgeColor} 0%, color-mix(in srgb, ${badgeColor} 78%, white) 50%, ${badgeColor} 100%)`
          : badgeColor,
        boxShadow: metallic ? "0 1px 3px rgba(0,0,0,0.28)" : "none",
        ...sizeStyles[size],
      }}
    >
      {name}
    </span>
  )
}
