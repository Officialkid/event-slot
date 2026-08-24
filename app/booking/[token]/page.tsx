"use client"

import React, { useEffect, useState, use } from "react"
import Link from "next/link"

type Slot = {
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

type BookingData = {
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
  claimToken: string
  claimUrl: string
  event: {
    id: string
    slug: string
    title: string
    eventDate?: string | null
    location?: string | null
    organizerName?: string | null
  }
  slots: Slot[]
}

type ParsedDelegate = {
  name: string
  email: string
  phone: string
}

export default function OrganizationManagerPortal(props: { params: Promise<{ token: string }> }) {
  const { token } = use(props.params)
  const [data, setData] = useState<BookingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Edit / Assign Modal State
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  // CSV Import State
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvPreview, setCsvPreview] = useState<ParsedDelegate[]>([])
  const [importingCsv, setImportingCsv] = useState(false)
  const [csvError, setCsvError] = useState("")

  const fetchBooking = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/group-booking/${token}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load allocation")
      setData(json.booking)
    } catch (err: any) {
      setError(err.message || "Failed to load allocation")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBooking()
  }, [token])

  const handleOpenAssign = (slot: Slot) => {
    setEditingSlot(slot)
    setName(slot.attendeeName || "")
    setEmail(slot.attendeeEmail || "")
    setPhone(slot.attendeePhone || "")
  }

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSlot || !name.trim()) return
    setSubmitting(true)

    try {
      const res = await fetch(`/api/group-booking/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: editingSlot.id,
          attendeeName: name,
          attendeeEmail: email,
          attendeePhone: phone,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to save slot")
      setEditingSlot(null)
      fetchBooking()
    } catch (err: any) {
      alert(err.message || "Failed to save slot")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnassign = async (slotId: string) => {
    if (!confirm("Are you sure you want to remove this attendee? Their ticket QR code will be revoked immediately.")) {
      return
    }
    try {
      const res = await fetch(`/api/group-booking/${token}?slotId=${slotId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to remove attendee")
      fetchBooking()
    } catch (err: any) {
      alert(err.message || "Failed to remove attendee")
    }
  }

  // Parse CSV File Client-Side
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError("")

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
        if (lines.length === 0) {
          setCsvError("CSV file is empty.")
          return
        }

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
        const nameIdx = headers.findIndex((h) => h.includes("name"))
        const emailIdx = headers.findIndex((h) => h.includes("email"))
        const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("tel") || h.includes("contact"))

        const parsed: ParsedDelegate[] = []
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""))
          const dName = nameIdx >= 0 ? cols[nameIdx] : cols[0]
          const dEmail = emailIdx >= 0 ? cols[emailIdx] : cols[1] || ""
          const dPhone = phoneIdx >= 0 ? cols[phoneIdx] : cols[2] || ""

          if (dName && dName.trim()) {
            parsed.push({ name: dName.trim(), email: dEmail.trim(), phone: dPhone.trim() })
          }
        }

        if (parsed.length === 0) {
          setCsvError("No valid attendee rows found in CSV.")
          return
        }

        setCsvPreview(parsed)
      } catch (err) {
        setCsvError("Unable to parse CSV file. Ensure it is a valid comma-separated text file.")
      }
    }
    reader.readAsText(file)
  }

  const handleCommitCsvImport = async () => {
    if (csvPreview.length === 0) return
    setImportingCsv(true)
    setCsvError("")

    try {
      const res = await fetch(`/api/group-booking/${token}/bulk-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delegates: csvPreview }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to import CSV")

      setShowCsvModal(false)
      setCsvPreview([])
      fetchBooking()
    } catch (err: any) {
      setCsvError(err.message || "Failed to import CSV")
    } finally {
      setImportingCsv(false)
    }
  }

  // Export Current Allocation CSV
  const handleExportCsv = () => {
    if (!data) return
    const headers = ["Slot Number", "Attendee Name", "Email", "Phone", "Status"]
    const rows = data.slots.map((s) => [
      s.slotIndex,
      `"${s.attendeeName || "Unassigned"}"`,
      `"${s.attendeeEmail || ""}"`,
      `"${s.attendeePhone || ""}"`,
      s.status,
    ])
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${data.orgName.replace(/[^a-z0-9]/gi, "_")}_delegation.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyClaimLink = () => {
    if (!data) return
    navigator.clipboard.writeText(data.claimUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
        <p className="text-[0.9rem] font-medium" style={{ color: "var(--text-secondary)" }}>Loading organization portal...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
        <div className="w-full max-w-md rounded-[16px] border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h1 className="text-xl font-bold" style={{ color: "var(--error)" }}>Allocation Not Found</h1>
          <p className="mt-2 text-[0.875rem]" style={{ color: "var(--text-secondary)" }}>{error || "Invalid or expired allocation link."}</p>
          <Link href="/" className="mt-5 inline-block rounded-full px-5 py-2 text-[0.85rem] font-semibold" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-10" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* Header Card */}
        <div className="rounded-[20px] border p-6 md:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-block rounded-full px-3 py-1 text-[0.75rem] font-bold tracking-wide uppercase" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}>
                Organization Manager Portal
              </span>
              <h1 className="mt-2 text-2xl font-black md:text-3xl" style={{ color: "var(--text-primary)" }}>
                {data.orgName}
              </h1>
              <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-secondary)" }}>
                Event: <strong style={{ color: "var(--text-primary)" }}>{data.event.title}</strong>
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>Primary Contact</p>
              <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text-primary)" }}>{data.contactName}</p>
              <p className="text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>{data.contactEmail}</p>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>Total Reserved</p>
            <p className="mt-1 text-2xl font-black" style={{ color: "var(--text-primary)" }}>{data.totalSlots}</p>
          </div>
          <div className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>Assigned</p>
            <p className="mt-1 text-2xl font-black" style={{ color: "var(--accent)" }}>{data.assignedCount}</p>
          </div>
          <div className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>Unassigned</p>
            <p className="mt-1 text-2xl font-black" style={{ color: "var(--warning)" }}>{data.unassignedCount}</p>
          </div>
          <div className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>Checked In</p>
            <p className="mt-1 text-2xl font-black" style={{ color: "var(--text-primary)" }}>{data.checkedInCount}</p>
          </div>
        </div>

        {/* Action Controls & Self-Claim Link */}
        <div className="rounded-[16px] border p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[0.95rem] font-bold" style={{ color: "var(--text-primary)" }}>Delegation Tools</h2>
              <p className="mt-0.5 text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
                Import delegates in bulk via CSV or share a self-claim link with members.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowCsvModal(true)}
                className="rounded-[8px] px-3.5 py-2 text-[0.8rem] font-semibold transition flex items-center gap-1.5"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import CSV
              </button>
              <button
                onClick={handleExportCsv}
                className="rounded-[8px] border px-3.5 py-2 text-[0.8rem] font-semibold transition flex items-center gap-1.5"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export List
              </button>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              type="text"
              readOnly
              value={data.claimUrl}
              className="w-full rounded-[8px] border px-3 py-2 text-[0.8rem] font-mono"
              style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-secondary)" }}
            />
            <button
              onClick={copyClaimLink}
              className="shrink-0 rounded-[8px] border px-4 py-2 text-[0.8rem] font-semibold transition"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
            >
              {copied ? "Copied!" : "Copy Claim Link"}
            </button>
          </div>
        </div>

        {/* Ticket Slots Table */}
        <div className="rounded-[20px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Delegation Ticket Slots</h2>
          <p className="text-[0.8rem]" style={{ color: "var(--text-muted)" }}>
            Assign names to unassigned slots or update existing delegates. Replacing an attendee automatically revokes their old QR code.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-[0.85rem]">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  <th className="pb-3 font-semibold">Slot #</th>
                  <th className="pb-3 font-semibold">Attendee Name</th>
                  <th className="pb-3 font-semibold">Contact Info</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {data.slots.map((slot) => {
                  const isAssigned = slot.status === "ASSIGNED" || slot.status === "CHECKED_IN"
                  return (
                    <tr key={slot.id} className="transition hover:bg-[var(--surface-muted)]">
                      <td className="py-4 font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                        #{slot.slotIndex}
                      </td>
                      <td className="py-4 font-medium" style={{ color: isAssigned ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {slot.attendeeName || "— Unassigned —"}
                      </td>
                      <td className="py-4 text-[0.8rem]" style={{ color: "var(--text-secondary)" }}>
                        {slot.attendeeEmail || slot.attendeePhone || "—"}
                      </td>
                      <td className="py-4">
                        {slot.status === "CHECKED_IN" && (
                          <span className="inline-block rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold" style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }}>
                            Checked In
                          </span>
                        )}
                        {slot.status === "ASSIGNED" && (
                          <span className="inline-block rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}>
                            Assigned
                          </span>
                        )}
                        {slot.status === "UNASSIGNED" && (
                          <span className="inline-block rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold" style={{ background: "color-mix(in srgb, var(--warning) 15%, transparent)", color: "var(--warning)" }}>
                            Empty Slot
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenAssign(slot)}
                            className="rounded-[6px] border px-3 py-1 text-[0.75rem] font-semibold transition"
                            style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
                          >
                            {isAssigned ? "Replace / Edit" : "Assign Name"}
                          </button>
                          {isAssigned && (
                            <button
                              onClick={() => handleUnassign(slot.id)}
                              className="rounded-[6px] px-2.5 py-1 text-[0.75rem] font-semibold transition"
                              style={{ background: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)" }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[20px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}>
            <h3 className="text-lg font-bold">Bulk Import Delegates via CSV</h3>
            <p className="mt-1 text-[0.8rem]" style={{ color: "var(--text-secondary)" }}>
              Upload a CSV file containing columns for <strong style={{ color: "var(--text-primary)" }}>Name, Email, Phone</strong>. Rows will be assigned to available empty slots.
            </p>

            {csvError && (
              <p className="mt-3 rounded-[8px] p-3 text-[0.8rem] font-semibold" style={{ background: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)" }}>
                {csvError}
              </p>
            )}

            <div className="mt-4">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="w-full rounded-[8px] border px-3 py-2 text-[0.8rem]"
                style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-primary)" }}
              />
            </div>

            {csvPreview.length > 0 && (
              <div className="mt-4">
                <p className="text-[0.78rem] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Parsed {csvPreview.length} Delegate(s) (will fill up to {data.unassignedCount} empty slots):
                </p>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-[8px] border p-2 text-[0.78rem] space-y-1" style={{ borderColor: "var(--border)", background: "var(--bg-page)" }}>
                  {csvPreview.map((d, i) => (
                    <div key={i} className="flex justify-between font-mono" style={{ color: i < data.unassignedCount ? "var(--text-primary)" : "var(--text-muted)" }}>
                      <span>#{i + 1} {d.name}</span>
                      <span>{d.email || d.phone || "No contact"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCsvModal(false)
                  setCsvPreview([])
                }}
                className="rounded-[8px] border px-4 py-2 text-[0.8rem] font-semibold"
                style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitCsvImport}
                disabled={importingCsv || csvPreview.length === 0}
                className="rounded-[8px] px-5 py-2 text-[0.8rem] font-semibold disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                {importingCsv ? "Importing..." : `Import ${Math.min(csvPreview.length, data.unassignedCount)} Delegates`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Assign Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[20px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}>
            <h3 className="text-lg font-bold">
              {editingSlot.attendeeName ? `Replace Slot #${editingSlot.slotIndex}` : `Assign Slot #${editingSlot.slotIndex}`}
            </h3>
            <p className="mt-1 text-[0.8rem]" style={{ color: "var(--text-secondary)" }}>
              {editingSlot.attendeeName
                ? "Updating this slot will immediately revoke the previous attendee's QR ticket."
                : "Enter attendee details to assign this ticket slot."}
            </p>

            <form onSubmit={handleSaveSlot} className="mt-4 space-y-4">
              <div>
                <label className="block text-[0.75rem] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Attendee Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mary Wanjiku"
                  className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.85rem]"
                  style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="block text-[0.75rem] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Attendee Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mary@example.com"
                  className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.85rem]"
                  style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="block text-[0.75rem] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Attendee Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678"
                  className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.85rem]"
                  style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="rounded-[8px] border px-4 py-2 text-[0.8rem] font-semibold"
                  style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="rounded-[8px] px-5 py-2 text-[0.8rem] font-semibold disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                >
                  {submitting ? "Saving..." : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
