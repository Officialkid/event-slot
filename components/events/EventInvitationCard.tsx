"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import CountdownTimer from "@/components/CountdownTimer"

export type EventInvitationCardProps = {
  title: string
  description?: string | null
  eventDate?: Date | null
  location?: string | null
  imageUrl?: string | null
  organizerName?: string | null
  organizerIsPioneer?: boolean
  capacity?: number | null
  confirmedCount: number
  status: string
  deadline?: Date | string | null
  accessType?: "REGISTRATION" | "WALK_IN"
  walkInOpenToday?: boolean
}

function formatEventDate(date: Date): string {
  const d = new Date(date)
  const dayName = d.toLocaleDateString("en-GB", { weekday: "long" })
  const day = d.toLocaleDateString("en-GB", { day: "numeric" })
  const month = d.toLocaleDateString("en-GB", { month: "long" })
  const year = d.toLocaleDateString("en-GB", { year: "numeric" })
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })
  return `${dayName}, ${day} ${month} ${year} - ${time.toUpperCase()}`
}

function getStatusBadge(
  accessType: "REGISTRATION" | "WALK_IN",
  status: string,
  capacity: number | null | undefined,
  confirmedCount: number,
  deadline: Date | string | null | undefined,
  walkInOpenToday: boolean
): { label: string; bg: string; border: string; color: string } {
  if (accessType === "WALK_IN") {
    if (status === "closed") {
      return {
        label: "Check-In Closed",
        bg: "rgba(255,107,107,0.1)",
        border: "rgba(255,107,107,0.3)",
        color: "#FF6B6B",
      }
    }
    if (walkInOpenToday) {
      return {
        label: "Check-In Open Today",
        bg: "rgba(200,245,90,0.1)",
        border: "rgba(200,245,90,0.3)",
        color: "#C8F55A",
      }
    }
    return {
      label: "Walk-In Event",
      bg: "rgba(79,172,254,0.12)",
      border: "rgba(79,172,254,0.3)",
      color: "#7CC6FF",
    }
  }

  const isClosed =
    status === "closed" ||
    (deadline && new Date(deadline) < new Date())
  if (isClosed)
    return {
      label: "Registration Closed",
      bg: "rgba(255,107,107,0.1)",
      border: "rgba(255,107,107,0.3)",
      color: "#FF6B6B",
    }
  if (capacity !== null && capacity !== undefined && confirmedCount >= capacity)
    return {
      label: "Waitlist Only",
      bg: "rgba(255,200,50,0.1)",
      border: "rgba(255,200,50,0.3)",
      color: "#FFC832",
    }
  return {
    label: "Slots Available",
    bg: "rgba(200,245,90,0.1)",
    border: "rgba(200,245,90,0.3)",
    color: "#C8F55A",
  }
}

