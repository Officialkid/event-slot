"use client"

import { useState } from "react"

export type PushSubscriptionState = "idle" | "requesting" | "granted" | "denied"

/**
 * Hook for managing browser push notification permissions.
 * Exposes a rationale-first flow required by Google Play Store policy —
 * the app must show an in-app explanation BEFORE triggering the system
 * permission dialog.
 *
 * Usage:
 *   const { showRationale, requestFromRationale, dismissRationale, subscriptionState } = usePushSubscription()
 *
 *   // 1. Show your rationale modal when showRationale is true
 *   // 2. Call requestFromRationale() when the user taps "Allow"
 *   // 3. Call dismissRationale() when the user taps "Not Now"
 */
export function usePushSubscription() {
  const [showRationale, setShowRationale] = useState(false)
  const [subscriptionState, setSubscriptionState] = useState<PushSubscriptionState>("idle")

  /** Call this to begin the permission flow — shows in-app rationale first. */
  const requestNotifications = () => {
    if (subscriptionState === "granted" || subscriptionState === "denied") return
    setShowRationale(true)
  }

  /** Call this when the user confirms in the rationale modal. */
  const requestFromRationale = async () => {
    setShowRationale(false)
    setSubscriptionState("requesting")

    if (!("Notification" in window)) {
      setSubscriptionState("denied")
      return
    }

    const permission = await Notification.requestPermission()

    if (permission !== "granted") {
      setSubscriptionState("denied")
      return
    }

    setSubscriptionState("granted")
    // TODO (MD-SYSTEM-01 S4-F): subscribe via navigator.serviceWorker + pushManager here
  }

  /** Call this when the user dismisses the rationale modal without granting. */
  const dismissRationale = () => {
    setShowRationale(false)
  }

  return {
    showRationale,
    subscriptionState,
    requestNotifications,
    requestFromRationale,
    dismissRationale,
  }
}
