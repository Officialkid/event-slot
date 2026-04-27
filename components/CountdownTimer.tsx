"use client"

import { useEffect, useMemo, useState } from "react"

type TimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

interface CountdownTimerProps {
  deadline: string | Date
  urgentMode?: boolean
  onExpiredChange?: (expired: boolean) => void
  hideWhenExpired?: boolean
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export default function CountdownTimer({
  deadline,
  urgentMode = false,
  onExpiredChange,
  hideWhenExpired = false,
}: CountdownTimerProps) {
  const deadlineMs = useMemo(() => new Date(deadline).getTime(), [deadline])
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)

  useEffect(() => {
    if (Number.isNaN(deadlineMs)) return

    const calculate = () => {
      const now = Date.now()
      const diff = deadlineMs - now

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true })
        return
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        expired: false,
      })
    }

    calculate()
    const interval = setInterval(calculate, 1000)
    return () => clearInterval(interval)
  }, [deadlineMs])

  useEffect(() => {
    onExpiredChange?.(Boolean(timeLeft?.expired))
  }, [timeLeft?.expired, onExpiredChange])

  if (Number.isNaN(deadlineMs) || !timeLeft) return null
  if (timeLeft.expired) {
    if (hideWhenExpired) return null
    return (
      <p
        style={{
          marginBottom: "1.25rem",
          fontSize: "0.78rem",
          color: "rgba(255,107,107,0.75)",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        Registration has closed.
      </p>
    )
  }

  const hoursTotal = timeLeft.days * 24 + timeLeft.hours
  const isCritical = urgentMode && hoursTotal < 1
  const isUrgent = urgentMode && !isCritical && timeLeft.days <= 2

  const stateColor = isCritical
    ? "#FF6B6B"
    : isUrgent
    ? "#FAC775"
    : "rgba(240,237,230,0.45)"

  const label = isCritical ? "Closing very soon" : isUrgent ? "Closing soon" : "Closes in"
  const pulseDuration = isCritical ? "1s" : "1.5s"

  const blocks = [
    { key: "days", value: timeLeft.days, unit: "Days" },
    { key: "hours", value: timeLeft.hours, unit: "Hours" },
    { key: "minutes", value: timeLeft.minutes, unit: "Mins" },
    { key: "seconds", value: timeLeft.seconds, unit: "Secs" },
  ]

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <style>{`@keyframes countdown-pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}`}</style>

      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: stateColor,
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {(isUrgent || isCritical) && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: stateColor,
              animation: `countdown-pulse ${pulseDuration} ease-in-out infinite`,
            }}
          />
        )}
        {label}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        {blocks.map((block, index) => {
          const showColon = index === 2 || index === 3
          return (
            <div key={block.key} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "rgba(240,237,230,0.04)",
                  border: "0.5px solid rgba(240,237,230,0.1)",
                  borderRadius: 8,
                  padding: "0.5rem 0.75rem",
                  minWidth: 52,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-instrument-serif)",
                    fontSize: "1.6rem",
                    lineHeight: 1,
                    color: stateColor,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pad(block.value)}
                </span>
                <span
                  style={{
                    fontSize: "0.6rem",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(240,237,230,0.3)",
                    marginTop: "0.25rem",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  {block.unit}
                </span>
              </div>
              {showColon && (
                <span
                  style={{
                    fontFamily: "var(--font-instrument-serif)",
                    fontSize: "1.4rem",
                    color: "rgba(240,237,230,0.2)",
                    paddingBottom: "0.4rem",
                    lineHeight: 1,
                  }}
                >
                  :
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
