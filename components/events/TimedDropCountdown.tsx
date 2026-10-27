"use client"

import React, { useEffect, useState } from "react"
import { Clock, Flame, ShieldAlert, Sparkles } from "lucide-react"

interface TimedDropCountdownProps {
  opensAt?: string | null
  closesAt?: string | null
  waitlistOnExpire?: boolean
  isFull?: boolean
  onStateChange?: (state: "upcoming" | "active" | "expired") => void
}

export function TimedDropCountdown({
  opensAt,
  closesAt,
  waitlistOnExpire = true,
  isFull = false,
  onStateChange,
}: TimedDropCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    status: "upcoming" | "active" | "expired"
    days: number
    hours: number
    minutes: number
    seconds: number
  }>({
    status: "active",
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  useEffect(() => {
    function calculate() {
      const now = new Date().getTime()
      const openTime = opensAt ? new Date(opensAt).getTime() : null
      const closeTime = closesAt ? new Date(closesAt).getTime() : null

      let targetTime: number | null = null
      let status: "upcoming" | "active" | "expired" = "active"

      if (openTime && now < openTime) {
        status = "upcoming"
        targetTime = openTime
      } else if (closeTime && now < closeTime) {
        status = "active"
        targetTime = closeTime
      } else if (closeTime && now >= closeTime) {
        status = "expired"
      }

      if (status === "expired" || targetTime === null) {
        setTimeLeft({ status, days: 0, hours: 0, minutes: 0, seconds: 0 })
        onStateChange?.(status)
        return
      }

      const diff = Math.max(0, targetTime - now)
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / 1000 / 60) % 60)
      const seconds = Math.floor((diff / 1000) % 60)

      setTimeLeft({ status, days, hours, minutes, seconds })
      onStateChange?.(status)
    }

    calculate()
    const interval = setInterval(calculate, 1000)
    return () => clearInterval(interval)
  }, [opensAt, closesAt, onStateChange])

  if (!opensAt && !closesAt) return null

  const pad = (n: number) => String(n).padStart(2, "0")

  return (
    <div
      role="region"
      aria-label="Ticket drop window countdown"
      className="w-full my-4 p-4 rounded-xl border backdrop-blur-sm transition-all"
      style={{
        backgroundColor:
          timeLeft.status === "active"
            ? "color-mix(in srgb, var(--accent) 8%, var(--surface))"
            : timeLeft.status === "upcoming"
            ? "color-mix(in srgb, var(--warning, #eab308) 8%, var(--surface))"
            : "color-mix(in srgb, var(--border) 40%, var(--surface))",
        borderColor:
          timeLeft.status === "active"
            ? "color-mix(in srgb, var(--accent) 30%, transparent)"
            : timeLeft.status === "upcoming"
            ? "color-mix(in srgb, var(--warning, #eab308) 30%, transparent)"
            : "var(--border)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Header and status label */}
        <div className="flex items-center gap-2.5">
          {timeLeft.status === "active" ? (
            <div
              className="p-2 rounded-lg flex items-center justify-center animate-pulse"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
                color: "var(--accent)",
              }}
            >
              <Flame className="w-5 h-5" />
            </div>
          ) : timeLeft.status === "upcoming" ? (
            <div
              className="p-2 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: "color-mix(in srgb, var(--warning, #eab308) 20%, transparent)",
                color: "var(--warning, #eab308)",
              }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
          ) : (
            <div
              className="p-2 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: "color-mix(in srgb, var(--text-muted) 15%, transparent)",
                color: "var(--text-muted)",
              }}
            >
              <Clock className="w-5 h-5" />
            </div>
          )}

          <div>
            <div className="text-xs font-semibold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
              {timeLeft.status === "active"
                ? "⚡ Limited Ticket Drop Active"
                : timeLeft.status === "upcoming"
                ? "Upcoming Ticket Drop"
                : "Ticket Drop Ended"}
            </div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {timeLeft.status === "active"
                ? "Tickets are currently available until the countdown reaches zero."
                : timeLeft.status === "upcoming"
                ? "Registration is not open yet. Doors unlock when countdown ends."
                : isFull || waitlistOnExpire
                ? "The booking window has closed. Join the waitlist below!"
                : "Tickets for this batch are closed."}
            </div>
          </div>
        </div>

        {/* Live Timer Badges */}
        {timeLeft.status !== "expired" ? (
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            {timeLeft.days > 0 && (
              <div
                className="px-2.5 py-1.5 rounded-lg text-center min-w-[42px]"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <span className="block text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  {pad(timeLeft.days)}
                </span>
                <span className="block text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
                  Days
                </span>
              </div>
            )}
            <div
              className="px-2.5 py-1.5 rounded-lg text-center min-w-[42px]"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <span className="block text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {pad(timeLeft.hours)}
              </span>
              <span className="block text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
                Hrs
              </span>
            </div>
            <span className="font-bold" style={{ color: "var(--text-muted)" }}>:</span>
            <div
              className="px-2.5 py-1.5 rounded-lg text-center min-w-[42px]"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <span className="block text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {pad(timeLeft.minutes)}
              </span>
              <span className="block text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
                Min
              </span>
            </div>
            <span className="font-bold" style={{ color: "var(--text-muted)" }}>:</span>
            <div
              className="px-2.5 py-1.5 rounded-lg text-center min-w-[42px]"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
                border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              }}
            >
              <span
                className="block text-base font-bold"
                style={{ color: timeLeft.status === "active" ? "var(--accent)" : "var(--text-primary)" }}
              >
                {pad(timeLeft.seconds)}
              </span>
              <span className="block text-[10px] uppercase font-medium" style={{ color: "var(--text-muted)" }}>
                Sec
              </span>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              backgroundColor: "color-mix(in srgb, var(--text-muted) 15%, transparent)",
              color: "var(--text-muted)",
            }}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Window Closed</span>
          </div>
        )}
      </div>
    </div>
  )
}
