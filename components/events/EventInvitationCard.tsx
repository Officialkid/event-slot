import Image from "next/image"

export type EventInvitationCardProps = {
  title: string
  description?: string | null
  eventDate?: Date | null
  location?: string | null
  imageUrl?: string | null
  organizerName?: string | null
  capacity?: number | null
  confirmedCount: number
  status: string
  deadline?: Date | null
}

function formatEventDate(date: Date): string {
  const d = new Date(date)
  const dayName = d.toLocaleDateString("en-GB", { weekday: "long" })
  const day = d.toLocaleDateString("en-GB", { day: "numeric" })
  const month = d.toLocaleDateString("en-GB", { month: "long" })
  const year = d.toLocaleDateString("en-GB", { year: "numeric" })
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })
  return `${dayName}, ${day} ${month} ${year} · ${time.toUpperCase()}`
}

function getStatusBadge(
  status: string,
  capacity: number | null | undefined,
  confirmedCount: number,
  deadline: Date | null | undefined
): { label: string; bg: string; border: string; color: string } {
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

/* Gradient fallback palette — cycles deterministically by title character sum */
const GRADIENTS = [
  "linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #0a0a0a 100%)",
  "linear-gradient(135deg, #0a1628 0%, #0f3460 50%, #0a0a0a 100%)",
  "linear-gradient(135deg, #0d1a0d 0%, #1a3a1a 50%, #0a0a0a 100%)",
  "linear-gradient(135deg, #1a0a00 0%, #3d1a00 50%, #0a0a0a 100%)",
  "linear-gradient(135deg, #1a001a 0%, #3d003d 50%, #0a0a0a 100%)",
  "linear-gradient(135deg, #001a1a 0%, #003d3d 50%, #0a0a0a 100%)",
]

function pickGradient(title: string): string {
  const sum = [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[sum % GRADIENTS.length]
}

export default function EventInvitationCard({
  title,
  description,
  eventDate,
  location,
  imageUrl,
  organizerName,
  capacity,
  confirmedCount,
  status,
  deadline,
}: EventInvitationCardProps) {
  const badge = getStatusBadge(status, capacity, confirmedCount, deadline ?? null)
  const gradient = pickGradient(title)

  const spotsLeft =
    capacity !== null && capacity !== undefined
      ? Math.max(0, capacity - confirmedCount)
      : null

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        marginBottom: "2rem",
      }}
    >
      {/* ── Background layer ─────────────────────────────────────────── */}
      {imageUrl ? (
        <>
          <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            <Image
              src={imageUrl}
              alt={title}
              fill
              sizes="(max-width: 1040px) 100vw, 1040px"
              style={{ objectFit: "cover", objectPosition: "center" }}
              priority
            />
          </div>
          {/* Multi-stop overlay: heavy at bottom for legibility */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.72) 40%, rgba(10,10,10,0.92) 80%, #0A0A0A 100%)",
              zIndex: 1,
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: gradient,
            zIndex: 0,
          }}
        >
          {/* Subtle noise / grain texture layer */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 20% 30%, rgba(200,245,90,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(200,245,90,0.04) 0%, transparent 55%)",
            }}
          />
        </div>
      )}

      {/* ── Decorative corner ornament (top-right) ───────────────────── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 220,
          height: 220,
          borderBottom: "1px solid rgba(200,245,90,0.08)",
          borderLeft: "1px solid rgba(200,245,90,0.08)",
          borderBottomLeftRadius: 220,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          padding: "clamp(1.75rem, 4vw, 3rem) clamp(1.5rem, 4vw, 3rem)",
          minHeight: imageUrl ? 320 : 260,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 0,
        }}
      >
        {/* Top bar: EventSlot brand + status badge */}
        <div
          style={{
            position: "absolute",
            top: "clamp(1rem, 3vw, 1.75rem)",
            left: "clamp(1.5rem, 4vw, 3rem)",
            right: "clamp(1.5rem, 4vw, 3rem)",
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
              color: "rgba(200,245,90,0.7)",
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
              letterSpacing: "0.04em",
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

        {/* Event name */}
        <h1
          style={{
            fontSize: "clamp(1.6rem, 4.5vw, 2.8rem)",
            fontWeight: 600,
            color: "#F0EDE6",
            margin: "0 0 1rem",
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            fontFamily: "var(--font-instrument-serif, Georgia, serif)",
            textShadow: imageUrl ? "0 2px 12px rgba(0,0,0,0.6)" : "none",
            maxWidth: "78%",
          }}
        >
          {title}
        </h1>

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
            marginBottom: description ? "1.25rem" : "0",
          }}
        >
          {eventDate && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", opacity: 0.5, flexShrink: 0 }}>📅</span>
              <span
                style={{
                  fontSize: "0.88rem",
                  color: "#F0EDE6",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                }}
              >
                {formatEventDate(eventDate)}
              </span>
            </div>
          )}

          {location && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", opacity: 0.5, flexShrink: 0 }}>📍</span>
              <span style={{ fontSize: "0.88rem", color: "rgba(240,237,230,0.7)", fontWeight: 400 }}>
                {location}
              </span>
            </div>
          )}

          {organizerName && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", opacity: 0.5, flexShrink: 0 }}>✦</span>
              <span style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", fontWeight: 400 }}>
                Hosted by{" "}
                <span style={{ color: "rgba(240,237,230,0.75)", fontWeight: 500 }}>{organizerName}</span>
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <>
            <div
              style={{
                height: 1,
                background: "rgba(240,237,230,0.1)",
                margin: "0 0 1rem",
              }}
            />
            <p
              style={{
                fontSize: "0.88rem",
                color: "rgba(240,237,230,0.6)",
                lineHeight: 1.65,
                margin: 0,
                maxWidth: 620,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </p>
          </>
        )}

        {/* Footer: capacity pill */}
        {spotsLeft !== null && badge.label !== "Registration Closed" && (
          <div style={{ marginTop: "1.25rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "rgba(240,237,230,0.07)",
                border: "1px solid rgba(240,237,230,0.12)",
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
