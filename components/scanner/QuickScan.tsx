"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { Flashlight } from "lucide-react"
import { extractTicketReferenceFromFile, normalizeDecodedValue } from "@/components/scanner/qr-utils"
import { scannerAudio } from "@/lib/scannerAudio"

type ScanState = "scanning" | "valid" | "used" | "not_found" | "error"
type InputMode = "camera" | "upload" | "manual"

type QuickScanResult = {
  success?: boolean
  valid?: boolean
  alreadyVerified?: boolean
  message?: string
  error?: string
  eventStats?: {
    totalConfirmed: number
    totalCheckedIn: number
    remaining?: number
  }
  ticket?: {
    attendeeName?: string | null
    checkedInAt?: string | null
    scannedAt?: string | null
    admissionsTotal?: number
    admissionsUsed?: number
    admissionsRemaining?: number
  }
}

interface Props {
  eventSlug: string
  accessToken: string
  onExit: () => void
  onVerified?: () => void
  initialInputMode?: InputMode
  title?: string
}

const scannerSurface = "var(--surface)"
const scannerSurfaceAlt = "var(--surface-2)"
const scannerBorder = "var(--border)"
const scannerBorderSoft = "var(--border-subtle)"
const scannerTextPrimary = "var(--text-primary)"
const scannerTextSecondary = "var(--text-secondary)"
const scannerTextMuted = "var(--text-muted)"

