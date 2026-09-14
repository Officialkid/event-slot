"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"

export type GroupBookingSummary = {
  id: string
  orgName: string
  orgType: string
  contactName: string
  contactEmail: string
  contactPhone: string
  totalSlots: number
  assignedCount: number
  unassignedCount: number
  checkedInCount: number
  status: string
  bookingToken: string
  claimToken: string
  managerUrl: string
  claimUrl: string
  createdAt: string
}

type DelegateSlot = {
  id: string
  slotIndex: number
  attendeeName: string | null
  attendeeEmail: string | null
  attendeePhone: string | null
  status: "UNASSIGNED" | "ASSIGNED" | "REVOKED" | "CHECKED_IN"
  qrToken: string
  assignedAt: string | null
  checkedInAt: string | null
}

interface EventGroupBookingsTabProps {
  slug: string
  token?: string
  groupRegistrationEnabled?: boolean
  publicUrl?: string
}

export function EventGroupBookingsTab({
  slug,
  token,
  groupRegistrationEnabled = false,
  publicUrl = "",
}: EventGroupBookingsTabProps) {
  const [bookings, setBookings] = useState<GroupBookingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Copy feedback tracking
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Delegate inspection state
  const [expandedBookingToken, setExpandedBookingToken] = useState<string | null>(null)
  const [delegateSlots, setDelegateSlots] = useState<Record<string, DelegateSlot[]>>({})
  const [loadingDelegates, setLoadingDelegates] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const res = await fetch(`/api/events/${slug}/group-bookings`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load group bookings")
      setBookings(data.groupBookings || [])
    } catch (err: any) {
      setError(err.message || "Failed to load group bookings")
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2500)
    } catch {
      // Fallback
      setCopiedKey(null)
    }
  }

  const toggleExpandDelegates = async (bookingToken: string) => {
    if (expandedBookingToken === bookingToken) {
      setExpandedBookingToken(null)
      return
    }

    setExpandedBookingToken(bookingToken)

    if (!delegateSlots[bookingToken]) {
      try {
        setLoadingDelegates(bookingToken)
        const res = await fetch(`/api/group-booking/${bookingToken}`)
        const data = await res.json()
        if (res.ok && data.booking?.slots) {
          setDelegateSlots((prev) => ({
            ...prev,
            [bookingToken]: data.booking.slots,
          }))
        }
      } catch (err) {
        console.error("Failed to load delegate slots", err)
      } finally {
        setLoadingDelegates(null)
      }
    }
  }

  // Filtered bookings
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase()
    return (
      b.orgName.toLowerCase().includes(q) ||
      b.contactName.toLowerCase().includes(q) ||
      b.contactEmail.toLowerCase().includes(q) ||
      b.orgType.toLowerCase().includes(q)
    )
  })

  // Aggregate KPIs
  const totalOrgs = bookings.length
  const totalSlotsReserved = bookings.reduce((acc, b) => acc + b.totalSlots, 0)
  const totalAssigned = bookings.reduce((acc, b) => acc + b.assignedCount, 0)
  const totalCheckedIn = bookings.reduce((acc, b) => acc + b.checkedInCount, 0)
  const assignmentPercentage = totalSlotsReserved > 0 ? Math.round((totalAssigned / totalSlotsReserved) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div
        className="rounded-[16px] border p-5 sm:p-6"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                🏢 Group &amp; Organization Delegations
              </h2>
              {groupRegistrationEnabled ? (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                    color: "var(--accent)",
                  }}
                >
                  Registration Active
                </span>
              ) : (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold"
                  style={{
                    background: "color-mix(in srgb, var(--text-muted) 15%, transparent)",
                    color: "var(--text-muted)",
                  }}
                >
                  Registration Inactive
                </span>
              )}
            </div>
            <p className="mt-1 text-[0.82rem]" style={{ color: "var(--text-secondary)" }}>
              Manage corporate delegations, church groups, and schools reserving multi-seat allocations for this event.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchBookings}
              disabled={loading}
              className="rounded-[8px] border px-3 py-1.5 text-[0.78rem] font-semibold transition hover:opacity-80"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
              }}
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
            <Link
              href={`/edit/${slug}`}
              className="rounded-[8px] px-3 py-1.5 text-[0.78rem] font-bold transition hover:opacity-90"
              style={{
                background: "var(--accent)",
                color: "var(--accent-contrast)",
              }}
            >
              ⚙️ Event Settings
            </Link>
          </div>
        </div>

        {/* Feature status notice */}
        {!groupRegistrationEnabled && (
          <div
            className="mt-4 rounded-[10px] border p-3.5 text-[0.8rem]"
            style={{
              borderColor: "color-mix(in srgb, var(--warning) 30%, transparent)",
              background: "color-mix(in srgb, var(--warning) 8%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            ⚠️ <strong>Group registration is currently disabled on this event.</strong> Go to{" "}
            <Link href={`/edit/${slug}`} className="font-bold underline" style={{ color: "var(--warning)" }}>
              Edit Event
            </Link>{" "}
            and check &ldquo;Enable Group &amp; Organization Booking&rdquo; so churches, companies, and delegations can reserve allocations on the attendee form.
          </div>
        )}
      </div>

      {/* KPI Metrics Summary Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className="rounded-[14px] border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <p className="text-[0.72rem] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Organizations Booked
          </p>
          <p className="mt-1 text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            {totalOrgs}
          </p>
          <p className="mt-0.5 text-[0.72rem]" style={{ color: "var(--text-secondary)" }}>
            Churches, Companies, NGOs
          </p>
        </div>

        <div
          className="rounded-[14px] border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <p className="text-[0.72rem] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Total Slots Held
          </p>
          <p className="mt-1 text-2xl font-black" style={{ color: "var(--accent)" }}>
            {totalSlotsReserved}
          </p>
          <p className="mt-0.5 text-[0.72rem]" style={{ color: "var(--text-secondary)" }}>
            Reserved allocation pool
          </p>
        </div>

        <div
          className="rounded-[14px] border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <p className="text-[0.72rem] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Delegates Assigned
          </p>
          <p className="mt-1 text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            {totalAssigned}{" "}
            <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
              ({assignmentPercentage}%)
            </span>
          </p>
          <p className="mt-0.5 text-[0.72rem]" style={{ color: "var(--text-secondary)" }}>
            {totalSlotsReserved - totalAssigned} unassigned slots
          </p>
        </div>

        <div
          className="rounded-[14px] border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <p className="text-[0.72rem] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Delegates Checked In
          </p>
          <p className="mt-1 text-2xl font-black" style={{ color: "#38A169" }}>
            {totalCheckedIn}
          </p>
          <p className="mt-0.5 text-[0.72rem]" style={{ color: "var(--text-secondary)" }}>
            Verified at event gates
          </p>
        </div>
      </div>

      {/* Search and filter bar */}
      {bookings.length > 0 && (
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by organization name, contact person, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md rounded-[10px] border px-3.5 py-2 text-[0.85rem] font-medium placeholder:text-[var(--text-muted)] focus:outline-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      )}

      {/* Bookings listing */}
      {loading ? (
        <div
          className="rounded-[16px] border p-12 text-center"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            Loading organization delegations...
          </p>
        </div>
      ) : error ? (
        <div
          className="rounded-[16px] border p-6 text-center"
          style={{ borderColor: "var(--danger)", background: "var(--surface)" }}
        >
          <p className="text-sm font-semibold text-red-500">{error}</p>
          <button
            onClick={fetchBookings}
            className="mt-3 rounded-[8px] px-3 py-1.5 text-xs font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            Retry
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div
          className="rounded-[16px] border p-10 text-center"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{ background: "var(--surface-2)" }}
          >
            🏛️
          </div>
          <h3 className="mt-4 text-base font-bold" style={{ color: "var(--text-primary)" }}>
            No Organization Bookings Yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-[0.82rem]" style={{ color: "var(--text-secondary)" }}>
            When groups or organizations register, their delegation summary, slot allocations, and manager links will appear right here.
          </p>
          {groupRegistrationEnabled ? (
            <div className="mt-5 flex justify-center gap-3">
              <a
                href={publicUrl || `/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-[10px] px-4 py-2 text-xs font-bold transition hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                ↗ Test Group Registration on Public Page
              </a>
            </div>
          ) : (
            <div className="mt-5">
              <Link
                href={`/edit/${slug}`}
                className="rounded-[10px] px-4 py-2 text-xs font-bold transition hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                Enable Group Booking in Edit Event
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const isExpanded = expandedBookingToken === b.bookingToken
            const slots = delegateSlots[b.bookingToken] || []
            const isLoadingSlots = loadingDelegates === b.bookingToken

            return (
              <div
                key={b.id}
                className="overflow-hidden rounded-[16px] border transition"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                }}
              >
                {/* Delegation Summary Card Header */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left: Organization Info */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
                          {b.orgName}
                        </h3>
                        <span
                          className="rounded-full px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider"
                          style={{
                            background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                            color: "var(--accent)",
                          }}
                        >
                          {b.orgType.replace("_", " ")}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[0.68rem] font-bold"
                          style={{
                            background: "color-mix(in srgb, var(--surface-2) 80%, transparent)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {new Date(b.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <p className="mt-1 text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
                        Primary Contact: <strong style={{ color: "var(--text-primary)" }}>{b.contactName}</strong> •{" "}
                        <a href={`mailto:${b.contactEmail}`} className="underline" style={{ color: "var(--text-primary)" }}>
                          {b.contactEmail}
                        </a>{" "}
                        • {b.contactPhone}
                      </p>
                    </div>

                    {/* Middle: Slot allocation progress */}
                    <div className="min-w-[200px] max-w-xs space-y-1.5">
                      <div className="flex justify-between text-[0.75rem] font-semibold">
                        <span style={{ color: "var(--text-secondary)" }}>
                          {b.assignedCount} of {b.totalSlots} Assigned
                        </span>
                        <span style={{ color: "var(--accent)" }}>
                          {b.checkedInCount} Checked In
                        </span>
                      </div>
                      <div
                        className="h-2 w-full overflow-hidden rounded-full"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (b.assignedCount / Math.max(1, b.totalSlots)) * 100)}%`,
                            background: "var(--accent)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(b.managerUrl, `mgr-${b.id}`)}
                        className="rounded-[8px] border px-3 py-1.5 text-[0.75rem] font-bold transition hover:opacity-80"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--surface-2)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {copiedKey === `mgr-${b.id}` ? "✓ Copied Manager Link!" : "📋 Copy Manager Link"}
                      </button>

                      <button
                        onClick={() => copyToClipboard(b.claimUrl, `claim-${b.id}`)}
                        className="rounded-[8px] border px-3 py-1.5 text-[0.75rem] font-bold transition hover:opacity-80"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--surface-2)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {copiedKey === `claim-${b.id}` ? "✓ Copied Claim Link!" : "🔗 Copy Claim Link"}
                      </button>

                      <a
                        href={b.managerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-[8px] border px-3 py-1.5 text-[0.75rem] font-bold transition hover:opacity-80"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--surface-2)",
                          color: "var(--text-primary)",
                        }}
                      >
                        ↗ Open Portal
                      </a>

                      <button
                        onClick={() => toggleExpandDelegates(b.bookingToken)}
                        className="rounded-[8px] px-3 py-1.5 text-[0.75rem] font-bold transition hover:opacity-90"
                        style={{
                          background: isExpanded ? "var(--surface-2)" : "var(--accent)",
                          color: isExpanded ? "var(--text-primary)" : "var(--accent-contrast)",
                        }}
                      >
                        {isExpanded ? "▲ Hide Delegates" : `👥 View Delegates (${b.assignedCount})`}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Delegates Table View */}
                {isExpanded && (
                  <div
                    className="border-t p-5 sm:p-6"
                    style={{
                      borderColor: "var(--border)",
                      background: "color-mix(in srgb, var(--surface-2) 60%, transparent)",
                    }}
                  >
                    <div className="flex items-center justify-between pb-3">
                      <h4 className="text-[0.82rem] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Delegates in this Allocation ({b.assignedCount} / {b.totalSlots})
                      </h4>
                      <span className="text-[0.75rem]" style={{ color: "var(--text-secondary)" }}>
                        Self-claim URL:{" "}
                        <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[0.7rem] font-mono">
                          {b.claimUrl}
                        </code>
                      </span>
                    </div>

                    {isLoadingSlots ? (
                      <p className="py-4 text-center text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                        Loading delegate seats...
                      </p>
                    ) : slots.length === 0 ? (
                      <p className="py-4 text-center text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                        No delegates assigned yet. The organization manager can assign attendees or members can self-claim via the claim link.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[0.8rem]">
                          <thead>
                            <tr
                              className="border-b text-[0.7rem] font-bold uppercase tracking-wider"
                              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                            >
                              <th className="pb-2">Slot #</th>
                              <th className="pb-2">Delegate Name</th>
                              <th className="pb-2">Email</th>
                              <th className="pb-2">Phone</th>
                              <th className="pb-2">Status</th>
                              <th className="pb-2">Checked In At</th>
                              <th className="pb-2 text-right">QR Token</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                            {slots.map((s) => (
                              <tr key={s.id} className="hover:bg-[color-mix(in_srgb,var(--surface)_50%,transparent)]">
                                <td className="py-2.5 font-bold" style={{ color: "var(--text-muted)" }}>
                                  #{s.slotIndex}
                                </td>
                                <td className="py-2.5 font-bold" style={{ color: "var(--text-primary)" }}>
                                  {s.attendeeName || <span className="italic opacity-50">Unassigned</span>}
                                </td>
                                <td className="py-2.5" style={{ color: "var(--text-secondary)" }}>
                                  {s.attendeeEmail || "—"}
                                </td>
                                <td className="py-2.5" style={{ color: "var(--text-secondary)" }}>
                                  {s.attendeePhone || "—"}
                                </td>
                                <td className="py-2.5">
                                  {s.status === "CHECKED_IN" ? (
                                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-green-500">
                                      Checked In
                                    </span>
                                  ) : s.status === "ASSIGNED" ? (
                                    <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-blue-400">
                                      Assigned
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-neutral-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-neutral-400">
                                      Open Slot
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5" style={{ color: "var(--text-secondary)" }}>
                                  {s.checkedInAt
                                    ? new Date(s.checkedInAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "—"}
                                </td>
                                <td className="py-2.5 text-right font-mono text-[0.7rem]" style={{ color: "var(--text-muted)" }}>
                                  {s.qrToken ? `${s.qrToken.slice(0, 8)}...` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
