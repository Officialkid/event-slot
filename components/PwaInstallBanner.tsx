"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISS_KEY = "eventslot.pwaBannerDismissedAt"
const LAST_SHOWN_KEY = "eventslot.pwaBannerLastShownAt"
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SHOW_COOLDOWN_MS = 24 * 60 * 60 * 1000

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false
  const standaloneDisplay = window.matchMedia("(display-mode: standalone)").matches
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return standaloneDisplay || iosStandalone
}

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
}

export function PwaInstallBanner() {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const microsoftStoreUrl = useMemo(
    () => process.env.NEXT_PUBLIC_MICROSOFT_STORE_URL ?? "",
    []
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    if (pathname !== "/") return

    let shouldSuppressBanner = false

    const lastShownRaw = window.localStorage.getItem(LAST_SHOWN_KEY)
    if (lastShownRaw) {
      const lastShownAt = Number(lastShownRaw)
      if (Number.isFinite(lastShownAt) && Date.now() - lastShownAt < SHOW_COOLDOWN_MS) {
        shouldSuppressBanner = true
        setHidden(true)
      } else {
        window.localStorage.removeItem(LAST_SHOWN_KEY)
      }
    }

    const dismissedAtRaw = window.localStorage.getItem(DISMISS_KEY)
    if (dismissedAtRaw) {
      const dismissedAt = Number(dismissedAtRaw)
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS) {
        shouldSuppressBanner = true
        setHidden(true)
      } else {
        window.localStorage.removeItem(DISMISS_KEY)
      }
    }

    setInstalled(isStandaloneMode())

    const onBeforeInstallPrompt = (event: Event) => {
      if (shouldSuppressBanner || isStandaloneMode()) {
        return
      }
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setHidden(true)
      window.localStorage.removeItem(DISMISS_KEY)
    }

    if (!shouldSuppressBanner) {
      window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    }
    window.addEventListener("appinstalled", onAppInstalled)

    if (!isStandaloneMode() && !shouldSuppressBanner) {
      window.localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()))
    }

    setReady(true)

    return () => {
      if (!shouldSuppressBanner) {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      }
      window.removeEventListener("appinstalled", onAppInstalled)
    }
  }, [pathname])

  async function handleDownloadClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === "accepted") {
        setHidden(true)
      }
      setDeferredPrompt(null)
      return
    }

    if (microsoftStoreUrl) {
      window.open(microsoftStoreUrl, "_blank", "noopener,noreferrer")
      return
    }

    if (isIosDevice()) {
      alert("To install on iPhone/iPad, tap Share and choose Add to Home Screen.")
      return
    }

    alert("This browser supports installation from the browser menu. Look for Install App or Add to Home Screen.")
  }

  function handleDismiss() {
    setHidden(true)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
  }

  if (pathname !== "/") return null
  if (!ready || hidden || installed) return null

  return (
    <div className="mx-auto mt-8 w-full max-w-5xl px-4 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-[#1B1B1E] px-5 py-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xl font-semibold leading-tight">Install EventSlot</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">
            Add EventSlot to your device for faster access, app-like performance, and a smoother event-day experience.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => {
                void handleDownloadClick()
              }}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Download app
            </button>
            <a
              href="/how-it-works"
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Learn more
            </a>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
              className="rounded-full px-2 py-1 text-2xl leading-none text-white/80 transition hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
