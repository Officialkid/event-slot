"use client"

import React, { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { markFeatureUsed } from "@/lib/markFeatureUsed"

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type EventSummary = { id: string; title: string; slug: string; status: string }

type TeamMemberRecord = {
  id: string
  email: string
  status: "pending" | "accepted"
  createdAt: string
  member: { name: string | null; email: string | null; image: string | null } | null
  eventAccess?: Array<{ event: EventSummary }>
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(" ")
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0]?.toUpperCase() ?? "?"
  }
  return email[0]?.toUpperCase() ?? "?"
}


// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function TeamPage() {
  useSession()

  const [members, setMembers] = useState<TeamMemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [userPlan, setUserPlan] = useState<string>("free")
  const [maxMembers, setMaxMembers] = useState<number>(0)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")
  const [inviting, setSending] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState("")
  const [resendFailedUrls, setResendFailedUrls] = useState<Record<string, string>>({})
  const [inviteAcceptUrl, setInviteAcceptUrl] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Event assignment modal
  const [orgEvents, setOrgEvents] = useState<EventSummary[]>([])
  const [assignModal, setAssignModal] = useState<{ memberId: string; memberLabel: string; currentIds: string[] } | null>(null)
  const [assignSelectedIds, setAssignSelectedIds] = useState<string[]>([])
  const [assignSaving, setAssignSaving] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)

  // Load plan info + members
  useEffect(() => {
    markFeatureUsed("team")
    async function load() {
      try {
        const [meRes, membersRes] = await Promise.all([
          fetch("/api/me"),
          fetch("/api/team/members"),
        ])
        if (meRes.ok) {
          const me = await meRes.json()
          const p = me.plan ?? "free"
          setUserPlan(p)
          setMaxMembers(
            p === "business" ? 20 : p === "pro" ? 10 : 1
          )
        }
        if (membersRes.ok) {
          const data = await membersRes.json()
          setMembers(data.members ?? [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const accepted = members.filter(m => m.status === "accepted")
  const pending = members.filter(m => m.status === "pending")
  const activeCount = accepted.length + pending.length

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError("")
    setInviteSuccess("")
    const email = inviteEmail.trim()
    if (!email) return
    setSending(true)
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error ?? "Failed to send invite")
        return
      }
      if (data.emailFailed) {
        setInviteSuccess(`Invite created for ${email} — email delivery failed, share the link below.`)
        setInviteAcceptUrl(data.acceptUrl ?? "")
      } else {
        setInviteSuccess(`Invite sent to ${email}`)
      }
      setInviteEmail("")
      // Refresh list
      const mr = await fetch("/api/team/members")
      if (mr.ok) {
        const d = await mr.json()
        setMembers(d.members ?? [])
      }
    } finally {
      setSending(false)
    }
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId)
    try {
      await fetch(`/api/team/${memberId}`, { method: "DELETE" })
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } finally {
      setRemovingId(null)
      setConfirmRemoveId(null)
    }
  }

  async function handleResend(memberId: string) {
    setResendingId(memberId)
    setResendSuccess("")
    try {
      const res = await fetch("/api/team/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.emailFailed && data.acceptUrl) {
          setResendFailedUrls(prev => ({ ...prev, [memberId]: data.acceptUrl }))
        } else {
          setResendSuccess(memberId)
          setTimeout(() => setResendSuccess(""), 3000)
        }
      }
    } finally {
      setResendingId(null)
    }
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(key)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      // fallback
    }
  }

  async function openAssignModal(m: TeamMemberRecord) {
    if (orgEvents.length === 0) {
      const res = await fetch("/api/team/events")
      if (res.ok) {
        const data = await res.json()
        setOrgEvents(data.events ?? [])
      }
    }
    const currentIds = (m.eventAccess ?? []).map(a => a.event.id)
    setAssignSelectedIds(currentIds)
    setAssignModal({ memberId: m.id, memberLabel: m.member?.name ?? m.email, currentIds })
  }

  async function handleSaveAccess() {
    if (!assignModal) return
    setAssignSaving(true)
    try {
      await fetch(`/api/team/${assignModal.memberId}/events`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: assignSelectedIds }),
      })
      // Refresh member list
      const mr = await fetch("/api/team/members")
      if (mr.ok) {
        const d = await mr.json()
        setMembers(d.members ?? [])
      }
      setAssignModal(null)
    } finally {
      setAssignSaving(false)
    }
  }

  // â”€â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <style>{`@keyframes tm-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
        <div style={{ height: 36, borderRadius: 8, background: "#141414", marginBottom: "0.5rem", animation: "tm-pulse 1.4s ease-in-out infinite", maxWidth: 220 }} />
        <div style={{ height: 18, borderRadius: 6, background: "#141414", marginBottom: "2rem", animation: "tm-pulse 1.4s ease-in-out infinite", maxWidth: 320 }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 68, borderRadius: 10, background: "#141414", marginBottom: "0.75rem", animation: "tm-pulse 1.4s ease-in-out infinite" }} />
        ))}
      </div>
    )
  }

  // â”€â”€â”€ Confirm remove dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const confirmTarget = confirmRemoveId ? members.find(m => m.id === confirmRemoveId) : null

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Confirm remove dialog */}
      {confirmTarget && (
        <>
          <div
            onClick={() => setConfirmRemoveId(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60 }}
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
              padding: "2rem",
              width: "min(92vw,400px)",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", marginBottom: "0.75rem" }}>
              Remove member?
            </h3>
            <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.5)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              {confirmTarget.status === "accepted"
                ? `${confirmTarget.member?.name ?? confirmTarget.email} will lose access to your events.`
                : `The pending invite for ${confirmTarget.email} will be cancelled.`}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmRemoveId(null)}
                style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, color: "rgba(240,237,230,0.5)", fontSize: "0.8125rem", padding: "0.5rem 1rem", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(confirmTarget.id)}
                disabled={removingId === confirmTarget.id}
                style={{ background: "rgba(239,68,68,0.12)", border: "0.5px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#EF4444", fontSize: "0.8125rem", padding: "0.5rem 1rem", cursor: "pointer", opacity: removingId === confirmTarget.id ? 0.6 : 1 }}
              >
                {removingId === confirmTarget.id ? "Removingâ€¦" : "Remove"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Event access assignment modal */}
      {assignModal && (
        <>
          <div
            onClick={() => setAssignModal(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60 }}
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
              width: "min(92vw,480px)",
              fontFamily: "var(--font-dm-sans)",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", marginBottom: "0.25rem" }}>
              Manage event access
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "rgba(240,237,230,0.4)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
              Choose which events <strong style={{ color: "rgba(240,237,230,0.7)" }}>{assignModal.memberLabel}</strong> can access.
            </p>
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {orgEvents.length === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: "rgba(240,237,230,0.35)", textAlign: "center", padding: "1rem 0" }}>
                  No events found.
                </p>
              ) : (
                orgEvents.map(ev => {
                  const checked = assignSelectedIds.includes(ev.id)
                  return (
                    <label
                      key={ev.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        background: checked ? "rgba(200,245,90,0.05)" : "rgba(240,237,230,0.03)",
                        border: `0.5px solid ${checked ? "rgba(200,245,90,0.2)" : "rgba(240,237,230,0.07)"}`,
                        borderRadius: 8,
                        padding: "0.6875rem 0.875rem",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAssignSelectedIds(prev =>
                            prev.includes(ev.id) ? prev.filter(id => id !== ev.id) : [...prev, ev.id]
                          )
                        }
                        style={{ accentColor: "#C8F55A", width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, fontSize: "0.875rem", color: "rgba(240,237,230,0.85)", lineHeight: 1.4, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.title}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          borderRadius: 5,
                          padding: "0.15rem 0.4rem",
                          background: ev.status === "active" ? "rgba(200,245,90,0.1)" : "rgba(240,237,230,0.06)",
                          color: ev.status === "active" ? "#C8F55A" : "rgba(240,237,230,0.35)",
                          flexShrink: 0,
                        }}
                      >
                        {ev.status}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setAssignModal(null)}
                style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, color: "rgba(240,237,230,0.5)", fontSize: "0.8125rem", padding: "0.5rem 1rem", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAccess}
                disabled={assignSaving}
                style={{ background: "#C8F55A", color: "#0A0A0A", fontWeight: 600, fontSize: "0.8125rem", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", cursor: assignSaving ? "not-allowed" : "pointer", opacity: assignSaving ? 0.7 : 1 }}
              >
                {assignSaving ? "Saving…" : "Save access"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <h1
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "1.6rem",
          color: "#F0EDE6",
          marginBottom: "0.375rem",
          fontWeight: 400,
        }}
      >
        Your team
      </h1>
      <p
        style={{
          fontSize: "0.8rem",
          color: "rgba(240,237,230,0.4)",
          fontFamily: "var(--font-dm-sans)",
          marginBottom: "0.75rem",
        }}
      >
        {activeCount} of {maxMembers} team {maxMembers === 1 ? "member" : "members"}
      </p>

      {/* Team usage progress bar */}
      <div
        style={{
          height: 3,
          borderRadius: 100,
          background: "rgba(240,237,230,0.07)",
          marginBottom: "1.5rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 100,
            background: "#C8F55A",
            width: `${Math.min(100, maxMembers > 0 ? (activeCount / maxMembers) * 100 : 0)}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Team limit note */}
      <div
        style={{
          background: "rgba(200,245,90,0.04)",
          border: "0.5px solid rgba(200,245,90,0.12)",
          borderRadius: 10,
          padding: "0.875rem 1rem",
          marginBottom: "1.75rem",
          fontSize: "0.82rem",
          color: "rgba(240,237,230,0.5)",
          fontFamily: "var(--font-dm-sans)",
          lineHeight: 1.55,
        }}
      >
        Team workspaces support up to 10 members.
      </div>

      {/* Current members */}
      {accepted.length > 0 && (
        <section style={{ marginBottom: "1.75rem" }}>
          <h2
            style={{
              fontSize: "0.8125rem",
              fontFamily: "var(--font-dm-sans)",
              fontWeight: 500,
              color: "rgba(240,237,230,0.35)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: "0.625rem",
            }}
          >
            Members
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {accepted.map(m => {
              const displayName = m.member?.name ?? m.email
              const displayEmail = m.member?.email ?? m.email
              const initials = getInitials(m.member?.name ?? null, m.email)
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.875rem",
                    background: "#141414",
                    border: "0.5px solid rgba(240,237,230,0.06)",
                    borderRadius: 10,
                    padding: "0.75rem 1rem",
                  }}
                >
                  {/* Initials circle */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(200,245,90,0.15)",
                      border: "0.5px solid rgba(200,245,90,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#C8F55A",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-dm-sans)",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "rgba(240,237,230,0.85)",
                        fontFamily: "var(--font-dm-sans)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {displayName}
                    </div>
                    {m.member?.name && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "rgba(240,237,230,0.35)",
                          fontFamily: "var(--font-dm-sans)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {displayEmail}
                      </div>
                    )}
                  </div>
                  {/* Badge */}
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontFamily: "var(--font-dm-sans)",
                      color: "rgba(240,237,230,0.4)",
                      background: "rgba(240,237,230,0.06)",
                      borderRadius: 6,
                      padding: "0.2rem 0.5rem",
                      flexShrink: 0,
                    }}
                  >
                    {(m.eventAccess?.length ?? 0) > 0 ? `${m.eventAccess!.length} event${m.eventAccess!.length !== 1 ? "s" : ""}` : "No events"}
                  </span>
                  {/* Manage access button */}
                  <button
                    onClick={() => openAssignModal(m)}
                    style={{
                      background: "transparent",
                      border: "0.5px solid rgba(200,245,90,0.2)",
                      borderRadius: 7,
                      color: "#C8F55A",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-dm-sans)",
                      padding: "0.3rem 0.625rem",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Manage access
                  </button>
                  {/* Remove button */}
                  <button
                    onClick={() => setConfirmRemoveId(m.id)}
                    style={{
                      background: "transparent",
                      border: "0.5px solid rgba(239,68,68,0.2)",
                      borderRadius: 7,
                      color: "#EF4444",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-dm-sans)",
                      padding: "0.3rem 0.625rem",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <section style={{ marginBottom: "1.75rem" }}>
          <h2
            style={{
              fontSize: "0.8125rem",
              fontFamily: "var(--font-dm-sans)",
              fontWeight: 500,
              color: "rgba(240,237,230,0.35)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: "0.625rem",
            }}
          >
            Pending invites
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pending.map(m => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.06)",
                  borderRadius: 10,
                  padding: "0.75rem 1rem",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: "0.875rem",
                    color: "rgba(240,237,230,0.7)",
                    fontFamily: "var(--font-dm-sans)",
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.email}
                </span>
                {/* Pending badge */}
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontFamily: "var(--font-dm-sans)",
                    background: "rgba(250,199,117,0.1)",
                    color: "#FAC775",
                    borderRadius: 6,
                    padding: "0.2rem 0.5rem",
                    flexShrink: 0,
                  }}
                >
                  Pending
                </span>
                {/* Resend */}
                <button
                  onClick={() => handleResend(m.id)}
                  disabled={resendingId === m.id}
                  style={{
                    background: "transparent",
                    border: "0.5px solid rgba(240,237,230,0.12)",
                    borderRadius: 7,
                    color: resendSuccess === m.id ? "#C8F55A" : "rgba(240,237,230,0.5)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-dm-sans)",
                    padding: "0.3rem 0.625rem",
                    cursor: "pointer",
                    flexShrink: 0,
                    opacity: resendingId === m.id ? 0.6 : 1,
                    transition: "color 0.2s",
                  }}
                >
                  {resendSuccess === m.id ? "Sent!" : resendingId === m.id ? "Sendingâ€¦" : "Resend invite"}
                </button>                {/* Copy link (shown when resend email failed) */}
                {resendFailedUrls[m.id] && (
                  <button
                    onClick={() => copyToClipboard(resendFailedUrls[m.id], `resend-${m.id}`)}
                    style={{
                      background: "transparent",
                      border: "0.5px solid rgba(200,245,90,0.2)",
                      borderRadius: 7,
                      color: copiedId === `resend-${m.id}` ? "#C8F55A" : "rgba(200,245,90,0.7)",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-dm-sans)",
                      padding: "0.3rem 0.625rem",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {copiedId === `resend-${m.id}` ? "Copied!" : "Copy link"}
                  </button>
                )}                {/* Cancel */}
                <button
                  onClick={() => setConfirmRemoveId(m.id)}
                  style={{
                    background: "transparent",
                    border: "0.5px solid rgba(239,68,68,0.2)",
                    borderRadius: 7,
                    color: "#EF4444",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-dm-sans)",
                    padding: "0.3rem 0.625rem",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state for members and pending */}
      {accepted.length === 0 && pending.length === 0 && (
        <div
          style={{
            background: "#141414",
            border: "0.5px solid rgba(240,237,230,0.06)",
            borderRadius: 12,
            padding: "2rem",
            textAlign: "center",
            marginBottom: "1.75rem",
          }}
        >
          <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
            No team members yet. Send an invite below.
          </p>
        </div>
      )}

      {/* Invite form */}
      <section>
        <h2
          style={{
            fontSize: "0.8125rem",
            fontFamily: "var(--font-dm-sans)",
            fontWeight: 500,
            color: "rgba(240,237,230,0.35)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: "0.625rem",
          }}
        >
          Invite a team member
        </h2>
        <div
          style={{
            background: "#141414",
            border: "0.5px solid rgba(240,237,230,0.08)",
            borderRadius: 12,
            padding: "1.25rem",
          }}
        >
          {activeCount >= maxMembers ? (
            <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
              You&apos;ve reached your team member limit ({maxMembers}). Remove a member to invite another.
            </p>
          ) : (
            <form onSubmit={handleInvite} style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
              <input
                ref={emailRef}
                type="email"
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteError(""); setInviteSuccess(""); setInviteAcceptUrl("") }}
                placeholder="teammate@example.com"
                required
                style={{
                  flex: 1,
                  minWidth: 200,
                  background: "rgba(240,237,230,0.04)",
                  border: "0.5px solid rgba(240,237,230,0.12)",
                  borderRadius: 8,
                  padding: "0.5625rem 0.875rem",
                  color: "#F0EDE6",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.875rem",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={inviting}
                style={{
                  background: "#C8F55A",
                  color: "#0A0A0A",
                  fontFamily: "var(--font-dm-sans)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.5625rem 1.25rem",
                  cursor: inviting ? "not-allowed" : "pointer",
                  opacity: inviting ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {inviting ? "Sendingâ€¦" : "Send invite"}
              </button>
            </form>
          )}
          {inviteError && (
            <p style={{ marginTop: "0.625rem", fontSize: "0.8125rem", color: "#EF4444", fontFamily: "var(--font-dm-sans)" }}>
              {inviteError}
            </p>
          )}
          {inviteSuccess && (
            <div style={{ marginTop: "0.625rem" }}>
              <p style={{ fontSize: "0.8125rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", marginBottom: inviteAcceptUrl ? "0.5rem" : 0 }}>
                {inviteSuccess}
              </p>
              {inviteAcceptUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: "0.75rem",
                      color: "rgba(240,237,230,0.4)",
                      fontFamily: "var(--font-dm-sans)",
                      background: "rgba(240,237,230,0.04)",
                      border: "0.5px solid rgba(240,237,230,0.08)",
                      borderRadius: 6,
                      padding: "0.375rem 0.625rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {inviteAcceptUrl}
                  </span>
                  <button
                    onClick={() => copyToClipboard(inviteAcceptUrl, "invite")}
                    style={{
                      background: "#C8F55A",
                      color: "#0A0A0A",
                      fontFamily: "var(--font-dm-sans)",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      border: "none",
                      borderRadius: 6,
                      padding: "0.375rem 0.875rem",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {copiedId === "invite" ? "Copied!" : "Copy link"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