export default function EventInvitationCard({
  title,
  description,
  eventDate,
  location,
  imageUrl,
  organizerName,
  organizerIsPioneer,
  capacity,
  confirmedCount,
  status,
  deadline,
  accessType = "REGISTRATION",
  walkInOpenToday = false,
}: EventInvitationCardProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const posterErrorHandledRef = useRef(false)
  const badge = getStatusBadge(accessType, status, capacity, confirmedCount, deadline ?? null, walkInOpenToday)
  const posterSrc = typeof imageUrl === "string" ? imageUrl : ""
  const hasPoster = Boolean(posterSrc) && !posterFailed
  const isLongDescription = Boolean(description && description.length > 300)
  const descriptionText = !description
    ? ""
    : isLongDescription && !expanded
    ? `${description.slice(0, 300)}...`
    : description

  const spotsLeft =
    capacity !== null && capacity !== undefined
      ? Math.max(0, capacity - confirmedCount)
      : null

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handlePosterError = useCallback(() => {
    if (posterErrorHandledRef.current) return
    posterErrorHandledRef.current = true
    setPosterFailed(true)
  }, [])

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgba(240,237,230,0.1)",
        background: "#0F141C",
        boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        marginBottom: "1.5rem",
      }}
    >
      {hasPoster && (
        <div style={{ position: "relative", width: "100%", height: 260, backgroundColor: "#0A0A0A" }} className="sm:h-[300px] lg:h-[420px]">
          <Image
            src={posterSrc}
            alt={title}
            fill
            sizes="100vw"
            quality={100}
            unoptimized
            style={{ objectFit: "contain", objectPosition: "center" }}
            onError={handlePosterError}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: "linear-gradient(180deg, rgba(10,10,10,0.02) 0%, rgba(10,10,10,0.28) 100%)",
            }}
          />
        </div>
      )}

      <div
        style={{
          position: "relative",
          zIndex: 3,
          padding: "clamp(1.2rem, 3vw, 2rem)",
          minHeight: 220,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          background: hasPoster
            ? "linear-gradient(180deg, rgba(15,20,28,0) 0%, rgba(15,20,28,0.92) 10%, rgba(15,20,28,0.97) 100%)"
            : "linear-gradient(140deg, #101722 0%, #121b29 55%, #0D1117 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(240,237,230,0.5)",
              fontWeight: 700,
            }}
          >
            EventSlot
          </span>

          {/* Status badge */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: badge.bg,
              border: `1px solid ${badge.border}`,
              borderRadius: 999,
              padding: "0.3rem 0.75rem",
              fontSize: "0.68rem",
              fontWeight: 600,
              color: badge.color,
              letterSpacing: "0.03em",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: badge.color,
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            {badge.label}
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(1.45rem, 4.2vw, 2.4rem)",
            fontWeight: 500,
            color: "#F0EDE6",
            margin: 0,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            fontFamily: "var(--font-instrument-serif, Georgia, serif)",
            maxWidth: 800,
          }}
        >
          {title}
        </h1>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
          }}
        >
          {eventDate && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", opacity: 0.5, flexShrink: 0 }}>Date</span>
              <span
                style={{
                  fontSize: "0.88rem",
                  color: "rgba(240,237,230,0.88)",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                }}
                suppressHydrationWarning
              >
                {isMounted ? formatEventDate(eventDate) : ""}
              </span>
            </div>
          )}

          {location && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", opacity: 0.5, flexShrink: 0 }}>Place</span>
              <span style={{ fontSize: "0.88rem", color: "rgba(240,237,230,0.82)", fontWeight: 400 }}>
                {location}
              </span>
            </div>
          )}

          {organizerName && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", opacity: 0.5, flexShrink: 0 }}>Host</span>
              <span style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", fontWeight: 400, display: "inline-flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                Hosted by{" "}
                <span style={{ color: "rgba(240,237,230,0.8)", fontWeight: 500 }}>{organizerName}</span>
                {organizerIsPioneer ? (
                  <span
                    title="EventSlot Pioneer - one of our earliest supporters"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.7rem",
                      color: "#C8F55A",
                      border: "1px solid rgba(200,245,90,0.3)",
                      borderRadius: 999,
                      padding: "0.1rem 0.5rem",
                      lineHeight: 1.4,
                    }}
                  >
                    Pioneer
                  </span>
                ) : null}
              </span>
            </div>
          )}
        </div>

        {description && (
          <>
            <div
              style={{
                height: 1,
                background: "rgba(240,237,230,0.12)",
              }}
            />
            <p
              style={{
                fontSize: "0.88rem",
                color: "rgba(240,237,230,0.78)",
                lineHeight: 1.72,
                margin: 0,
                maxWidth: 700,
              }}
            >
              {descriptionText}
            </p>
            {isLongDescription && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#C8F55A",
                  fontSize: "0.78rem",
                  padding: "0.25rem 0",
                  fontFamily: "var(--font-dm-sans)",
                  marginTop: "0.1rem",
                }}
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </>
        )}

        {accessType === "REGISTRATION" && deadline && badge.label !== "Registration Closed" && (
          <div style={{ marginTop: "1rem", maxWidth: 420 }}>
            <CountdownTimer deadline={deadline} urgentMode />
          </div>
        )}

        {accessType === "REGISTRATION" && spotsLeft !== null && badge.label !== "Registration Closed" && (
          <div style={{ marginTop: "0.2rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "rgba(240,237,230,0.06)",
                border: "1px solid rgba(240,237,230,0.14)",
                borderRadius: 999,
                padding: "0.3rem 0.85rem",
                fontSize: "0.72rem",
                color: "rgba(240,237,230,0.55)",
                fontWeight: 500,
                gap: "0.35rem",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: spotsLeft > 0 ? "#C8F55A" : "#FFC832",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              {spotsLeft > 0
                ? `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} remaining`
                : "Waitlist open"}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
