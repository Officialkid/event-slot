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
        <div className="flex items-center gap-2 text-xs text-[#C8F55A] bg-[#C8F55A]/10 border border-[#C8F55A]/20 px-3.5 py-2.5 rounded-xl animate-in fade-in">
          <span>✓</span>
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
            className="flex-1 bg-[#141414] border border-[#262626] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-[#737373] focus:outline-none focus:border-[#C8F55A] transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-[#C8F55A] text-[#0A0A0A] font-semibold rounded-xl text-xs sm:text-sm hover:bg-[#b5e648] disabled:opacity-50 transition-all shrink-0 cursor-pointer shadow-sm shadow-[#C8F55A]/20"
          >
            {loading ? "Subscribing..." : "Subscribe"}
          </button>
        </form>
      )}

      {status === "error" && (
        <p className="text-xs text-red-400 mt-2">{message}</p>
      )}
    </div>
  )
}
