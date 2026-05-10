"use client"

import { useEffect, useState } from "react"

export default function BroadcastPage() {
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [sampleRecipients, setSampleRecipients] = useState<Array<{ email: string; name: string | null }> | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const [subject, setSubject] = useState("")
  const [html, setHtml] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Load recipient count and samples on mount
  useEffect(() => {
    let cancelled = false
    setCountLoading(true)
    setRecipientCount(null)
    fetch(`/api/admin/broadcast`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          setRecipientCount(d.recipientCount ?? 0)
          setSampleRecipients(d.sampleRecipients ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecipientCount(null)
          setSampleRecipients(null)
        }
      })
      .finally(() => { if (!cancelled) setCountLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleSend() {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        const accepted = Number(data.accepted ?? 0)
        const failed = Number(data.failed ?? 0)
        const attempted = Number(data.attempted ?? accepted + failed)
        const base = `Accepted by provider: ${accepted}/${attempted}.`
        const failureNote = failed > 0 ? ` ${failed} recipient${failed === 1 ? "" : "s"} failed.` : ""
        setResult({ ok: failed === 0, message: `${base}${failureNote}` })
        setSubject("")
        setHtml("")
      } else {
        setResult({ ok: false, message: data.error ?? "Failed to send." })
      }
    } catch {
      setResult({ ok: false, message: "Network error." })
    } finally {
      setSending(false)
      setShowConfirm(false)
    }
  }

  const canSend = subject.trim().length > 0 && html.trim().length > 0 && !sending

  return (
    <div style={{ maxWidth: 680 }}>
      <style>{`
        .bc-ghost:hover { background: rgba(240,237,230,0.06) !important; }
        .bc-btn:hover:not(:disabled) { opacity: 0.85; }
      `}</style>

      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.6rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.3rem" }}>
          Email Broadcast
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
          Send emails to users who opted in for marketing messages.
        </p>
      </div>

      {result && (
        <div
          style={{
            background: result.ok ? "rgba(200,245,90,0.08)" : "rgba(255,107,107,0.08)",
            border: `0.5px solid ${result.ok ? "rgba(200,245,90,0.3)" : "rgba(255,107,107,0.3)"}`,
            borderRadius: 10,
            padding: "0.875rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <span style={{ fontSize: "0.875rem", color: result.ok ? "#C8F55A" : "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>
            {result.message}
          </span>
          <button
            onClick={() => setResult(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(240,237,230,0.3)", fontSize: "1rem", padding: 0, lineHeight: 1 }}
          >
            x
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Audience */}
        <section style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1rem" }}>
            Recipients
          </h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)" }}>
            {countLoading
              ? "Loading recipient count..."
              : recipientCount === null
              ? "—"
              : `${recipientCount} user${recipientCount === 1 ? "" : "s"} opted in for marketing emails`}
          </p>
          {sampleRecipients && sampleRecipients.length > 0 && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "0.5px solid rgba(240,237,230,0.08)" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Sample recipients
              </p>
              <ul style={{ margin: 0, padding: "0 0 0 1.25rem", listStyle: "none" }}>
                {sampleRecipients.slice(0, 5).map((r, i) => (
                  <li key={i} style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>
                    {r.name ? `${r.name} (${r.email})` : r.email}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Composer */}
        <section style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>
            Compose
          </h2>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.4rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject line"
              style={{
                width: "100%",
                background: "#0A0A0A",
                border: "0.5px solid rgba(240,237,230,0.12)",
                borderRadius: 8,
                padding: "0.625rem 0.875rem",
                fontSize: "0.875rem",
                color: "#F0EDE6",
                fontFamily: "var(--font-dm-sans)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.4rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              HTML Content
            </label>
            <textarea
              value={html}
              onChange={e => setHtml(e.target.value)}
              placeholder="Paste your HTML email content here..."
              rows={12}
              style={{
                width: "100%",
                background: "#0A0A0A",
                border: "0.5px solid rgba(240,237,230,0.12)",
                borderRadius: 8,
                padding: "0.75rem 0.875rem",
                fontSize: "0.8rem",
                color: "#F0EDE6",
                fontFamily: "monospace",
                outline: "none",
                resize: "vertical",
                lineHeight: 1.5,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
            <button
              onClick={() => setShowPreview(v => !v)}
              className="bc-ghost"
              style={{
                background: "transparent",
                border: "0.5px solid rgba(240,237,230,0.14)",
                borderRadius: 8,
                padding: "0.5rem 1rem",
                fontSize: "0.82rem",
                color: "rgba(240,237,230,0.55)",
                cursor: "pointer",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {showPreview ? "Hide preview" : "Preview email"}
            </button>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={!canSend}
              className="bc-btn"
              style={{
                background: canSend ? "#C8F55A" : "rgba(200,245,90,0.2)",
                border: "none",
                borderRadius: 8,
                padding: "0.5rem 1.25rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: canSend ? "#0A0A0A" : "rgba(0,0,0,0.35)",
                cursor: canSend ? "pointer" : "not-allowed",
                fontFamily: "var(--font-dm-sans)",
                transition: "background 0.15s",
              }}
            >
              Send broadcast
            </button>
          </div>
        </section>

        {/* Preview */}
        {showPreview && (
          <section style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
            <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1rem" }}>
              Preview
            </h2>
            <div style={{ background: "#0A0A0A", borderRadius: 10, padding: "1.5rem", border: "0.5px solid rgba(240,237,230,0.06)", overflowX: "auto" }}>
              <div style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem" }}>
                <span style={{ color: "rgba(240,237,230,0.5)" }}>Subject:</span> {subject || <em style={{ opacity: 0.4 }}>No subject</em>}
              </div>
              <div
                dangerouslySetInnerHTML={{ __html: html || "<p style='opacity:0.4'>No HTML content yet</p>" }}
              />
            </div>
          </section>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <>
          <div
            onClick={() => !sending && setShowConfirm(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 60 }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 61,
              background: "#1A1A1A",
              border: "0.5px solid rgba(240,237,230,0.1)",
              borderRadius: 16,
              padding: "1.75rem",
              width: "min(92vw, 440px)",
            }}
          >
            <div
              style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(200,245,90,0.1)",
                border: "0.5px solid rgba(200,245,90,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 13l4-4 3 3 7-7" stroke="#C8F55A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", margin: "0 0 0.5rem" }}>
              Send broadcast?
            </h3>
            <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
              You are about to send to{" "}
              <strong style={{ color: "rgba(240,237,230,0.8)" }}>
                {recipientCount ?? "..."} user{recipientCount !== 1 ? "s" : ""}
              </strong>
              . This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={sending}
                style={{
                  background: "transparent",
                  border: "0.5px solid rgba(240,237,230,0.15)",
                  borderRadius: 8,
                  padding: "0.5rem 1rem",
                  fontSize: "0.82rem",
                  color: "rgba(240,237,230,0.5)",
                  cursor: sending ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  background: sending ? "rgba(200,245,90,0.4)" : "#C8F55A",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#0A0A0A",
                  cursor: sending ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-dm-sans)",
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? "Sending..." : "Confirm & send"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
