"use client"

import { useState } from "react"
import { usePWAInstall } from "@/hooks/usePWAInstall"

type SidebarInstallPromptProps = {
  collapsed?: boolean
}

function IconInstall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

export function SidebarInstallPrompt({ collapsed = false }: SidebarInstallPromptProps) {
  const { method, promptInstall, isInstalled } = usePWAInstall()
  const [showIosTip, setShowIosTip] = useState(false)
  const cardBackground = "linear-gradient(160deg, color-mix(in srgb, var(--accent) 12%, var(--surface) 88%), color-mix(in srgb, var(--info) 6%, var(--surface) 94%) 58%, color-mix(in srgb, white 20%, var(--surface) 80%))"
  const cardBorder = "color-mix(in srgb, var(--accent) 28%, var(--text-primary) 10%)"
  const iconSurface = "color-mix(in srgb, var(--accent) 14%, var(--surface) 86%)"
  const accentText = "color-mix(in srgb, var(--accent) 40%, var(--text-primary) 60%)"

  if (isInstalled || method === "already-installed") {
    return null
  }

  const ctaLabel =
    method === "ios-manual" || method === "android-manual"
        ? "How to install"
        : "Install now"

  const helperText =
    method === "ios-manual"
        ? "Add EventSlot to your Home Screen so updates and access stay close."
        : method === "android-manual"
          ? "Use your browser menu to install EventSlot directly to your device as a web app."
        : "Install EventSlot for faster access, app-like speed, and easier event updates."

  async function handleInstallClick() {
    if (method === "ios-manual") {
      setShowIosTip((current) => !current)
      return
    }

    if (method === "android-manual") {
      window.alert("On Android, open your browser menu and tap Install app or Add to Home Screen to install the EventSlot PWA.")
      return
    }

    if (method === "pwa-prompt" && promptInstall) {
      await promptInstall()
      return
    }

    window.alert("Open your browser menu and choose Install App or Add to Home Screen to keep EventSlot on your device.")
  }

  if (collapsed) {
    return (
      <div style={{ padding: "0.2rem 0 0.45rem", display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => {
            void handleInstallClick()
          }}
          title="Install EventSlot"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: `0.5px solid ${cardBorder}`,
            background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, var(--surface) 82%), color-mix(in srgb, var(--accent) 8%, var(--surface) 92%))",
            color: accentText,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <IconInstall />
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: "0.35rem 0.35rem 0.55rem", position: "relative" }}>
      <div
        style={{
          borderRadius: 16,
          border: `0.5px solid ${cardBorder}`,
          background: cardBackground,
          padding: "0.85rem 0.9rem",
          boxShadow: "0 14px 26px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              border: `0.5px solid ${cardBorder}`,
              background: iconSurface,
              color: accentText,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconInstall />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "0.8rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>
              Install EventSlot
            </p>
            <p style={{ margin: "0.3rem 0 0", color: "var(--text-secondary)", fontSize: "0.72rem", lineHeight: 1.55, fontFamily: "var(--font-dm-sans)" }}>
              {helperText}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleInstallClick()
          }}
          style={{
            marginTop: "0.75rem",
            width: "100%",
            borderRadius: 999,
            border: `0.5px solid ${cardBorder}`,
            background: "var(--accent)",
            color: "#0A0A0A",
            padding: "0.62rem 0.9rem",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.78rem",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {ctaLabel}
        </button>
      </div>

      {showIosTip ? (
        <div
          style={{
            marginTop: "0.55rem",
            borderRadius: 14,
            border: "0.5px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            padding: "0.8rem 0.9rem",
          }}
        >
          <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "0.72rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>
            Install on iPhone
          </p>
          <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.7rem", lineHeight: 1.55, fontFamily: "var(--font-dm-sans)" }}>
            Tap Share in Safari, choose <strong style={{ color: "var(--text-primary)" }}>Add to Home Screen</strong>, then tap <strong style={{ color: "var(--text-primary)" }}>Add</strong>.
          </p>
        </div>
      ) : null}
    </div>
  )
}
