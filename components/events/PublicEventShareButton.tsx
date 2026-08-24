"use client"

import { useState } from "react"

type PublicEventShareButtonProps = {
  title: string
  url: string
}

export default function PublicEventShareButton({ title, url }: PublicEventShareButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title,
          text: `Join me at ${title} on EventSlot.`,
          url,
        })
        return
      }
    } catch {
      return
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2500)
      }
    } catch {
      // Ignore clipboard failures and keep the action available.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-[0.8rem] font-semibold"
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface-2)" }}
      aria-label={`Share ${title}`}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12.5" cy="3" r="2" />
          <circle cx="3.5" cy="8" r="2" />
          <circle cx="12.5" cy="13" r="2" />
          <path d="M5.2 7.1l5.6-3.2M5.2 8.9l5.6 3.2" />
        </svg>
        {copied ? "Copied" : "Share"}
      </span>
    </button>
  )
}
