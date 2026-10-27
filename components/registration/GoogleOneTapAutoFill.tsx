"use client"

import React, { useEffect, useState, useRef } from "react"
import Script from "next/script"

interface GoogleOneTapAutoFillProps {
  googleClientId?: string
  onProfileReceived: (profile: { name: string; email: string }) => void
  disabled?: boolean
  className?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          prompt: (notification?: (notification: any) => void) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon"
              theme?: "outline" | "filled_blue" | "filled_black"
              size?: "large" | "medium" | "small"
              text?: "signin_with" | "signup_with" | "continue_with" | "signin"
              shape?: "rectangular" | "pill" | "circle" | "square"
              width?: number
            }
          ) => void
        }
      }
    }
  }
}

/**
 * Decodes the public payload of a Google JWT ID token in browser.
 */
function decodeGoogleJwt(token: string): { name?: string; email?: string } | null {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    const parsed = JSON.parse(jsonPayload)
    return {
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
    }
  } catch {
    return null
  }
}

export function GoogleOneTapAutoFill({
  googleClientId,
  onProfileReceived,
  disabled = false,
  className = "",
}: GoogleOneTapAutoFillProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const buttonContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!googleClientId || !scriptLoaded || disabled || initialized) return
    if (typeof window === "undefined" || !window.google?.accounts?.id) return

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response) => {
          if (!response?.credential) return
          const profile = decodeGoogleJwt(response.credential)
          if (profile?.email) {
            onProfileReceived({
              name: profile.name || "",
              email: profile.email,
            })
          }
        },
      })

      // Attempt non-intrusive One Tap prompt
      window.google.accounts.id.prompt()

      // Render standard 1-click button if container exists
      if (buttonContainerRef.current) {
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          theme: "outline",
          size: "medium",
          shape: "pill",
          text: "continue_with",
        })
      }

      setInitialized(true)
    } catch {
      // Ignore GSI initialization errors
    }
  }, [googleClientId, scriptLoaded, disabled, initialized, onProfileReceived])

  if (!googleClientId || disabled) return null

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="lazyOnload"
        onLoad={() => setScriptLoaded(true)}
      />
      <div className={`flex flex-col items-start gap-1.5 ${className}`}>
        <div className="flex items-center gap-2">
          <div ref={buttonContainerRef} className="min-h-[38px]" />
          <span className="text-[0.75rem] text-[var(--text-muted)] flex items-center gap-1">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--accent)]"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Instant auto-fill (no password needed)
          </span>
        </div>
      </div>
    </>
  )
}
