"use client"

import React, { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { markFeatureUsed } from "@/lib/markFeatureUsed"
import { TEAM_MEMBER_LIMIT } from "@/lib/plans"
import { copyTextToClipboard } from "@/lib/browserClipboard"

// --- Types ---

type EventSummary = { id: string; title: string; slug: string; status: string }

type TeamMemberRecord = {
  id: string
  email: string
  status: "pending" | "accepted"
  createdAt: string
  member: { name: string | null; email: string | null; image: string | null } | null
  eventAccess?: Array<{ event: EventSummary }>
}

// --- Helpers ---

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(" ")
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0]?.toUpperCase() ?? "?"
  }
  return email[0]?.toUpperCase() ?? "?"
}

const teamSurface = "var(--surface)"
const teamSurfaceAlt = "var(--surface-2)"
const teamBorder = "1px solid var(--border-subtle)"
const teamBorderSoft = "1px solid color-mix(in srgb, var(--border-subtle) 70%, transparent)"
const teamTextPrimary = "var(--text-primary)"
const teamTextSecondary = "var(--text-secondary)"
const teamTextMuted = "var(--text-muted)"
const teamOverlay = "color-mix(in srgb, var(--bg-page) 65%, transparent)"


// --- Page ---

export default function TeamPage() {
  useSession()

  const [members, setMembers] = useState<TeamMemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const maxMembers = TEAM_MEMBER_LIMIT
  const [inviteEmails, setInviteEmails] = useState(["", ""])
  const [inviteErrors, setInviteErrors] = useState<string[]>([])
  const [inviteResults, setInviteResults] = useState<Array<{email:string;ok:boolean;alreadyInvited?:boolean;emailFailed?:boolean;acceptUrl?:string;error?:string}>>([])
  const [inviting, setSending] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState("")
  const [resendFailedUrls, setResendFailedUrls] = useState<Record<string, string>>({})
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
        const membersRes = await fetch("/api/team/members")
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
    setInviteErrors([])
    setInviteResults([])
    const emails = inviteEmails.map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) return
    setSending(true)
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      })
      const data = await res.json()
      const results = data.results ?? []
      if (!res.ok) {
        if (Array.isArray(results) && results.some((result: { acceptUrl?: string }) => result.acceptUrl)) {
          setInviteErrors(["Invite links were created, but email delivery failed. Copy the direct invite link below."])
        } else {
          setInviteErrors([data.error ?? "Failed to send invites"])
        }
      }
      setInviteResults(results)
      // Clear the form on success OR when DB record was created but email failed
      if (res.ok || data.emailFailed) {
        setInviteEmails(["", ""])
      }
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
      const copied = await copyTextToClipboard(text)
      if (!copied) {
        throw new Error("copy failed")
      }
      setCopiedId(key)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      setInviteErrors(["Couldn't copy the invite link automatically. Please copy it manually."])
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

  // --- Loading ---

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <style>{`@keyframes tm-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
        <div style={{ height: 36, borderRadius: 8, background: teamSurfaceAlt, marginBottom: "0.5rem", animation: "tm-pulse 1.4s ease-in-out infinite", maxWidth: 220 }} />
        <div style={{ height: 18, borderRadius: 6, background: teamSurfaceAlt, marginBottom: "2rem", animation: "tm-pulse 1.4s ease-in-out infinite", maxWidth: 320 }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 68, borderRadius: 10, background: teamSurfaceAlt, marginBottom: "0.75rem", animation: "tm-pulse 1.4s ease-in-out infinite" }} />
        ))}
      </div>
    )
  }

  // --- Confirm remove dialog ---

  const confirmTarget = confirmRemoveId ? members.find(m => m.id === confirmRemoveId) : null

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Confirm remove dialog */}
      {confirmTarget && (
        <>
          <div
            onClick={() => setConfirmRemoveId(null)}
            style={{ position: "fixed", inset: 0, background: teamOverlay, zIndex: 60 }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 61,
              background: teamSurface,
              border: teamBorder,
              borderRadius: 16,
              padding: "2rem",
              width: "min(92vw,400px)",
              fontFamily: "var(--font-dm-sans)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: teamTextPrimary, marginBottom: "0.75rem" }}>
              Remove member?
            </h3>
            <p style={{ fontSize: "0.875rem", color: teamTextSecondary, lineHeight: 1.6, marginBottom: "1.5rem" }}>
              {confirmTarget.status === "accepted"
                ? `${confirmTarget.member?.name ?? confirmTarget.email} will lose access to your events.`
                : `The pending invite for ${confirmTarget.email} will be cancelled.`}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmRemoveId(null)}
                style={{ background: "transparent", border: teamBorderSoft, borderRadius: 8, color: teamTextSecondary, fontSize: "0.8125rem", padding: "0.5rem 1rem", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(confirmTarget.id)}
                disabled={removingId === confirmTarget.id}
                style={{ background: "color-mix(in srgb, var(--error) 12%, transparent)", border: "0.5px solid color-mix(in srgb, var(--error) 25%, transparent)", borderRadius: 8, color: "var(--error)", fontSize: "0.8125rem", padding: "0.5rem 1rem", cursor: "pointer", opacity: removingId === confirmTarget.id ? 0.6 : 1 }}
              >
                {removingId === confirmTarget.id ? "Removing..." : "Remove"}
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
            style={{ position: "fixed", inset: 0, background: teamOverlay, zIndex: 60 }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 61,
              background: teamSurface,
              border: teamBorder,
              borderRadius: 16,
              padding: "1.75rem",
              width: "min(92vw,480px)",
              fontFamily: "var(--font-dm-sans)",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: teamTextPrimary, marginBottom: "0.25rem" }}>
              Manage event access
            </h3>
            <p style={{ fontSize: "0.8125rem", color: teamTextSecondary, marginBottom: "1.25rem", lineHeight: 1.5 }}>
              Choose which events <strong style={{ color: teamTextPrimary }}>{assignModal.memberLabel}</strong> can access.
            </p>
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {orgEvents.length === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: teamTextMuted, textAlign: "center", padding: "1rem 0" }}>
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
                        background: checked ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "var(--surface-2)",
                        border: checked ? "0.5px solid color-mix(in srgb, var(--accent) 20%, transparent)" : teamBorderSoft,
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
                        style={{ accentColor: "var(--accent)", width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, fontSize: "0.875rem", color: teamTextPrimary, lineHeight: 1.4, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.title}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          borderRadius: 5,
                          padding: "0.15rem 0.4rem",
                          background: ev.status === "active" ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "color-mix(in srgb, var(--text-primary) 6%, transparent)",
                          color: ev.status === "active" ? "var(--accent)" : teamTextMuted,
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
                style={{ background: "transparent", border: teamBorderSoft, borderRadius: 8, color: teamTextSecondary, fontSize: "0.8125rem", padding: "0.5rem 1rem", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAccess}
                disabled={assignSaving}
                style={{ background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: "0.8125rem", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", cursor: assignSaving ? "not-allowed" : "pointer", opacity: assignSaving ? 0.7 : 1 }}
              >
                {assignSaving ? "Saving..." : "Save access"}
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
          color: teamTextPrimary,
          marginBottom: "0.375rem",
          fontWeight: 400,
        }}
      >
        Your team
      </h1>
      <p
        style={{
          fontSize: "0.875rem",
          color: teamTextSecondary,
          fontFamily: "var(--font-dm-sans)",
          margin: "0 0 0.5rem",
        }}
      >
        {activeCount} active team member{activeCount === 1 ? "" : "s"} across your events
      </p>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: 4,
          background: teamSurfaceAlt,
          borderRadius: 100,
          marginBottom: "1.25rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 100,
            background: "var(--accent)",
            width: `${Math.min(100, (activeCount / 50) * 100)}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Team limit note */}
      <div
        style={{
          background: "color-mix(in srgb, var(--accent) 4%, transparent)",
          border: "0.5px solid color-mix(in srgb, var(--accent) 12%, transparent)",
          borderRadius: 10,
          padding: "0.875rem 1rem",
          marginBottom: "1.75rem",
          fontSize: "0.82rem",
          color: teamTextSecondary,
          fontFamily: "var(--font-dm-sans)",
          lineHeight: 1.55,
        }}
      >
        Team workspaces support up to 10 active collaborators per event.
      </div>

      {/* Current members */}
      {accepted.length > 0 && (
        <section style={{ marginBottom: "1.75rem" }}>
          <h2
            style={{
              fontSize: "0.8125rem",
              fontFamily: "var(--font-dm-sans)",
              fontWeight: 500,
              color: teamTextMuted,
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
              const events = m.eventAccess ?? []
              return (
                <div
                  key={m.id}
                  style={{
                    background: teamSurface,
                    border: teamBorderSoft,
                    borderRadius: 10,
                    padding: "0.75rem 1rem",
                  }}
                >
                  {/* Top row: avatar + name + action buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                    {/* Initials circle */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                        border: "0.5px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--accent)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        fontFamily: "var(--font-dm-sans)",
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    {/* Name / email */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          color: teamTextPrimary,
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
                            color: teamTextMuted,
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
                    {/* Manage access button */}
                    <button
                      onClick={() => openAssignModal(m)}
                      style={{
                        background: "transparent",
                        border: "0.5px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                        borderRadius: 7,
                        color: "var(--accent)",
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
                        border: "0.5px solid color-mix(in srgb, var(--error) 20%, transparent)",
                        borderRadius: 7,
                        color: "var(--error)",
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
                  {/* Event chips row */}
                  <div style={{ marginTop: "0.5rem", paddingLeft: "2.875rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    {events.length === 0 ? (
                      <span style={{ fontSize: "0.6875rem", color: teamTextMuted, fontFamily: "var(--font-dm-sans)" }}>
                        No events assigned
                      </span>
                    ) : (
                      events.map(a => (
                        <span
                          key={a.event.id}
                          style={{
                            fontSize: "0.6875rem",
                            fontFamily: "var(--font-dm-sans)",
                            background: a.event.status === "active" ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "color-mix(in srgb, var(--text-primary) 5%, transparent)",
                            border: `0.5px solid ${a.event.status === "active" ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "var(--border-subtle)"}`,
                            color: a.event.status === "active" ? "var(--accent)" : teamTextSecondary,
                            borderRadius: 5,
                            padding: "0.2rem 0.5rem",
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={a.event.title}
                        >
                          {a.event.title}
                        </span>
                      ))
                    )}
                  </div>
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
              color: teamTextMuted,
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
                  background: teamSurface,
                  border: teamBorderSoft,
                  borderRadius: 10,
                  padding: "0.75rem 1rem",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: "0.875rem",
                    color: teamTextSecondary,
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
                    background: "color-mix(in srgb, var(--warning) 10%, transparent)",
                    color: "var(--warning)",
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
                    border: teamBorderSoft,
                    borderRadius: 7,
                    color: resendSuccess === m.id ? "var(--accent)" : teamTextSecondary,
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-dm-sans)",
                    padding: "0.3rem 0.625rem",
                    cursor: "pointer",
                    flexShrink: 0,
                    opacity: resendingId === m.id ? 0.6 : 1,
                    transition: "color 0.2s",
                  }}
                >
                  {resendSuccess === m.id ? "Sent!" : resendingId === m.id ? "Sending..." : "Resend invite"}
                </button>
                {/* Copy link (shown when resend email failed) */}
                {resendFailedUrls[m.id] && (
                  <button
                    onClick={() => copyToClipboard(resendFailedUrls[m.id], `resend-${m.id}`)}
                    style={{
                      background: "transparent",
                      border: "0.5px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                      borderRadius: 7,
                      color: copiedId === `resend-${m.id}` ? "var(--accent)" : "color-mix(in srgb, var(--accent) 70%, transparent)",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-dm-sans)",
                      padding: "0.3rem 0.625rem",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {copiedId === `resend-${m.id}` ? "Copied!" : "Copy link"}
                  </button>
                )}
                {/* Cancel */}
                <button
                  onClick={() => setConfirmRemoveId(m.id)}
                  style={{
                    background: "transparent",
                    border: "0.5px solid color-mix(in srgb, var(--error) 20%, transparent)",
                    borderRadius: 7,
                    color: "var(--error)",
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
            background: teamSurface,
            border: teamBorderSoft,
            borderRadius: 12,
            padding: "2rem",
            textAlign: "center",
            marginBottom: "1.75rem",
          }}
        >
          <p style={{ fontSize: "0.875rem", color: teamTextMuted, fontFamily: "var(--font-dm-sans)" }}>
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
            color: teamTextMuted,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: "0.625rem",
          }}
        >
          Invite a team member
        </h2>
        <div
          style={{
            background: teamSurface,
            border: teamBorder,
            borderRadius: 12,
            padding: "1.25rem",
          }}
        >
          {activeCount >= maxMembers ? (
            <p style={{ fontSize: "0.875rem", color: teamTextSecondary, fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
              You&apos;ve reached your team member limit ({maxMembers}). Remove a member to invite another.
            </p>
          ) : (
            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {inviteEmails.map((email, idx) => (
                <input
                  key={idx}
                  ref={idx === 0 ? emailRef : undefined}
                  type="email"
                  value={email}
                  onChange={e => {
                    const next = [...inviteEmails]
                    next[idx] = e.target.value
                    setInviteEmails(next)
                    setInviteErrors([])
                    setInviteResults([])
                  }}
                  placeholder={idx === 0 ? "teammate@example.com" : "second@example.com (optional)"}
                  required={idx === 0}
                  style={{
                    background: "var(--surface-2)",
                    border: teamBorderSoft,
                    borderRadius: 8,
                    padding: "0.5625rem 0.875rem",
                    color: teamTextPrimary,
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "0.875rem",
                    outline: "none",
                    width: "100%",
                  }}
                />
              ))}
              <button
                type="submit"
                disabled={inviting}
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-contrast)",
                  fontFamily: "var(--font-dm-sans)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.5625rem 1.25rem",
                  cursor: inviting ? "not-allowed" : "pointer",
                  opacity: inviting ? 0.7 : 1,
                  alignSelf: "flex-end",
                  marginTop: "0.125rem",
                }}
              >
                {inviting ? "Sending..." : "Send invites"}
              </button>
            </form>
          )}
          {inviteErrors.length > 0 && (
            <p style={{ marginTop: "0.625rem", fontSize: "0.8125rem", color: "var(--error)", fontFamily: "var(--font-dm-sans)" }}>
              {inviteErrors[0]}
            </p>
          )}
          {inviteResults.length > 0 && (
            <div style={{ marginTop: "0.625rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {inviteResults.map((r, idx) => (
                <div key={idx}>
                  {r.ok ? (
                    <div>
                      <p style={{ fontSize: "0.8125rem", color: "var(--accent)", fontFamily: "var(--font-dm-sans)", marginBottom: r.emailFailed ? "0.375rem" : 0 }}>
                        {r.emailFailed ? `Invite created for ${r.email} - email failed, share the link:` : `Invite sent to ${r.email}`}
                      </p>
                      {r.emailFailed && r.acceptUrl && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: "0.75rem", color: teamTextSecondary, fontFamily: "var(--font-dm-sans)", background: "var(--surface-2)", border: teamBorderSoft, borderRadius: 6, padding: "0.375rem 0.625rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.acceptUrl}
                          </span>
                          <button onClick={() => copyToClipboard(r.acceptUrl!, `invite-${idx}`)} style={{ background: "var(--accent)", color: "var(--accent-contrast)", fontFamily: "var(--font-dm-sans)", fontWeight: 600, fontSize: "0.75rem", border: "none", borderRadius: 6, padding: "0.375rem 0.875rem", cursor: "pointer", flexShrink: 0 }}>
                            {copiedId === `invite-${idx}` ? "Copied!" : "Copy link"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.8125rem", color: r.alreadyInvited ? "var(--warning)" : "var(--error)", fontFamily: "var(--font-dm-sans)" }}>
                      {r.email}: {r.alreadyInvited ? "Already invited or a member" : (r.error ?? "Failed")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
