"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import CountdownTimer from "@/components/CountdownTimer"
import { EventDescriptionBlock, type PublicEventTranslation } from "@/components/events/EventDescriptionBlock"
import type { SupportedLanguageCode } from "@/lib/i18n/languages"

export type EventInvitationCardProps = {
  eventSlug: string
  title: string
  description?: string | null
  eventDate?: Date | string | null
  eventEndAt?: Date | string | null
  location?: string | null
  mapDirectionsUrl?: string | null
  entryFeeLabel?: string | null
  showRemainingSpots?: boolean
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

function formatEventDate(date: Date | string): string {
  const d = new Date(date)
  const dayName = d.toLocaleDateString("en-GB", { weekday: "long" })
  const day = d.toLocaleDateString("en-GB", { day: "numeric" })
  const month = d.toLocaleDateString("en-GB", { month: "long" })
  const year = d.toLocaleDateString("en-GB", { year: "numeric" })
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })
  return `${dayName}, ${day} ${month} ${year} - ${time.toUpperCase()}`
}

function formatEventDateRange(startDate: Date | string | null | undefined, endDate: Date | string | null | undefined): string {
  if (!startDate) return ""
  if (!endDate) return formatEventDate(startDate)

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return formatEventDate(startDate)
  }

  const sameDay = start.toDateString() === end.toDateString()
  if (sameDay) {
    const startLabel = formatEventDate(start)
    const endTime = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()
    return `${startLabel} to ${endTime}`
  }

  return `${formatEventDate(start)} to ${formatEventDate(end)}`
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

function getCardCopy(language: SupportedLanguageCode | null) {
  const copy = {
    en: { date: "Date", place: "Place", entry: "Entry", host: "Host", hostedBy: "Hosted by", pioneer: "Pioneer", getDirections: "Get directions", spotsRemaining: "spots remaining", spotRemaining: "spot remaining", waitlistOpen: "Waitlist open" },
    sw: { date: "Tarehe", place: "Mahali", entry: "Kiingilio", host: "Mwenyeji", hostedBy: "Imeandaliwa na", pioneer: "Mwanzilishi", getDirections: "Pata maelekezo", spotsRemaining: "nafasi zimebaki", spotRemaining: "nafasi imebaki", waitlistOpen: "Orodha ya kusubiri ipo wazi" },
    fr: { date: "Date", place: "Lieu", entry: "Entree", host: "Hote", hostedBy: "Organise par", pioneer: "Pionnier", getDirections: "Itineraire", spotsRemaining: "places restantes", spotRemaining: "place restante", waitlistOpen: "Liste d'attente ouverte" },
    pt: { date: "Data", place: "Local", entry: "Entrada", host: "Anfitriao", hostedBy: "Organizado por", pioneer: "Pioneiro", getDirections: "Ver direcoes", spotsRemaining: "vagas restantes", spotRemaining: "vaga restante", waitlistOpen: "Lista de espera aberta" },
    es: { date: "Fecha", place: "Lugar", entry: "Entrada", host: "Anfitrion", hostedBy: "Organizado por", pioneer: "Pionero", getDirections: "Ver indicaciones", spotsRemaining: "cupos restantes", spotRemaining: "cupo restante", waitlistOpen: "Lista de espera abierta" },
    de: { date: "Datum", place: "Ort", entry: "Eintritt", host: "Gastgeber", hostedBy: "Veranstaltet von", pioneer: "Pionier", getDirections: "Route anzeigen", spotsRemaining: "Plaetze uebrig", spotRemaining: "Platz uebrig", waitlistOpen: "Warteliste offen" },
    ar: { date: "التاريخ", place: "المكان", entry: "الدخول", host: "المنظم", hostedBy: "بواسطة", pioneer: "رائد", getDirections: "احصل على الاتجاهات", spotsRemaining: "أماكن متبقية", spotRemaining: "مكان متبق", waitlistOpen: "قائمة الانتظار مفتوحة" },
    zh: { date: "日期", place: "地点", entry: "入场", host: "主办方", hostedBy: "主办方", pioneer: "先锋", getDirections: "获取路线", spotsRemaining: "个名额剩余", spotRemaining: "个名额剩余", waitlistOpen: "候补名单开放" },
  } satisfies Record<SupportedLanguageCode, Record<string, string>>
  return copy[language ?? "en"] ?? copy.en
}

function buildMapPreviewUrl(mapUrl: string | null | undefined, location: string | null | undefined) {
  if (!mapUrl) return null
  try {
    const url = new URL(mapUrl)
    const query = url.searchParams.get("query") || url.searchParams.get("q")
    if (query) return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`

    const coordinates = mapUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    if (coordinates) return `https://www.google.com/maps?q=${coordinates[1]},${coordinates[2]}&output=embed`

    const placeMatch = url.pathname.match(/\/place\/([^/]+)/)
    if (placeMatch?.[1]) {
      return `https://www.google.com/maps?q=${encodeURIComponent(decodeURIComponent(placeMatch[1].replace(/\+/g, " ")))}&output=embed`
    }
  } catch {
    // Short maps links are still useful as the button target, even if they cannot be embedded directly.
  }

  return location ? `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed` : null
}

