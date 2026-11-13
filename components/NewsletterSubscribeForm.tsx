"use client"

import { useState } from "react"

export function NewsletterSubscribeForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes("@")) {
      setStatus("error")
      setMessage("Please enter a valid email address.")
      return
    }

    setLoading(true)
    setStatus("idle")
    setMessage("")

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setStatus("success")
        setMessage(data.message || "You're subscribed! Welcome to EventSlot updates.")
        setEmail("")
      } else {
        setStatus("error")
        setMessage(data.error || "Failed to subscribe. Please try again.")
      }
    } catch {
      setStatus("error")
      setMessage("Network error. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-sm font-semibold text-white mb-1.5">Stay in the loop</p>
      <p className="text-xs text-[var(--text-muted)] mb-3">
        Get weekly event highlights, featured spots, and product improvements.
      </p>

      {status === "success" ? (
        <div className="flex items-center gap-3 text-sm font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-4 py-3 rounded-xl animate-in fade-in shadow-sm">
          <span className="text-base text-emerald-400 font-bold">✓</span>
          <span>{message}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            disabled={loading}
            className="flex-1 bg-[#141414] border border-[#262626] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#737373] focus:outline-none focus:border-[#16A34A] transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-[#16A34A] text-white font-semibold rounded-xl text-sm hover:bg-[#15803D] disabled:opacity-50 transition-all shrink-0 cursor-pointer shadow-sm"
          >
            {loading ? "Subscribing..." : "Subscribe"}
          </button>
        </form>
      )}

      {status === "error" && (
        <div className="mt-2.5 flex items-center gap-2.5 text-sm font-medium text-amber-300 bg-amber-950/40 border border-amber-500/30 px-4 py-3 rounded-xl animate-in fade-in">
          <span className="text-base">ℹ️</span>
          <span>{message}</span>
        </div>
      )}
    </div>
  )
}
