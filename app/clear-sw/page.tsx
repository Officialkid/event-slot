"use client"
import { useEffect } from "react"

export default function ClearServiceWorker() {
  useEffect(() => {
    async function clear() {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(r => r.unregister()))
        const cacheKeys = await caches.keys()
        await Promise.all(cacheKeys.map(k => caches.delete(k)))
      }
      window.location.replace("/")
    }
    clear()
  }, [])

  return (
    <div style={{ background: "var(--bg-page)", color: "var(--text-primary)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-dm-sans)" }}>
      <p>Clearing cached data and reloading…</p>
    </div>
  )
}