export function QuickScan({
  eventSlug,
  accessToken,
  onExit,
  onVerified,
  initialInputMode = "camera",
  title = "VERIFY TICKET",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const lockRef = useRef(false)

  const [state, setState] = useState<ScanState>("scanning")
  const [message, setMessage] = useState("Point camera at ticket QR")
  const [inputMode, setInputMode] = useState<InputMode>(initialInputMode)
  const [cameraReady, setCameraReady] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [manualIdentity, setManualIdentity] = useState("")
  const [myScansCount, setMyScansCount] = useState(0)
  const [eventStats, setEventStats] = useState<{ totalConfirmed: number; totalCheckedIn: number; remaining?: number } | null>(null)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  // Fetch initial live event admission stats on mount
  useEffect(() => {
    let active = true
    async function loadStats() {
      try {
        const res = await fetch(`/api/events/${eventSlug}/verify-ticket/stats?token=${encodeURIComponent(accessToken)}`)
        if (res.ok) {
          const data = await res.json()
          if (active && data.success) {
            setEventStats({
              totalConfirmed: data.totalConfirmed,
              totalCheckedIn: data.totalCheckedIn,
              remaining: data.remaining,
            })
          }
        }
      } catch {
        // Non-blocking fallback
      }
    }
    void loadStats()
    return () => {
      active = false
    }
  }, [accessToken, eventSlug])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      const nextState = !torchOn
      await (track as MediaStreamTrack & { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextState }],
      })
      setTorchOn(nextState)
    } catch {
      // Hardware constraint error
    }
  }

  const resetVisualState = useCallback(() => {
    lockRef.current = false
    setState("scanning")
    setMessage("Point camera at ticket QR")
  }, [])

  const submitVerification = useCallback(
    async (payload: { ticketCode?: string; code?: string; identity?: string }) => {
      lockRef.current = true
      scannerAudio.resume()

      try {
        const res = await fetch(`/api/events/${eventSlug}/verify-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: accessToken, ...payload }),
        })

        const data = (await res.json()) as QuickScanResult

        let nextState: ScanState = "not_found"
        let nextMessage = "Ticket not found"
        let delay = 2000

        if (res.ok && data.success && data.valid) {
          nextState = "valid"
          nextMessage =
            data.ticket?.admissionsTotal && data.ticket.admissionsTotal > 1
              ? `Welcome, ${data.ticket?.attendeeName || "Attendee"}! ${data.ticket.admissionsRemaining ?? 0} remaining.`
              : `Welcome, ${data.ticket?.attendeeName || "Attendee"}!`
          onVerified?.()
          scannerAudio.playSuccess()
          setMyScansCount((c) => c + 1)
          if (data.eventStats) {
            setEventStats(data.eventStats)
          } else {
            setEventStats((prev) =>
              prev ? { ...prev, totalCheckedIn: prev.totalCheckedIn + 1, remaining: Math.max(0, (prev.remaining ?? 1) - 1) } : null
            )
          }
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([100, 60, 100])
          }
        } else if (data.alreadyVerified || (data.message || "").toLowerCase().includes("already")) {
          nextState = "used"
          const scannedAt = data.ticket?.checkedInAt || data.ticket?.scannedAt
          nextMessage = scannedAt
            ? `Already scanned at ${new Date(scannedAt).toLocaleTimeString()}`
            : "Already scanned"
          delay = 3000
          scannerAudio.playWarning()
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([500])
          }
        } else if (res.status >= 500) {
          nextState = "error"
          nextMessage = "Connection error. Tap retry."
          delay = 2500
          scannerAudio.playWarning()
        } else {
          nextState = "not_found"
          nextMessage = data.error || "Ticket not found"
          scannerAudio.playWarning()
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([500])
          }
        }

        setState(nextState)
        setMessage(nextMessage)
        window.setTimeout(() => {
          resetVisualState()
        }, delay)
      } catch {
        setState("error")
        setMessage("Connection error. Tap retry.")
        scannerAudio.playWarning()
        window.setTimeout(() => {
          resetVisualState()
        }, 2500)
      }
    },
    [accessToken, eventSlug, onVerified, resetVisualState]
  )

  const handleDecoded = useCallback(
    async (raw: string) => {
      if (lockRef.current) return
      const normalized = normalizeDecodedValue(raw)

      if (!normalized.value) {
        setState("error")
        setMessage("Invalid code")
        window.setTimeout(() => resetVisualState(), 1500)
        return
      }

      if (normalized.kind === "identity") {
        await submitVerification({ identity: normalized.value })
        return
      }

      if (normalized.kind === "qrPayload") {
        await submitVerification({ code: normalized.value })
        return
      }

      await submitVerification({ ticketCode: normalized.value, code: normalized.value })
    },
    [resetVisualState, submitVerification]
  )

  const stopCamera = () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0]
      if (track && torchOn) {
        try {
          (track as MediaStreamTrack & { applyConstraints: (c: unknown) => Promise<void> })
            .applyConstraints({ advanced: [{ torch: false }] })
            .catch(() => {})
        } catch {
          // Ignore
        }
      }
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setTorchOn(false)
    setTorchAvailable(false)
    setCameraReady(false)
  }

  useEffect(() => {
    if (inputMode !== "camera") {
      stopCamera()
      return
    }

    let cancelled = false

    async function startCamera() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        })

        if (cancelled) {
          media.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = media
        const video = videoRef.current
        if (!video) return

        const track = media.getVideoTracks()[0]
        if (track) {
          try {
            const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as { torch?: boolean }
            if (capabilities.torch) {
              setTorchAvailable(true)
            }
          } catch {
            // Ignore
          }
        }

        video.srcObject = media
        await video.play()
        setCameraReady(true)

        const tick = () => {
          if (!videoRef.current || !canvasRef.current || lockRef.current) {
            frameRef.current = requestAnimationFrame(tick)
            return
          }

          const videoEl = videoRef.current
          if (videoEl.readyState < 2) {
            frameRef.current = requestAnimationFrame(tick)
            return
          }

          const canvas = canvasRef.current
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            frameRef.current = requestAnimationFrame(tick)
            return
          }

          canvas.width = videoEl.videoWidth
          canvas.height = videoEl.videoHeight
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const decoded = jsQR(imageData.data, imageData.width, imageData.height)

          if (decoded?.data) {
            void handleDecoded(decoded.data)
          }

          frameRef.current = requestAnimationFrame(tick)
        }

        frameRef.current = requestAnimationFrame(tick)
      } catch {
        setState("error")
        setMessage("Camera not available. Use upload/manual.")
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [handleDecoded, inputMode])

  const onUpload = async (file: File | null) => {
    if (!file) return
    const decoded = await extractTicketReferenceFromFile(file)
    if (!decoded) {
      setState("error")
      setMessage("We could not read a ticket from that file")
      window.setTimeout(() => resetVisualState(), 1800)
      return
    }
    await handleDecoded(decoded)
  }

  const overlayClass = {
    valid: "bg-[#22C55E]/90",
    used: "bg-[#EF4444]/90",
    not_found: "bg-[#EF4444]/90",
    error: "bg-[#F59E0B]/90",
    scanning: "bg-transparent",
  }[state]

  const icon = {
    valid: "✓",
    used: "✕",
    not_found: "✕",
    error: "⚠",
    scanning: "",
  }[state]

  return (
    <div
      className="relative w-full min-h-[80vh] rounded-2xl overflow-hidden border"
      style={{ backgroundColor: scannerSurfaceAlt, borderColor: scannerBorder }}
    >
      <div className="absolute z-20 top-4 left-4 flex gap-2">
        <button
          onClick={onExit}
          className="px-3 py-1.5 rounded-full text-xs border"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.68)",
            borderColor: scannerBorderSoft,
            color: "#ffffff",
            backdropFilter: "blur(10px)",
          }}
        >
          Exit
        </button>
        <span className="px-3 py-1.5 rounded-full bg-[#C8F55A] text-black text-xs font-semibold">{title}</span>
      </div>

      <div className="absolute z-20 top-4 right-4 flex gap-2">
        {(["camera", "upload", "manual"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              setInputMode(mode)
              resetVisualState()
            }}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              inputMode === mode ? "bg-[#C8F55A] text-black border-[#C8F55A]" : ""
            }`}
            style={
              inputMode === mode
                ? undefined
                : {
                    backgroundColor: scannerSurface,
                    borderColor: scannerBorderSoft,
                    color: scannerTextSecondary,
                  }
            }
          >
            {mode === "camera" ? "Scan" : mode === "upload" ? "Upload" : "Manual"}
          </button>
        ))}
      </div>

      {/* Live Admission Status & Torch Controls */}
      <div className="absolute z-20 top-14 left-4 right-4 flex items-center justify-between pointer-events-none gap-2 flex-wrap">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border shadow-lg pointer-events-auto"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.82)",
            borderColor: "rgba(255, 255, 255, 0.16)",
            color: "#f8fafc",
            backdropFilter: "blur(12px)",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-[#C8F55A] animate-pulse" />
          <span>My Scans: <strong className="text-[#C8F55A] font-bold">{myScansCount}</strong></span>
          <span className="text-white/40">•</span>
          <span>
            Total Admitted: <strong className="text-white font-bold">{eventStats ? `${eventStats.totalCheckedIn} / ${eventStats.totalConfirmed}` : "..."}</strong>
          </span>
        </div>

        {inputMode === "camera" && torchAvailable && (
          <button
            type="button"
            onClick={toggleTorch}
            className={`pointer-events-auto px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-lg ${
              torchOn
                ? "bg-amber-400 text-black border-amber-300 shadow-amber-400/20"
                : "text-white border-white/20 hover:bg-white/10"
            }`}
            style={torchOn ? undefined : { backgroundColor: "rgba(15, 23, 42, 0.82)", backdropFilter: "blur(12px)" }}
            title={torchOn ? "Turn off torch" : "Turn on torch for low light"}
          >
            <Flashlight className={`w-3.5 h-3.5 ${torchOn ? "text-black fill-current" : "text-amber-400"}`} />
            <span>{torchOn ? "Torch On" : "Torch"}</span>
          </button>
        )}
      </div>

      <div className="h-[78vh] relative">
        {inputMode === "camera" && <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />}
        {inputMode === "camera" && <canvas ref={canvasRef} className="hidden" />}

        {inputMode === "upload" && (
          <div className="h-full flex items-center justify-center p-8">
            <label
              className="w-full max-w-md border border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors"
              style={{
                borderColor: scannerBorderSoft,
                backgroundColor: scannerSurface,
                color: scannerTextSecondary,
              }}
            >
              <p className="text-sm mb-2">Upload ticket image or PDF</p>
              <p className="text-xs mb-4" style={{ color: scannerTextMuted }}>
                PNG / JPG / PDF exported from EventSlot
              </p>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  void onUpload(file)
                }}
              />
              <span className="inline-block px-3 py-1.5 text-xs rounded-xl bg-[#C8F55A] text-black font-bold hover:bg-[#b8e040] transition-colors">
                Choose file
              </span>
            </label>
          </div>
        )}

        {inputMode === "manual" && (
          <div className="h-full flex items-center justify-center p-6">
            <div
              className="w-full max-w-md border rounded-2xl p-5 space-y-3"
              style={{ borderColor: scannerBorder, backgroundColor: scannerSurface }}
            >
              <p className="text-sm" style={{ color: scannerTextPrimary }}>Manual verify</p>
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ticket code"
                className="border rounded-xl px-4 py-3 placeholder:text-[#6b7280] focus:outline-none focus:border-[#C8F55A] transition-colors w-full text-sm"
                style={{
                  backgroundColor: scannerSurfaceAlt,
                  borderColor: scannerBorderSoft,
                  color: scannerTextPrimary,
                }}
              />
              <button
                onClick={() => void handleDecoded(manualCode)}
                disabled={!manualCode.trim()}
                className="bg-[#C8F55A] text-black font-bold px-6 py-3 rounded-xl hover:bg-[#b8e040] transition-colors w-full text-sm disabled:opacity-50"
              >
                Verify ticket code
              </button>

              <input
                value={manualIdentity}
                onChange={(e) => setManualIdentity(e.target.value)}
                placeholder="Email or full name"
                className="border rounded-xl px-4 py-3 placeholder:text-[#6b7280] focus:outline-none focus:border-[#C8F55A] transition-colors w-full text-sm"
                style={{
                  backgroundColor: scannerSurfaceAlt,
                  borderColor: scannerBorderSoft,
                  color: scannerTextPrimary,
                }}
              />
              <button
                onClick={() => void submitVerification({ identity: manualIdentity.trim() })}
                disabled={!manualIdentity.trim()}
                className="w-full border text-sm rounded-xl py-3 disabled:opacity-50"
                style={{
                  backgroundColor: scannerSurface,
                  borderColor: scannerBorderSoft,
                  color: scannerTextSecondary,
                }}
              >
                Verify email/name
              </button>
            </div>
          </div>
        )}

        {state === "scanning" && inputMode === "camera" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-[#C8F55A] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            <p
              className="absolute bottom-16 text-xs"
              style={{
                color: "#f8fafc",
                textShadow: "0 2px 12px rgba(0,0,0,0.55)",
              }}
            >
              {cameraReady ? "Align ticket QR inside frame" : "Starting camera..."}
            </p>
          </div>
        )}

        {state !== "scanning" && (
          <button
            onClick={resetVisualState}
            className={`absolute inset-0 flex flex-col items-center justify-center ${overlayClass} transition-colors`}
          >
            <span className="text-white text-7xl mb-4">{icon}</span>
            <p className="text-white font-bold text-2xl text-center px-6">{message}</p>
            <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.82)" }}>
              Tap to continue
            </p>
          </button>
        )}

        {inputMode !== "camera" && state === "scanning" && (
          <div className="absolute inset-x-0 bottom-0 px-6 py-4 text-center">
            <p className="text-xs" style={{ color: scannerTextMuted }}>
              {inputMode === "upload"
                ? "Upload a ticket file and we will read the QR for you."
                : "Enter a ticket code, email, or attendee name to continue."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
