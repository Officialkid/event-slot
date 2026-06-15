"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { extractTicketReferenceFromFile, normalizeDecodedValue } from "@/components/scanner/qr-utils"

type ScanState = "scanning" | "valid" | "used" | "not_found" | "error"
type InputMode = "camera" | "upload" | "manual"

type QuickScanResult = {
  success?: boolean
  valid?: boolean
  alreadyVerified?: boolean
  message?: string
  error?: string
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

export function QuickScan({ eventSlug, accessToken, onExit, onVerified, initialInputMode = "camera", title = "VERIFY TICKET" }: Props) {
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

  const resetVisualState = useCallback(() => {
    lockRef.current = false
    setState("scanning")
    setMessage("Point camera at ticket QR")
  }, [])

  const submitVerification = useCallback(
    async (payload: { ticketCode?: string; code?: string; identity?: string }) => {
      lockRef.current = true

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
          nextMessage = data.ticket?.admissionsTotal && data.ticket.admissionsTotal > 1
            ? `Welcome, ${data.ticket?.attendeeName || "Attendee"}! ${data.ticket.admissionsRemaining ?? 0} remaining.`
            : `Welcome, ${data.ticket?.attendeeName || "Attendee"}!`
          delay = 2000
          onVerified?.()
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
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([500])
          }
        } else if (res.status >= 500) {
          nextState = "error"
          nextMessage = "Connection error. Tap retry."
          delay = 2500
        } else {
          nextState = "not_found"
          nextMessage = data.error || "Ticket not found"
          delay = 2000
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
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
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
    used: "✗",
    not_found: "✗",
    error: "⚠",
    scanning: "",
  }[state]

  return (
    <div className="relative w-full min-h-[80vh] rounded-2xl overflow-hidden bg-black border border-[#232323]">
      <div className="absolute z-20 top-4 left-4 flex gap-2">
        <button onClick={onExit} className="px-3 py-1.5 rounded-full bg-[#0A0A0A]/70 text-white text-xs border border-[#2A2A2A]">
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
            className={`px-3 py-1.5 rounded-full text-xs border ${
              inputMode === mode
                ? "bg-[#C8F55A] text-black border-[#C8F55A]"
                : "bg-[#141414] text-[#A3A3A3] border-[#2A2A2A] hover:text-white"
            }`}
          >
            {mode === "camera" ? "Scan" : mode === "upload" ? "Upload" : "Manual"}
          </button>
        ))}
      </div>

      <div className="h-[78vh] relative">
        {inputMode === "camera" && <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />}
        {inputMode === "camera" && <canvas ref={canvasRef} className="hidden" />}

        {inputMode === "upload" && (
          <div className="h-full flex items-center justify-center p-8">
            <label className="w-full max-w-md border border-dashed border-[#2A2A2A] rounded-2xl p-8 text-center text-[#A3A3A3] cursor-pointer hover:border-[#C8F55A]/40 bg-[#141414]">
              <p className="text-sm mb-2">Upload ticket image or PDF</p>
              <p className="text-xs text-[#525252] mb-4">PNG / JPG / PDF exported from EventSlot</p>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  void onUpload(file)
                }}
              />
              <span className="inline-block px-3 py-1.5 text-xs rounded-xl bg-[#C8F55A] text-black font-bold hover:bg-[#b8e040] transition-colors">Choose file</span>
            </label>
          </div>
        )}

        {inputMode === "manual" && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="w-full max-w-md border border-[#2A2A2A] rounded-2xl bg-[#141414] p-5 space-y-3">
              <p className="text-sm text-white">Manual verify</p>
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ticket code"
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder:text-[#525252] focus:outline-none focus:border-[#C8F55A] transition-colors w-full text-sm"
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
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder:text-[#525252] focus:outline-none focus:border-[#C8F55A] transition-colors w-full text-sm"
              />
              <button
                onClick={() => void submitVerification({ identity: manualIdentity.trim() })}
                disabled={!manualIdentity.trim()}
                className="w-full bg-[#141414] border border-[#2A2A2A] text-[#A3A3A3] text-sm rounded-xl py-3 hover:text-white disabled:opacity-50"
              >
                Verify email/name
              </button>
            </div>
          </div>
        )}

        {state === "scanning" && inputMode === "camera" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-[#C8F55A] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            <p className="absolute bottom-16 text-xs text-[#A3A3A3]">
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
            <p className="text-[#A3A3A3] text-xs mt-3">Tap to continue</p>
          </button>
        )}
      </div>
    </div>
  )
}
