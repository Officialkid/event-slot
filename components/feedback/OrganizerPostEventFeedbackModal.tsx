"use client"

import React, { useState, useEffect } from "react"

interface PendingEvent {
  id: string
  title: string
  slug: string
  eventDate: string | null
  eventEndAt: string | null
}

const CHALLENGES_OPTIONS = [
  "Gate queues & check-in delays",
  "Attendee navigation & venue directions",
  "Network & internet connectivity",
  "Audio/Visual & stage presentation tech",
  "Venue setup & logistical delays",
  "Ticket scanning or badge issues",
  "Other challenges",
]

export function OrganizerPostEventFeedbackModal() {
  const [event, setEvent] = useState<PendingEvent | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([])
  const [otherText, setOtherText] = useState("")
  const [additionalNotes, setAdditionalNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Check for pending event requiring feedback
    async function checkPendingEvent() {
      try {
        const res = await fetch("/api/organizer/feedback?prompt=true")
        if (!res.ok) return
        const data = await res.json()
        if (data.pendingEvent) {
          const dismissedKey = `eventslot_feedback_dismissed_${data.pendingEvent.id}`
          if (!sessionStorage.getItem(dismissedKey)) {
            setEvent(data.pendingEvent)
            setIsOpen(true)
          }
        }
      } catch {
        // Silently ignore background check errors
      }
    }

    checkPendingEvent()
  }, [])

  if (!isOpen || !event) return null

  function handleDismiss() {
    if (event) {
      sessionStorage.setItem(`eventslot_feedback_dismissed_${event.id}`, "true")
    }
    setIsOpen(false)
  }

  async function submitFeedback(stars: number, challenges: string[] = [], otherDesc = "", notes = "") {
    setSubmitting(true)
    try {
      const isFiveStar = stars === 5
      const type = isFiveStar ? "compliment" : stars <= 2 ? "complaint" : "suggestion"
      const challengesList = challenges.map(c => (c === "Other challenges" && otherDesc ? `Other: ${otherDesc}` : c))

      let messageBody = ""
      if (isFiveStar) {
        messageBody = "Organizer gave 5 stars — smooth event experience!"
      } else {
        messageBody = [
          challengesList.length > 0 ? `Challenges encountered:\n- ${challengesList.join("\n- ")}` : "",
          notes ? `Additional notes:\n${notes}` : "",
        ]
          .filter(Boolean)
          .join("\n\n")

        if (!messageBody) {
          messageBody = `Rated ${stars}/5 stars.`
        }
      }

      const res = await fetch("/api/organizer/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject: `Post-Event Review: ${event?.title}`,
          message: messageBody,
          rating: stars,
        }),
      })

      if (res.ok) {
        setSubmitted(true)
        if (event) {
          sessionStorage.setItem(`eventslot_feedback_dismissed_${event.id}`, "true")
        }
        setTimeout(() => {
          setIsOpen(false)
        }, 1800)
      }
    } catch (e) {
      console.error("[PostEventFeedback] submission failed:", e)
    } finally {
      setSubmitting(false)
    }
  }

  function handleStarClick(starVal: number) {
    setRating(starVal)
    if (starVal === 5) {
      // 5-Star: Instant Google Meet style submission & auto-close
      submitFeedback(5)
    }
  }

  const activeStars = hoveredRating ?? rating ?? 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(4px)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.35)",
          width: "100%",
          maxWidth: 480,
          padding: "1.75rem",
          position: "relative",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Dismiss 'x' button */}
        {!submitted && (
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
              padding: "0.25rem",
            }}
            title="Dismiss for now"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}

        {submitted ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✨</div>
            <h3
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "1.35rem",
                color: "var(--text-primary)",
                margin: "0 0 0.5rem",
              }}
            >
              Thank you for the valuable feedback!
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
              Your insights help us continuously refine EventSlot for you and your attendees.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <span
                style={{
                  display: "inline-block",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  padding: "0.2rem 0.6rem",
                  borderRadius: 6,
                  marginBottom: "0.6rem",
                }}
              >
                Post-Event Pulse
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: "1.35rem",
                  color: "var(--text-primary)",
                  margin: "0 0 0.4rem",
                  lineHeight: 1.25,
                }}
              >
                How was your event experience?
              </h2>
              <p
                style={{
                  fontSize: "0.84rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <strong>{event.title}</strong>
              </p>
            </div>

            {/* Google Meet style interactive 5 stars */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "0.5rem",
                marginBottom: rating && rating < 5 ? "1.25rem" : "0.5rem",
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= activeStars
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleStarClick(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(null)}
                    disabled={submitting}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "2rem",
                      lineHeight: 1,
                      padding: "0.2rem",
                      color: filled ? "#f59e0b" : "var(--border)",
                      transition: "transform 0.15s ease, color 0.15s ease",
                      transform: hoveredRating === star ? "scale(1.2)" : "scale(1)",
                    }}
                    title={`${star} Star${star > 1 ? "s" : ""}`}
                    aria-label={`${star} star`}
                  >
                    ★
                  </button>
                )
              })}
            </div>

            {rating === null && (
              <p style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
                Tap a star to rate your event experience
              </p>
            )}

            {/* Below 5 Stars: Expand checklist of challenges */}
            {rating !== null && rating < 5 && (
              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "1rem",
                  marginTop: "0.5rem",
                  animation: "fadeIn 0.2s ease-out",
                }}
              >
                <p
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: "0 0 0.75rem",
                  }}
                >
                  What challenges or friction did you face?
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.45rem", marginBottom: "0.85rem" }}>
                  {CHALLENGES_OPTIONS.map((opt) => {
                    const isChecked = selectedChallenges.includes(opt)
                    return (
                      <label
                        key={opt}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          fontSize: "0.8rem",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedChallenges((prev) => [...prev, opt])
                            } else {
                              setSelectedChallenges((prev) => prev.filter((item) => item !== opt))
                            }
                          }}
                          style={{
                            accentColor: "var(--accent)",
                            width: 15,
                            height: 15,
                            cursor: "pointer",
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                </div>

                {selectedChallenges.includes("Other challenges") && (
                  <input
                    type="text"
                    placeholder="Briefly describe the challenge..."
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--surface-muted)",
                      color: "var(--text-primary)",
                      padding: "0.45rem 0.7rem",
                      fontSize: "0.78rem",
                      marginBottom: "0.75rem",
                      outline: "none",
                    }}
                  />
                )}

                <textarea
                  rows={2}
                  placeholder="Optional: Any additional feedback for the team?"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-muted)",
                    color: "var(--text-primary)",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.78rem",
                    marginBottom: "1rem",
                    resize: "none",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    disabled={submitting}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "0.45rem 0.9rem",
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={() => submitFeedback(rating, selectedChallenges, otherText, additionalNotes)}
                    disabled={submitting}
                    style={{
                      background: "#15803d",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 8,
                      padding: "0.45rem 1.1rem",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? "Submitting..." : "Submit Feedback"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
