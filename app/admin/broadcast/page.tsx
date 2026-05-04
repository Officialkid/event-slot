"use client"

import { useEffect, useState } from "react"

type PlanFilter = "all" | "free"

const PLAN_OPTIONS: { key: PlanFilter; label: string }[] = [
  { key: "all", label: "All users" },
  { key: "free", label: "Free users" },
]

function buildPreviewHtml(name: string, body: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6;border-radius:12px;">
      <div style="color:#C8F55A;font-size:0.95rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
      <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.65;margin:0;white-space:pre-wrap">${body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>
      <p style="margin-top:2.5rem;color:rgba(240,237,230,0.25);font-size:0.7rem">You received this message from EventSlot. © ${new Date().getFullYear()} EventSlot.</p>
    </div>
  `
}

export default function BroadcastPage() {
  const [selected, setSelected] = useState<PlanFilter[]>(["all"])
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  function togglePlan(key: PlanFilter) {
    if (key === "all") {
      setSelected(["all"])
      return
    }
    setSelected(prev => {
      const withoutAll = prev.filter(p => p !== "all")
      if (withoutAll.includes(key)) {
        const next = withoutAll.filter(p => p !== key)
        return next.length === 0 ? ["all"] : next
      }
      return [...withoutAll, key]
    })
  }

  useEffect(() => {
    let cancelled = false
    setCountLoading(true)
    setRecipientCount(null)
    const params = new URLSearchParams({ plans: selected.join(",") })
    fetch(`/api/admin/broadcast/count?${params}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setRecipientCount(d.count ?? 0) })
      .catch(() => { if (!cancelled) setRecipientCount(null) })
      .finally(() => { if (!cancelled) setCountLoading(false) })
    return () => { cancelled = true }
  }, [selected])

  async function handleSend() {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: selected, subject, body }),
      })
      const data = await res.json()
      if (res.ok) {
        const accepted = Number(data.accepted ?? 0)
        const failed = Number(data.failed ?? 0)
        const attempted = Number(data.attempted ?? accepted + failed)
        const base = `Accepted by provider: ${accepted}/${attempted}.`
        const failureNote = failed > 0 ? ` ${failed} recipient${failed === 1 ? "" : "s"} failed.` : ""
        setResult({ ok: failed === 0, message: `${base}${failureNote}` })
        setSubject("")
        setBody("")
        setSelected(["all"])
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

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending

  return (
    <div style={{ maxWidth: 680 }}>
      <style>{`
        .bc-pill { transition: background 0.13s, border-color 0.13s, color 0.13s; }
        .bc-pill:hover { opacity: 0.9; }
        .bc-btn:hover:not(:disabled) { opacity: 0.85; }
        .bc-ghost:hover { background: rgba(240,237,230,0.06) !important; }
      `}</style>

      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.6rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.3rem" }}>
          Email Broadcast
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
          Send a message to a group of users.
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
            ×
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Audience */}
        <section style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1rem" }}>
            Audience
          </h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.875rem" }}>
            {PLAN_OPTIONS.map(opt => {
              const active = selected.includes(opt.key)
              return (
                <button
                  key={opt.key}
                  onClick={() => togglePlan(opt.key)}
                  className="bc-pill"
                  style={{
                    padding: "0.4rem 0.9rem",
                    borderRadius: 100,
                    border: active
                      ? "0.5px solid rgba(200,245,90,0.5)"
                      : "0.5px solid rgba(240,237,230,0.15)",
                    background: active ? "rgba(200,245,90,0.12)" : "transparent",
                    color: active ? "#C8F55A" : "rgba(240,237,230,0.5)",
                    fontSize: "0.82rem",
                    fontWeight: active ? 500 : 400,
                    fontFamily: "var(--font-dm-sans)",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
            {countLoading
              ? "Counting recipients…"
              : recipientCount === null
              ? "—"
              : `Sending to ${recipientCount} user${recipientCount === 1 ? "" : "s"}`}
          </p>
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
              placeholder="Your subject line"
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
              Message
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message here…"
              rows={10}
              style={{
                width: "100%",
                background: "#0A0A0A",
                border: "0.5px solid rgba(240,237,230,0.12)",
                borderRadius: 8,
                padding: "0.75rem 0.875rem",
                fontSize: "0.875rem",
                color: "#F0EDE6",
                fontFamily: "var(--font-dm-sans)",
                outline: "none",
                resize: "vertical",
                lineHeight: 1.65,
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
            <div style={{ background: "#0A0A0A", borderRadius: 10, padding: "1.5rem", border: "0.5px solid rgba(240,237,230,0.06)" }}>
              <div style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.875rem" }}>
                <span style={{ color: "rgba(240,237,230,0.5)" }}>Subject:</span> {subject || <em style={{ opacity: 0.4 }}>No subject</em>}
              </div>
              <div
                dangerouslySetInnerHTML={{ __html: buildPreviewHtml("there", body || "No message body yet.") }}
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
                {recipientCount ?? "…"} user{recipientCount !== 1 ? "s" : ""}
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
                {sending ? "Sending…" : "Confirm & send"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
