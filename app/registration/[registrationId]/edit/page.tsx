"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"

type Question = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
  allowMultiple?: boolean
}

type Registration = {
  id: string
  answers: Array<{ questionId: string; value: string }>
  status: string
  registrationNumber?: number | null
  event: {
    title: string
    questions: Question[]
    status: string
    deadline: string | null
  }
}

function parseCheckboxValue(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string")
  } catch {
    return raw.split("|").map(v => v.trim()).filter(Boolean)
  }
  return []
}

function serializeCheckboxValue(values: string[]): string {
  const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
  return JSON.stringify(uniqueSorted)
}

export default function EditRegistrationPage() {
  const params = useParams()
  const registrationId = params?.registrationId as string

  const [registration, setRegistration] = useState<Registration | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [notFound, setNotFound] = useState(false)

  const fetchRegistration = useCallback(async () => {
    try {
      const res = await fetch(`/api/registrations/${registrationId}`)
      if (res.status === 404) { setNotFound(true); return }
      const data = await res.json()
      if (data.registration) {
        setRegistration(data.registration)
        const a: Record<string, string> = {}
        for (const ans of data.registration.answers) {
          a[ans.questionId] = ans.value
        }
        setAnswers(a)
      }
    } catch {
      setError("Failed to load registration.")
    } finally {
      setLoading(false)
    }
  }, [registrationId])

  useEffect(() => { fetchRegistration() }, [fetchRegistration])

  const handleSave = async () => {
    if (!registration) return

    // Client-side required validation
    for (const q of registration.event.questions) {
      if (!q.required) continue
      const answer = answers[q.id] || ""
      const hasValue = q.type === "checkbox"
        ? parseCheckboxValue(answer).length > 0
        : answer.trim().length > 0
      if (!hasValue) {
        setError(`Please fill in "${q.label}".`)
        return
      }
    }

    setSaving(true)
    setError("")
    try {
      const answersPayload = registration.event.questions.map(q => ({
        questionId: q.id,
        value: answers[q.id] || "",
      }))
      const res = await fetch(`/api/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersPayload }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaved(true)
      } else {
        setError(data.error || "Failed to save.")
      }
    } catch {
      setError("Unexpected error.")
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-page)",
    border: "0.5px solid var(--border-subtle)",
    borderRadius: 8,
    padding: "0.625rem 0.875rem",
    fontSize: "0.875rem",
    color: "var(--text-primary)",
    fontFamily: "var(--font-dm-sans)",
    outline: "none",
    boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 500,
    letterSpacing: "0.04em",
    color: "var(--text-muted)",
    marginBottom: "0.4rem",
    fontFamily: "var(--font-dm-sans)",
    textTransform: "uppercase",
  }

  if (loading) {
    return (
      <main style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes edit-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--border-emphasis)", borderTopColor: "var(--accent)", animation: "edit-spin 0.8s linear infinite" }} />
      </main>
    )
  }

  if (notFound || !registration) {
    return (
      <main style={{ maxWidth: 480, margin: "3rem auto", padding: "0 1.5rem", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>Registration not found.</p>
      </main>
    )
  }

  const isClosed = registration.event.status === "closed" || registration.event.status === "archived"

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <a
        href={`/registration/${registrationId}`}
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem", padding: 0, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
      >
        ← Back
      </a>

      <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.8rem", color: "var(--text-primary)", fontWeight: 400, marginBottom: "0.35rem" }}>
        Edit registration
      </h1>
      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "2rem" }}>
        {registration.event.title}
        {registration.registrationNumber && (
          <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
            · #{String(registration.registrationNumber).padStart(4, "0")}
          </span>
        )}
      </p>

      {isClosed && (
        <div style={{ background: "color-mix(in srgb, var(--error) 10%, transparent)", border: "0.5px solid color-mix(in srgb, var(--error) 24%, transparent)", borderRadius: 10, padding: "0.875rem 1rem", marginBottom: "1.5rem" }}>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--error)", fontFamily: "var(--font-dm-sans)" }}>
            This event is closed. Your registration details cannot be edited.
          </p>
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {registration.event.questions.map(q => (
          <div key={q.id}>
            <label style={labelStyle}>
              {q.label}
              {q.required && <span style={{ color: "var(--accent)", marginLeft: 4 }}>*</span>}
            </label>
            {q.type === "select" && q.options ? (() => {
              const rawValue = answers[q.id] || ""
              const isOtherSelected = /^(other|nyingine)/i.test(rawValue.trim())
              const customText = isOtherSelected ? rawValue.replace(/^(other|nyingine):\s*/i, "") : ""
              const allOptions = q.options ?? []
              const hasOther = Boolean((q as any).allowOther) || allOptions.some(opt => /^(other|nyingine)/i.test(opt.trim()))
              const regularOptions = allOptions.filter(opt => !/^(other|nyingine)/i.test(opt.trim()))

              return (
                <div style={{ ...inputStyle, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", opacity: isClosed ? 0.5 : 1 }}>
                  {regularOptions.map(opt => {
                    const isSelected = rawValue === opt
                    return (
                      <label key={`${q.id}-${opt}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: isClosed ? "not-allowed" : "pointer", fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)" }}>
                        <input
                          type="radio"
                          name={`edit-mc-${q.id}`}
                          value={opt}
                          checked={isSelected}
                          disabled={isClosed}
                          onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                  {hasOther && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: isClosed ? "not-allowed" : "pointer" }}>
                        <input
                          type="radio"
                          name={`edit-mc-${q.id}`}
                          value="Other"
                          checked={isOtherSelected}
                          disabled={isClosed}
                          onChange={() => {
                            const nextVal = customText.trim() ? `Other: ${customText.trim()}` : "Other"
                            setAnswers(a => ({ ...a, [q.id]: nextVal }))
                          }}
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <span>Other:</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Your answer"
                        value={customText}
                        disabled={isClosed}
                        onFocus={() => {
                          if (!isOtherSelected && !isClosed) {
                            const nextVal = customText.trim() ? `Other: ${customText.trim()}` : "Other"
                            setAnswers(a => ({ ...a, [q.id]: nextVal }))
                          }
                        }}
                        onChange={e => {
                          const val = e.target.value
                          const nextVal = val.trim() ? `Other: ${val.trim()}` : "Other"
                          setAnswers(a => ({ ...a, [q.id]: nextVal }))
                        }}
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          borderBottom: isOtherSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                          color: "var(--text-primary)",
                          outline: "none",
                          padding: "2px 4px",
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })() : q.type === "checkbox" && q.options ? (() => {
              const selectedValues = parseCheckboxValue(answers[q.id])
              const otherItem = selectedValues.find(v => /^(other|nyingine)/i.test(v.trim()))
              const isOtherChecked = Boolean(otherItem)
              const customText = otherItem ? otherItem.replace(/^(other|nyingine):\s*/i, "") : ""
              const allOptions = q.options ?? []
              const hasOther = Boolean((q as any).allowOther) || allOptions.some(opt => /^(other|nyingine)/i.test(opt.trim()))
              const regularOptions = allOptions.filter(opt => !/^(other|nyingine)/i.test(opt.trim()))

              return (
                <div style={{ ...inputStyle, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", opacity: isClosed ? 0.5 : 1 }}>
                  {regularOptions.map(opt => {
                    const isChecked = selectedValues.includes(opt)
                    return (
                      <label key={`${q.id}-${opt}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: isClosed ? "not-allowed" : "pointer", fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isClosed}
                          onChange={e => {
                            const nextValues = e.target.checked
                              ? (q.allowMultiple ? [...selectedValues, opt] : [opt])
                              : selectedValues.filter(value => value !== opt)
                            setAnswers(a => ({ ...a, [q.id]: serializeCheckboxValue(nextValues) }))
                          }}
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                  {hasOther && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: isClosed ? "not-allowed" : "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isOtherChecked}
                          disabled={isClosed}
                          onChange={e => {
                            let next = selectedValues.filter(v => !/^(other|nyingine)/i.test(v.trim()))
                            if (e.target.checked) {
                              const item = customText.trim() ? `Other: ${customText.trim()}` : "Other"
                              next = q.allowMultiple ? [...next, item] : [item]
                            }
                            setAnswers(a => ({ ...a, [q.id]: serializeCheckboxValue(next) }))
                          }}
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <span>Other:</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Your answer"
                        value={customText}
                        disabled={isClosed}
                        onFocus={() => {
                          if (!isOtherChecked && !isClosed) {
                            const item = customText.trim() ? `Other: ${customText.trim()}` : "Other"
                            const next = q.allowMultiple
                              ? [...selectedValues.filter(v => !/^(other|nyingine)/i.test(v.trim())), item]
                              : [item]
                            setAnswers(a => ({ ...a, [q.id]: serializeCheckboxValue(next) }))
                          }
                        }}
                        onChange={e => {
                          const val = e.target.value
                          const item = val.trim() ? `Other: ${val.trim()}` : "Other"
                          const base = selectedValues.filter(v => !/^(other|nyingine)/i.test(v.trim()))
                          const next = q.allowMultiple ? [...base, item] : [item]
                          setAnswers(a => ({ ...a, [q.id]: serializeCheckboxValue(next) }))
                        }}
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          borderBottom: isOtherChecked ? "1px solid var(--accent)" : "1px solid var(--border)",
                          color: "var(--text-primary)",
                          outline: "none",
                          padding: "2px 4px",
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })() : (
              <input
                type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"}
                value={answers[q.id] || ""}
                disabled={isClosed}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                style={{ ...inputStyle, cursor: isClosed ? "not-allowed" : undefined, opacity: isClosed ? 0.5 : 1 }}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "var(--error)", fontFamily: "var(--font-dm-sans)" }}>{error}</p>
      )}

      {saved && (
        <div style={{ marginTop: "1.25rem", background: "var(--accent-dim)", border: "0.5px solid var(--border-emphasis)", borderRadius: 10, padding: "0.875rem 1rem" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--accent)", fontFamily: "var(--font-dm-sans)" }}>
            Your registration has been updated.
          </p>
        </div>
      )}

      {!isClosed && (
        <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            style={{ background: saved ? "var(--border-emphasis)" : "var(--accent)", border: "none", borderRadius: 8, padding: "0.65rem 1.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A", cursor: saving || saved ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : saved ? "Updated!" : "Update my registration"}
          </button>
          {saved && (
            <a
              href={`/registration/${registrationId}`}
              style={{ fontSize: "0.82rem", color: "var(--accent)", fontFamily: "var(--font-dm-sans)", textDecoration: "none" }}
            >
              View registration →
            </a>
          )}
        </div>
      )}
    </main>
  )
}