export default function EventInvitationCard({
  eventSlug,
  title,
  description,
  eventDate,
  eventEndAt,
  location,
  mapDirectionsUrl,
  entryFeeLabel,
  showRemainingSpots = true,
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
  const [posterFailed, setPosterFailed] = useState(false)
  const [translation, setTranslation] = useState<PublicEventTranslation | null>(null)
  const posterErrorHandledRef = useRef(false)
  const badge = getStatusBadge(accessType, status, capacity, confirmedCount, deadline ?? null, walkInOpenToday)
  const cardCopy = getCardCopy(translation?.targetLanguage ?? null)
  const displayTitle = translation?.title || title
  const displayLocation = translation?.location || location
  const displayEntryFeeLabel = translation?.entryFeeLabel || entryFeeLabel
  const displayOrganizerName = translation?.organizerName || organizerName
  const mapPreviewUrl = buildMapPreviewUrl(mapDirectionsUrl, displayLocation)
  const posterSrc = typeof imageUrl === "string" ? imageUrl : ""
  const hasPoster = Boolean(posterSrc) && !posterFailed
  const eventDateLabel = eventDate ? formatEventDateRange(eventDate, eventEndAt) : ""
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
        border: "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.12)",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        marginBottom: "1.5rem",
      }}
    >
      {hasPoster && (
        <div style={{ position: "relative", width: "100%", height: 260, backgroundColor: "var(--surface-muted)" }} className="sm:h-[300px] lg:h-[420px]">
          <Image
            src={posterSrc}
            alt={displayTitle}
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
            ? "linear-gradient(180deg, rgba(0,0,0,0) 0%, color-mix(in srgb, var(--surface) 88%, transparent) 10%, var(--surface) 100%)"
            : "var(--surface)",
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
              color: "var(--text-muted)",
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
            color: "var(--text-primary)",
            margin: 0,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            fontFamily: "var(--font-instrument-serif, Georgia, serif)",
            maxWidth: 800,
          }}
        >
          {displayTitle}
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
              <span style={{ fontSize: "0.72rem", opacity: 0.5, flexShrink: 0 }}>{cardCopy.date}</span>
              <span
                style={{
                  fontSize: "0.88rem",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                }}
                suppressHydrationWarning
              >
                {isMounted ? eventDateLabel : ""}
              </span>
            </div>
          )}

          {displayLocation && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", opacity: 0.5, flexShrink: 0 }}>{cardCopy.place}</span>
              <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                {displayLocation}
              </span>
            </div>
          )}

          {displayEntryFeeLabel && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", opacity: 0.5, flexShrink: 0 }}>{cardCopy.entry}</span>
              <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                {displayEntryFeeLabel}
              </span>
            </div>
          )}

          {displayOrganizerName && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", opacity: 0.5, flexShrink: 0 }}>{cardCopy.host}</span>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 400, display: "inline-flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                {cardCopy.hostedBy}{" "}
                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{displayOrganizerName}</span>
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
                    {cardCopy.pioneer}
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
                background: "var(--border)",
              }}
            />
            <EventDescriptionBlock
              eventSlug={eventSlug}
              description={description}
              onTranslated={setTranslation}
              onShowOriginal={() => setTranslation(null)}
            />
          </>
        )}

        {mapDirectionsUrl && (
          <div style={{ overflow: "hidden", border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface-muted)", marginTop: "0.35rem" }}>
            {mapPreviewUrl ? (
              <iframe
                title={`${displayTitle} map preview`}
                src={mapPreviewUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                style={{ display: "block", width: "100%", height: 150, border: 0 }}
              />
            ) : (
              <div style={{ height: 120, display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: "0.82rem", padding: "1rem", textAlign: "center" }}>
                Map preview is available after opening the organizer-provided directions link.
              </div>
            )}
            <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
              <a
                href={mapDirectionsUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", justifyContent: "center", width: "100%", borderRadius: 999, background: "var(--accent)", color: "#0A0A0A", padding: "0.72rem 1rem", fontSize: "0.86rem", fontWeight: 800, textDecoration: "none" }}
              >
                Open in Google Maps
              </a>
            </div>
          </div>
        )}

        {accessType === "REGISTRATION" && deadline && badge.label !== "Registration Closed" && (
          <div style={{ marginTop: "1rem", maxWidth: 420 }}>
            <CountdownTimer deadline={deadline} urgentMode />
          </div>
        )}

        {accessType === "REGISTRATION" && showRemainingSpots && spotsLeft !== null && (
          <div style={{ marginTop: "0.2rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--surface-muted)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "0.3rem 0.85rem",
                fontSize: "0.72rem",
                color: "var(--text-muted)",
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
                ? `${spotsLeft} ${spotsLeft === 1 ? cardCopy.spotRemaining : cardCopy.spotsRemaining}`
                : cardCopy.waitlistOpen}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
