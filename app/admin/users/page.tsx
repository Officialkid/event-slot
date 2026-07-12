"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"

interface User {
  id: string
  name: string | null
  email: string | null
  plan: string
  suspended: boolean
  createdAt: string
  _count: { events: number }
}

type DeleteEventPreview = {
  id: string
  title: string
  slug: string
  archived: boolean
  status: string
}

type DeleteHandlingMode = "archive" | "delete" | "transfer"

type DeleteBlocker = {
  code?: string
  ownedEventCount: number
  ownedEvents: DeleteEventPreview[]
}

const AVAILABLE_PLANS = ["free", "standard", "pro", "business"] as const

function PlanBadge({ plan }: { plan: string }) {
  const normalizedPlan = plan.trim().toLowerCase()
  const palette =
    normalizedPlan === "business"
      ? { bg: "rgba(138,180,255,0.16)", color: "#8AB4FF" }
      : normalizedPlan === "pro"
        ? { bg: "rgba(200,245,90,0.12)", color: "#C8F55A" }
        : normalizedPlan === "standard"
          ? { bg: "rgba(244,180,0,0.14)", color: "#F4B400" }
          : { bg: "rgba(240,237,230,0.07)", color: "rgba(240,237,230,0.45)" }

  return (
    <span
      style={{
        fontSize: "0.65rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: "0.15rem 0.5rem",
        borderRadius: 100,
        background: palette.bg,
        color: palette.color,
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {normalizedPlan}
    </span>
  )
}

interface EditUserState {
  id: string
  name: string
  email: string
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: EditUserState
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    if (!email.trim()) {
      setError("Email is required.")
      return
    }

    setSaving(true)
    setError("")

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || null, email: email.trim() }),
    })

    setSaving(false)

    if (!res.ok) {
      setError("Failed to save. Email may already be in use.")
      return
    }

    onSaved()
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "2rem", maxWidth: 420, width: "90%" }}>
        <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "#F0EDE6", marginBottom: "1.25rem" }}>
          Edit user details
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.25rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.35rem" }}>
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              style={{ width: "100%", background: "#111", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.6rem 0.9rem", color: "#F0EDE6", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.35rem" }}>
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              style={{ width: "100%", background: "#111", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.6rem 0.9rem", color: "#F0EDE6", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {error && <p style={{ fontSize: "0.78rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)", margin: 0 }}>{error}</p>}
        </div>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "0.5px solid rgba(240,237,230,0.15)", background: "transparent", color: "rgba(240,237,230,0.55)", cursor: "pointer", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)" }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "none", background: saving ? "rgba(200,245,90,0.4)" : "#C8F55A", color: "#0A0A0A", cursor: saving ? "default" : "pointer", fontSize: "0.875rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteBlocker, setDeleteBlocker] = useState<DeleteBlocker | null>(null)
  const [deleteMode, setDeleteMode] = useState<DeleteHandlingMode>("archive")
  const [transferUserId, setTransferUserId] = useState("")
  const [editUser, setEditUser] = useState<EditUserState | null>(null)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (planFilter !== "all") params.set("plan", planFilter)

    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .finally(() => setLoading(false))
  }, [search, planFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function changePlan(id: string, plan: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
    setOpenMenu(null)
    fetchUsers()
  }

  async function toggleSuspend(id: string, suspended: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended }),
    })
    setOpenMenu(null)
    fetchUsers()
  }

  function resetDeleteState() {
    setConfirmDelete(null)
    setDeleteError("")
    setDeleteLoading(false)
    setDeleteBlocker(null)
    setDeleteMode("archive")
    setTransferUserId("")
  }

  async function deleteUser(user: User, mode?: DeleteHandlingMode) {
    setDeleteError("")
    setDeleteLoading(true)

    const payload = mode
      ? {
          eventHandling: mode,
          ...(mode === "transfer" ? { transferUserId } : {}),
        }
      : undefined

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    })

    const responsePayload = await res.json().catch(() => null)
    setDeleteLoading(false)

    if (!res.ok) {
      if (res.status === 409) {
        setDeleteBlocker({
          code: responsePayload?.code,
          ownedEventCount: responsePayload?.ownedEventCount ?? user._count.events,
          ownedEvents: responsePayload?.ownedEvents ?? [],
        })
      }
      setDeleteError(responsePayload?.error ?? "Unable to delete this user right now.")
      return
    }

    resetDeleteState()
    fetchUsers()
  }

  const transferCandidates = users.filter((user) => user.id !== confirmDelete?.id && Boolean(user.email))
  const planTabs = ["all", ...AVAILABLE_PLANS]
  const skeletonRows = [1, 2, 3, 4]

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: "#F0EDE6", marginBottom: "0.4rem" }}>
        Users
      </h1>
      <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.75rem" }}>
        All registered accounts on the platform.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ background: "#111", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.6rem 1rem", color: "#F0EDE6", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", outline: "none", maxWidth: 380 }}
        />
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {planTabs.map((plan) => (
            <button
              key={plan}
              type="button"
              onClick={() => setPlanFilter(plan)}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: 100,
                border: "0.5px solid " + (planFilter === plan ? "rgba(200,245,90,0.4)" : "rgba(240,237,230,0.1)"),
                background: planFilter === plan ? "rgba(200,245,90,0.1)" : "transparent",
                color: planFilter === plan ? "#C8F55A" : "rgba(240,237,230,0.45)",
                fontSize: "0.78rem",
                fontFamily: "var(--font-dm-sans)",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid rgba(240,237,230,0.08)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(240,237,230,0.08)", background: "#111" }}>
              {["Name", "Email", "Plan", "Events", "Joined", "Status", ""].map((heading) => (
                <th key={heading} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              skeletonRows.map((row) => (
                <tr key={`skeleton-${row}`} style={{ borderBottom: "0.5px solid rgba(240,237,230,0.04)" }}>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "#1A1A1A", width: "70%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "#1A1A1A", width: "82%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 20, borderRadius: 100, background: "#1A1A1A", width: 58, animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "#1A1A1A", width: 28, margin: "0 auto", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "#1A1A1A", width: "56%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 20, borderRadius: 100, background: "#1A1A1A", width: 72, animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 24, borderRadius: 8, background: "#1A1A1A", width: 36, animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "2rem 1rem", textAlign: "center", color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem" }}>
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user, index) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: "0.5px solid rgba(240,237,230,0.04)",
                    background: index % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    opacity: user.suspended ? 0.55 : 1,
                  }}
                >
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>{user.name ?? "-"}</td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)" }}>{user.email ?? "-"}</td>
                  <td style={{ padding: "0.75rem 1rem" }}><PlanBadge plan={user.plan} /></td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", textAlign: "center" }}>{user._count.events}</td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                    {new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    {user.suspended ? (
                      <span style={{ fontSize: "0.65rem", background: "rgba(255,107,107,0.12)", color: "#FF6B6B", borderRadius: 100, padding: "0.15rem 0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-dm-sans)" }}>
                        Suspended
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.65rem", background: "rgba(200,245,90,0.08)", color: "rgba(200,245,90,0.55)", borderRadius: 100, padding: "0.15rem 0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-dm-sans)" }}>
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                      style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 6, color: "rgba(240,237,230,0.55)", cursor: "pointer", padding: "0.25rem 0.6rem", fontSize: "1rem", lineHeight: 1 }}
                    >
                      ...
                    </button>
                    {openMenu === user.id && (
                      <div style={{ position: "absolute", right: 0, top: "110%", background: "#141414", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 8, padding: "0.35rem", minWidth: 180, zIndex: 50 }}>
                        <Link
                          href={`/admin/events?user=${user.id}`}
                          style={{ display: "block", padding: "0.5rem 0.75rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.7)", textDecoration: "none", borderRadius: 6, fontFamily: "var(--font-dm-sans)" }}
                          onClick={() => setOpenMenu(null)}
                        >
                          View events
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setEditUser({ id: user.id, name: user.name ?? "", email: user.email ?? "" })
                            setOpenMenu(null)
                          }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.7)", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, fontFamily: "var(--font-dm-sans)" }}
                        >
                          Edit details
                        </button>
                        <div style={{ borderTop: "0.5px solid rgba(240,237,230,0.07)", margin: "0.25rem 0" }} />
                        <div style={{ padding: "0.5rem 0.75rem" }}>
                          <div style={{ fontSize: "0.68rem", color: "rgba(240,237,230,0.3)", marginBottom: "0.4rem", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
                            Plan
                          </div>
                          {AVAILABLE_PLANS.map((plan) => (
                            <button
                              key={plan}
                              type="button"
                              onClick={() => changePlan(user.id, plan)}
                              style={{ display: "block", width: "100%", textAlign: "left", padding: "0.3rem 0", fontSize: "0.82rem", color: user.plan === plan ? "#C8F55A" : "rgba(240,237,230,0.55)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-dm-sans)", textTransform: "capitalize" }}
                            >
                              {user.plan === plan ? "[Current] " : ""}
                              {plan}
                            </button>
                          ))}
                        </div>
                        <div style={{ borderTop: "0.5px solid rgba(240,237,230,0.07)", margin: "0.25rem 0" }} />
                        <button
                          type="button"
                          onClick={() => toggleSuspend(user.id, !user.suspended)}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", fontSize: "0.82rem", color: user.suspended ? "#C8F55A" : "#FF6B6B", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, fontFamily: "var(--font-dm-sans)" }}
                        >
                          {user.suspended ? "Unsuspend account" : "Suspend account"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError("")
                            setDeleteBlocker(null)
                            setDeleteMode("archive")
                            setTransferUserId("")
                            setConfirmDelete(user)
                            setOpenMenu(null)
                          }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", fontSize: "0.82rem", color: "#FF6B6B", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6, fontFamily: "var(--font-dm-sans)" }}
                        >
                          Delete account
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null)
            fetchUsers()
          }}
        />
      )}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "2rem", maxWidth: 560, width: "92%" }}>
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "#F0EDE6", marginBottom: "0.75rem" }}>
              Delete account?
            </h3>
            <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem", lineHeight: 1.55 }}>
              This permanently deletes <span style={{ color: "#F0EDE6" }}>{confirmDelete.email ?? confirmDelete.name ?? "this account"}</span>. If the account still owns events, choose what should happen to them first.
            </p>

            {deleteBlocker ? (
              <div style={{ borderRadius: 12, border: "0.5px solid rgba(255,142,125,0.25)", background: "rgba(255,142,125,0.08)", padding: "1rem", marginBottom: "1rem" }}>
                <p style={{ margin: 0, color: "#FFD1C8", fontSize: "0.84rem", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                  This user still owns {deleteBlocker.ownedEventCount} event{deleteBlocker.ownedEventCount === 1 ? "" : "s"}. Pick an action below before deleting the account.
                </p>
                {deleteBlocker.ownedEvents.length > 0 ? (
                  <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.45rem" }}>
                    {deleteBlocker.ownedEvents.map((event) => (
                      <div key={event.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.72)", fontFamily: "var(--font-dm-sans)" }}>
                        <span>{event.title}</span>
                        <span style={{ color: "rgba(240,237,230,0.4)" }}>{event.archived ? "Archived" : event.status}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {deleteBlocker ? (
              <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
                {([
                  { value: "archive", label: "Archive events and delete user", detail: "Keeps event records, removes the organiser from ownership, and archives them first." },
                  { value: "transfer", label: "Transfer events and delete user", detail: "Moves event ownership to another account before deleting this one." },
                  { value: "delete", label: "Delete events and delete user", detail: "Permanently removes the owned events together with this account." },
                ] as const).map((option) => (
                  <label key={option.value} style={{ borderRadius: 12, border: deleteMode === option.value ? "0.5px solid rgba(200,245,90,0.35)" : "0.5px solid rgba(240,237,230,0.08)", background: deleteMode === option.value ? "rgba(200,245,90,0.06)" : "#111", padding: "0.9rem 1rem", cursor: "pointer" }}>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <input
                        type="radio"
                        checked={deleteMode === option.value}
                        onChange={() => setDeleteMode(option.value)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ color: "#F0EDE6", fontSize: "0.86rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>
                          {option.label}
                        </div>
                        <div style={{ color: "rgba(240,237,230,0.5)", fontSize: "0.78rem", lineHeight: 1.55, fontFamily: "var(--font-dm-sans)", marginTop: "0.2rem" }}>
                          {option.detail}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : null}

            {deleteBlocker && deleteMode === "transfer" ? (
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.35rem" }}>
                  Transfer events to
                </label>
                <select
                  value={transferUserId}
                  onChange={(e) => setTransferUserId(e.target.value)}
                  style={{ width: "100%", background: "#111", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.7rem 0.9rem", color: "#F0EDE6", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", outline: "none", boxSizing: "border-box" }}
                >
                  <option value="">Choose another account</option>
                  {transferCandidates.map((user) => (
                    <option key={user.id} value={user.id}>
                      {(user.name ?? "Unnamed user") + " - " + (user.email ?? "No email")}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {deleteError && (
              <p style={{ fontSize: "0.82rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)", margin: "0 0 1rem" }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={resetDeleteState} style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "0.5px solid rgba(240,237,230,0.15)", background: "transparent", color: "rgba(240,237,230,0.55)", cursor: "pointer", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)" }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading || Boolean(deleteBlocker && deleteMode === "transfer" && !transferUserId)}
                onClick={() => void deleteUser(confirmDelete, deleteBlocker ? deleteMode : undefined)}
                style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "none", background: "#FF6B6B", color: "#fff", cursor: deleteLoading ? "default" : "pointer", fontSize: "0.875rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", opacity: deleteLoading ? 0.75 : 1 }}
              >
                {deleteLoading ? "Deleting..." : deleteBlocker ? "Continue delete" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
