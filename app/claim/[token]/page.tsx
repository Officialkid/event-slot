"use client"

import React, { useEffect, useState, use } from "react"
import Link from "next/link"

type ClaimAllocationData = {
  orgName: string
  eventTitle: string
  eventSlug: string
  eventDate?: string | null
  location?: string | null
  imageUrl?: string | null
  organizerName?: string | null
  totalSlots: number
  availableSlots: number
  isFull: boolean
}

export default function MemberSelfClaimPage(props: { params: Promise<{ token: string }> }) {
  const { token } = use(props.params)
  const [data, setData] = useState<ClaimAllocationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [claimed, setClaimed] = useState<{ id: string; slotIndex: number; attendeeName: string; qrToken: string } | null>(null)

  useEffect(() => {
    const fetchClaimDetails = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/claim/${token}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Claim link invalid or closed")
        setData(json.allocation)
      } catch (err: any) {
        setError(err.message || "Claim link invalid or closed")
      } finally {
        setLoading(false)
      }
    }
    fetchClaimDetails()
  }, [token])

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError("")

    try {
      const res = await fetch(`/api/claim/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendeeName: name,
          attendeeEmail: email,
          attendeePhone: phone,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to claim slot")
      setClaimed(json.claimedSlot)
    } catch (err: any) {
      setError(err.message || "Failed to claim slot")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
        <p className="text-[0.9rem] font-medium" style={{ color: "var(--text-secondary)" }}>Loading claim link...</p>
      </div>
    )
  }

  if (error && !claimed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
        <div className="w-full max-w-md rounded-[20px] border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h1 className="text-xl font-bold" style={{ color: "var(--error)" }}>Claim Allocation Unavailable</h1>
          <p className="mt-2 text-[0.875rem]" style={{ color: "var(--text-secondary)" }}>{error}</p>
          <Link href="/" className="mt-5 inline-block rounded-full px-5 py-2 text-[0.85rem] font-semibold" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  if (claimed && data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
        <div className="w-full max-w-lg rounded-[24px] border p-6 sm:p-8 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-black">Ticket Slot Claimed!</h1>
          <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-secondary)" }}>
            You have successfully claimed a reserved ticket under <strong style={{ color: "var(--text-primary)" }}>{data.orgName}</strong>.
          </p>

          <div className="mt-6 rounded-[16px] border p-4 text-left space-y-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>Attendee Name</p>
            <p className="text-[0.95rem] font-bold">{claimed.attendeeName}</p>
            <p className="text-[0.78rem]" style={{ color: "var(--text-muted)" }}>Event</p>
            <p className="text-[0.9rem] font-medium">{data.eventTitle}</p>
          </div>

          <p className="mt-6 text-[0.8rem]" style={{ color: "var(--text-muted)" }}>
            Your organization manager has received confirmation of your ticket assignment.
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      <div className="w-full max-w-md rounded-[24px] border p-6 sm:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        
        <span className="inline-block rounded-full px-3 py-1 text-[0.75rem] font-bold uppercase tracking-wider" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}>
          Member Ticket Claim
        </span>

        <h1 className="mt-3 text-2xl font-black">{data.orgName}</h1>
        <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-secondary)" }}>
          Event: <strong style={{ color: "var(--text-primary)" }}>{data.eventTitle}</strong>
        </p>

        <div className="mt-4 rounded-[12px] border p-3 flex justify-between items-center" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <span className="text-[0.8rem]" style={{ color: "var(--text-secondary)" }}>Available Slots Remaining</span>
          <span className="text-[1rem] font-black" style={{ color: "var(--accent)" }}>{data.availableSlots} of {data.totalSlots}</span>
        </div>

        {data.isFull ? (
          <div className="mt-6 rounded-[14px] border p-4 text-center" style={{ borderColor: "var(--error)", background: "color-mix(in srgb, var(--error) 10%, transparent)" }}>
            <p className="text-[0.875rem] font-bold" style={{ color: "var(--error)" }}>Allocation Fully Claimed</p>
            <p className="mt-1 text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
              All {data.totalSlots} slots for {data.orgName} have already been claimed. Please contact your organization manager.
            </p>
          </div>
        ) : (
          <form onSubmit={handleClaim} className="mt-6 space-y-4">
            {error && (
              <p className="rounded-[8px] p-3 text-[0.8rem] font-semibold" style={{ background: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)" }}>
                {error}
              </p>
            )}

            <div>
              <label className="block text-[0.78rem] font-semibold" style={{ color: "var(--text-secondary)" }}>
                Your Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mary Wanjiku"
                className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem]"
                style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="block text-[0.78rem] font-semibold" style={{ color: "var(--text-secondary)" }}>
                Your Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mary@example.com"
                className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem]"
                style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="block text-[0.78rem] font-semibold" style={{ color: "var(--text-secondary)" }}>
                Your Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712345678"
                className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem]"
                style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-primary)" }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="mt-2 w-full rounded-[10px] py-3 text-[0.875rem] font-bold transition disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              {submitting ? "Claiming Slot..." : "Claim Ticket Slot"}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
