"use client"

import { useEffect, useState } from "react"
import { Camera, Search } from "lucide-react"
import { ManualTicketVerifier } from "@/components/scanner/ManualTicketVerifier"
import { QuickScan } from "@/components/scanner/QuickScan"

type Mode = null | "scan" | "manual"

interface Props {
  eventSlug: string
  accessToken: string
  onVerified?: () => void
}

const scannerSurface = "var(--surface)"
const scannerSurfaceAlt = "var(--surface-2)"
const scannerBorder = "var(--border)"
const scannerBorderSoft = "var(--border-subtle)"
const scannerTextPrimary = "var(--text-primary)"
const scannerTextSecondary = "var(--text-secondary)"

export function ScannerHome({ eventSlug, accessToken, onVerified }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const [showCameraRationale, setShowCameraRationale] = useState(false)
  const [pendingMode, setPendingMode] = useState<Mode>(null)
  const [stats, setStats] = useState<{ totalConfirmed: number; totalCheckedIn: number; remaining: number; turnoutRate: number } | null>(null)

  useEffect(() => {
    let active = true
    async function loadStats() {
      try {
        const res = await fetch(`/api/events/${eventSlug}/verify-ticket/stats?token=${encodeURIComponent(accessToken)}`)
        if (res.ok) {
          const data = await res.json()
          if (active && data.success) {
            setStats(data)
          }
        }
      } catch {}
    }
    void loadStats()
    return () => {
      active = false
    }
  }, [accessToken, eventSlug, mode])

  const requestCameraAccess = (target: Mode) => {
    setPendingMode(target)
    setShowCameraRationale(true)
  }

  const proceedToCamera = async () => {
    setShowCameraRationale(false)
    if (!pendingMode) return

    const result = await navigator.permissions.query({ name: "camera" as PermissionName })
    if (result.state === "denied") {
      alert("Camera access is required for ticket scanning. Please enable it in your device settings.")
      setPendingMode(null)
      return
    }

    setMode(pendingMode)
    setPendingMode(null)
  }

  if (mode === "scan") {
    return (
      <QuickScan
        eventSlug={eventSlug}
        accessToken={accessToken}
        onExit={() => setMode(null)}
        onSwitchToManual={() => setMode("manual")}
        onVerified={onVerified}
        initialInputMode="camera"
        title="VERIFY TICKET"
      />
    )
  }

  if (mode === "manual") {
    return (
      <ManualTicketVerifier
        eventSlug={eventSlug}
        accessToken={accessToken}
        onExit={() => setMode(null)}
        onVerified={onVerified}
      />
    )
  }

  return (
    <>
      <div
        className="min-h-[70vh] border rounded-2xl flex flex-col items-center justify-center p-6 gap-6"
        style={{ backgroundColor: scannerSurfaceAlt, borderColor: scannerBorder }}
      >
        {stats && (
          <div
            className="w-full max-w-4xl rounded-2xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm"
            style={{ backgroundColor: scannerSurface, borderColor: scannerBorderSoft }}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C8F55A] animate-pulse" />
              <div>
                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-[#C8F55A] block">
                  Live Gate Overview
                </span>
                <span className="text-xs font-semibold" style={{ color: scannerTextPrimary }}>
                  {stats.totalCheckedIn} of {stats.totalConfirmed} Admitted
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs">
              <div className="text-center sm:text-left">
                <span className="block text-[0.7rem]" style={{ color: scannerTextSecondary }}>Turnout Rate</span>
                <strong className="text-[#C8F55A] text-sm font-bold">{stats.turnoutRate}%</strong>
              </div>
              <div className="hidden sm:block text-white/20">•</div>
              <div className="text-center sm:text-left">
                <span className="block text-[0.7rem]" style={{ color: scannerTextSecondary }}>Awaiting Entry</span>
                <strong style={{ color: scannerTextPrimary }} className="text-sm font-bold">{stats.remaining}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-4xl grid sm:grid-cols-2 gap-5">
          <button
            onClick={() => requestCameraAccess("scan")}
            className="w-full border rounded-2xl p-6 text-left transition-all hover:scale-[1.01] hover:border-[#C8F55A]/50 group shadow-sm"
            style={{ borderColor: scannerBorderSoft, backgroundColor: scannerSurface }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 flex items-center justify-center shrink-0 group-hover:bg-[#C8F55A]/20 transition-colors">
                <Camera className="w-6 h-6 text-[#C8F55A]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-bold text-base" style={{ color: scannerTextPrimary }}>Scan QR Code</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#C8F55A]/15 text-[#C8F55A] border border-[#C8F55A]/30">
                    Camera
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: scannerTextSecondary }}>
                  Point device camera at physical or digital attendee QR codes for instant admission verification.
                </p>
                <p className="text-[#C8F55A] text-xs font-semibold mt-3">Primary Gate Check-in →</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode("manual")}
            className="w-full border rounded-2xl p-6 text-left transition-all hover:scale-[1.01] hover:border-[#F59E0B]/50 group shadow-sm"
            style={{ borderColor: scannerBorderSoft, backgroundColor: scannerSurface }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center shrink-0 group-hover:bg-[#F59E0B]/20 transition-colors">
                <Search className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-bold text-base" style={{ color: scannerTextPrimary }}>Search Attendee</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#FCD34D] border border-[#F59E0B]/30">
                    Live Search
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: scannerTextSecondary }}>
                  Instant live search by first name, surname, email address, registration number, or ticket code.
                </p>
                <p className="text-[#FCD34D] text-xs font-semibold mt-3">Exceptions & Lookup →</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {showCameraRationale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div
            className="w-full max-w-sm border rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: scannerSurface, borderColor: scannerBorder }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 flex items-center justify-center">
                <Camera className="w-5 h-5 text-[#C8F55A]" />
              </div>
              <p className="font-semibold" style={{ color: scannerTextPrimary }}>Camera Access Needed</p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: scannerTextSecondary }}>
              EventSlot needs your camera to scan QR code tickets at event check-in.
              Your camera is only active while the scanner is open and is never
              recorded or saved.
            </p>
            <div className="flex gap-2">
              <button
                onClick={proceedToCamera}
                className="flex-1 bg-[#C8F55A] text-black font-bold py-2.5 rounded-xl text-sm"
              >
                Allow Camera
              </button>
              <button
                onClick={() => {
                  setShowCameraRationale(false)
                  setPendingMode(null)
                }}
                className="flex-1 border py-2.5 rounded-xl text-sm"
                style={{ borderColor: scannerBorderSoft, color: scannerTextSecondary }}
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
