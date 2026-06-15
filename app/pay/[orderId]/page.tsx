"use client"

"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

type OrderDetails = {
  success: true
  status: string
  confirmationCode: string | null
  registrationId: string | null
  eventTitle: string
  eventSlug: string
  ticketTierName: string
  amountKes: number
  attendeeEmail: string | null
  holdExpiresAt: string
}

export default function PaidWaitlistPaymentPage() {
  const params = useParams()
  const orderId = params?.orderId as string
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [mpesaPhone, setMpesaPhone] = useState("")
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!orderId) return
    const load = async () => {
      const res = await fetch(`/api/paid-events/orders/${orderId}`, { cache: "no-store" })
      const data = await res.json()
      if (res.ok) setOrder(data)
      else setError(data.error || "Payment link not found")
      setLoading(false)
    }
    load()
  }, [orderId])

  useEffect(() => {
    if (!orderId || !order) return
    if (order.status !== "PAYMENT_PENDING") return

    let cancelled = false
    const poll = async () => {
      const res = await fetch(`/api/paid-events/orders/${orderId}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || cancelled) return
      setOrder(data)
      if (data.status === "PAID" && data.confirmationCode) {
        window.location.href = `/register/success/${data.confirmationCode}`
        return
      }
      if (data.status === "EXPIRED" || data.status === "FAILED" || data.status === "CANCELLED") return
      window.setTimeout(poll, 4000)
    }
    poll()
    return () => {
      cancelled = true
    }
  }, [orderId, order])

  const handlePay = async () => {
    setPaying(true)
    setError("")
    setMessage("")
    try {
      const res = await fetch(`/api/paid-events/orders/${orderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpesaPhone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Unable to start payment")
      } else {
        setOrder((prev) => prev ? { ...prev, status: "PAYMENT_PENDING" } : prev)
        setMessage(data.customerMessage || "Check your phone to complete payment.")
      }
    } catch {
      setError("Unable to start payment")
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#0A0A0A] text-[#F0EDE6] flex items-center justify-center">Loading payment link...</main>
  }

  if (!order) {
    return <main className="min-h-screen bg-[#0A0A0A] text-[#F0EDE6] flex items-center justify-center">{error || "Payment link not found"}</main>
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-12 text-[#F0EDE6]">
      <div className="mx-auto max-w-[480px] rounded-[16px] border border-[rgba(255,184,77,0.2)] bg-[#141414] p-8">
        <p className="text-[0.72rem] uppercase tracking-[0.08em] text-[#FFB84D]">Waitlist offer</p>
        <h1 className="mt-2 text-[1.7rem]" style={{ fontFamily: "var(--font-instrument-serif)" }}>{order.eventTitle}</h1>
        <p className="mt-3 text-[0.92rem] text-[rgba(240,237,230,0.55)]">
          Your {order.ticketTierName} ticket is now available for KES {order.amountKes.toLocaleString()}.
        </p>
        <p className="mt-2 text-[0.8rem] text-[rgba(240,237,230,0.4)]">
          Offer expires on {new Date(order.holdExpiresAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
        </p>

        {order.status === "PAID" ? (
          <p className="mt-6 text-[#C8F55A]">Payment received. Redirecting to your ticket...</p>
        ) : order.status === "EXPIRED" ? (
          <p className="mt-6 text-[#FF6B6B]">This payment offer has expired.</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-[0.74rem] uppercase tracking-[0.06em] text-[rgba(240,237,230,0.5)]">M-Pesa phone</label>
              <input
                type="tel"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                placeholder="0712345678 or 254712345678"
                className="w-full rounded-[10px] border border-[rgba(240,237,230,0.12)] bg-[#0A0A0A] px-3 py-3 text-[#F0EDE6] outline-none"
              />
            </div>
            <button
              onClick={handlePay}
              disabled={paying}
              className="w-full rounded-full bg-[#C8F55A] px-5 py-3 text-[0.9rem] font-semibold text-[#0A0A0A] disabled:opacity-60"
            >
              {paying ? "Starting payment..." : "Pay with M-Pesa"}
            </button>
            {message && <p className="text-[0.82rem] text-[#C8F55A]">{message}</p>}
            {error && <p className="text-[0.82rem] text-[#FF6B6B]">{error}</p>}
          </div>
        )}
      </div>
    </main>
  )
}
