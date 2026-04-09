"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function SetupUsernamePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [username, setUsername] = useState("")
  const [checking, setChecking] = useState(false)
  const [availability, setAvailability] = useState<{
    available: boolean
    error?: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Redirect if already has username
  useEffect(() => {
    if (status === "authenticated" && session?.user?.username) {
      router.replace("/dashboard")
    }
  }, [status, session, router])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setUsername(val)
    setAvailability(null)
    setSaveError("")

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (val.length < 3) return

    debounceRef.current = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(val)}`)
        const data = await res.json()
        setAvailability(data)
      } finally {
        setChecking(false)
      }
    }, 400)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!availability?.available) return
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch("/api/users/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error ?? "Failed to save username")
        return
      }
      await update()
      router.push("/dashboard")
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading") return null

  if (status === "unauthenticated") {
    router.replace("/signin")
    return null
  }

  const hint =
    availability === null
      ? null
      : availability.error
      ? { ok: false, text: availability.error }
      : availability.available
      ? { ok: true, text: "Available" }
      : { ok: false, text: "Already taken" }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Card */}
        <div
          style={{
            background: "#141414",
            border: "0.5px solid rgba(240,237,230,0.08)",
            borderRadius: 16,
            padding: "2rem",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.8rem",
              color: "#F0EDE6",
              margin: "0 0 0.375rem",
              fontWeight: 400,
            }}
          >
            Choose your organizer name
          </h1>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontWeight: 300,
              fontSize: "0.9rem",
              color: "rgba(240,237,230,0.5)",
              margin: "0 0 1.75rem",
            }}
          >
            This gives you a public profile page at{" "}
            <span style={{ color: "rgba(240,237,230,0.7)" }}>eventslot.co/your-name</span>.
            {" "}You can skip this and set it up later in your profile settings.
          </p>

          <form onSubmit={handleSubmit}>
            {/* URL prefix + input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#0A0A0A",
                border: `0.5px solid ${
                  hint
                    ? hint.ok
                      ? "rgba(200,245,90,0.4)"
                      : "rgba(255,90,90,0.4)"
                    : "rgba(240,237,230,0.12)"
                }`,
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  padding: "0.75rem 0 0.75rem 1rem",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.9rem",
                  color: "rgba(240,237,230,0.35)",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                eventslot.co/
              </span>
              <input
                type="text"
                value={username}
                onChange={handleChange}
                placeholder="your-name"
                maxLength={20}
                autoFocus
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "0.75rem 1rem 0.75rem 0",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.9rem",
                  color: "#F0EDE6",
                }}
              />
              {checking && (
                <span
                  style={{
                    padding: "0 1rem",
                    fontSize: "0.75rem",
                    color: "rgba(240,237,230,0.4)",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  …
                </span>
              )}
            </div>

            {/* Availability hint */}
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.8rem",
                color: hint
                  ? hint.ok
                    ? "#C8F55A"
                    : "rgba(255,100,100,0.9)"
                  : "transparent",
                margin: "0 0 1.25rem",
                minHeight: "1.1rem",
              }}
            >
              {hint ? (hint.ok ? `✓ ${hint.text}` : `✕ ${hint.text}`) : " "}
            </p>

            {saveError && (
              <p
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.82rem",
                  color: "rgba(255,100,100,0.9)",
                  margin: "0 0 1rem",
                }}
              >
                {saveError}
              </p>
            )}

            <button
              type="submit"
              disabled={!availability?.available || saving}
              style={{
                width: "100%",
                background:
                  availability?.available && !saving ? "#C8F55A" : "rgba(240,237,230,0.08)",
                color:
                  availability?.available && !saving ? "#0A0A0A" : "rgba(240,237,230,0.3)",
                border: "none",
                borderRadius: 100,
                padding: "0.75rem 1rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                fontFamily: "var(--font-dm-sans)",
                cursor: availability?.available && !saving ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
              }}
            >
              {saving ? "Saving…" : "Set username"}
            </button>
          </form>

          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.78rem",
              color: "rgba(240,237,230,0.3)",
              margin: "1.25rem 0 0",
              textAlign: "center",
            }}
          >
            3–20 characters · letters, numbers, and hyphens only
          </p>

          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <a
              href="/dashboard"
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.8rem",
                color: "rgba(240,237,230,0.3)",
                textDecoration: "underline",
                textDecorationColor: "rgba(240,237,230,0.15)",
                cursor: "pointer",
              }}
            >
              Skip for now
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
