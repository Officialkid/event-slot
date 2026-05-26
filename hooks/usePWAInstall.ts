"use client"

import { useState, useEffect } from "react"

export type InstallMethod =
  | "play-store"
  | "pwa-prompt"
  | "ios-manual"
  | "already-installed"
  | null

export interface PWAInstallState {
  method:        InstallMethod
  isAndroid:     boolean
  isIOS:         boolean
  isMobile:      boolean
  isInstalled:   boolean
  promptInstall: (() => Promise<void>) | null
}

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [isInstalled,    setIsInstalled]    = useState(false)
  const [isMounted,      setIsMounted]      = useState(false)

  useEffect(() => {
    setIsMounted(true)

    const handlePrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> })
    }
    window.addEventListener("beforeinstallprompt", handlePrompt)

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsInstalled(isStandalone)

    const onInstalled = () => { setIsInstalled(true); setDeferredPrompt(null) }
    window.addEventListener("appinstalled", onInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const EMPTY: PWAInstallState = {
    method: null, isAndroid: false, isIOS: false,
    isMobile: false, isInstalled: false, promptInstall: null,
  }

  if (!isMounted) return EMPTY

  const ua        = navigator.userAgent.toLowerCase()
  const isAndroid = /android/.test(ua)
  const isIOS     = /iphone|ipad|ipod/.test(ua)
  const isMobile  = isAndroid || isIOS || /mobile|tablet/.test(ua) || window.innerWidth <= 768

  if (isInstalled) {
    return { method: "already-installed", isAndroid, isIOS, isMobile, isInstalled: true, promptInstall: null }
  }

  // Android — direct to Play Store (primary path for TWA users)
  if (isAndroid) {
    return { method: "play-store", isAndroid, isIOS, isMobile, isInstalled: false, promptInstall: null }
  }

  // PWA install prompt available (desktop Chrome / non-Android)
  if (deferredPrompt) {
    const promptInstall = async () => {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") setIsInstalled(true)
      setDeferredPrompt(null)
    }
    return { method: "pwa-prompt", isAndroid, isIOS, isMobile, isInstalled: false, promptInstall }
  }

  // iOS — manual Add to Home Screen
  if (isIOS) {
    return { method: "ios-manual", isAndroid, isIOS, isMobile, isInstalled: false, promptInstall: null }
  }

  return EMPTY
}
