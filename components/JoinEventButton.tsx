"use client"

import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"

interface Props {
  eventId: string
  eventType: "PHYSICAL" | "VIRTUAL"
  startDate: Date | string
  endDate: Date | string | null
  opensAt?: Date | string | null
}

type VerifyResult = {
  success: boolean
  attendeeName?: string
  meetingLink?: string
  message: string
  reason?: string
  minutesUntil?: number
  opensAt?: string
}

export function JoinEventButton({ eventId, eventType, startDate, endDate, opensAt }: Props) {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [isWindowOpen, setIsWindowOpen] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [fallbackQuery, setFallbackQuery] = useState("")
  const [fallbackLoading, setFallbackLoading] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)

  useEffect(() => {
    const start = startDate instanceof Date ? startDate : new Date(startDate)
    const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null
    const customOpen = opensAt ? (opensAt instanceof Date ? opensAt : new Date(opensAt)) : null
    const openWindow = customOpen ?? new Date(start.getTime() - 30 * 60 * 1000)
    const eventEndTime = end ?? new Date(start.getTime() + 4 * 60 * 60 * 1000)

    function updateStatus() {
      const now = new Date()

      if (now >= openWindow && now <= eventEndTime) {
        setIsWindowOpen(true)
        setCountdown(null)
        return
      }

      if (now > eventEndTime) {
        setCountdown("Event has ended")
        setIsWindowOpen(false)
        return
      }

      const diff = openWindow.getTime() - now.getTime()
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)

      setCountdown(
        days > 0
          ? `Opens in ${days}d ${hours}h ${minutes}m`
          : hours > 0
            ? `Opens in ${hours}h ${minutes}m`
            : `Opens in ${minutes} minute${minutes !== 1 ? "s" : ""}`
      )
    }

    updateStatus()
    const interval = window.setInterval(updateStatus, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [startDate, endDate, opensAt])

  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  async function startScanning() {
    setScanning(true)
    scanningRef.current = true
    setFallback(false)
    setResult(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stopScanning()
        return
      }

      video.srcObject = stream
      await video.play()
      scanFrame()
    } catch {
      setResult({
        success: false,
        message: "Camera access denied. Please use the name or email lookup below.",
      })
      stopScanning()
    }
  }

  function scanFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || !scanningRef.current) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)

      if (code?.data) {
        stopScanning()
        void verifyTicket(code.data)
        return
      }
    }

    requestAnimationFrame(scanFrame)
  }

  function stopScanning() {
    scanningRef.current = false

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setScanning(false)
  }

  async function verifyTicket(qrPayload: string) {
    try {
      const res = await fetch(`/api/events/${eventId}/verify-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrPayload }),
      })

      const data = (await res.json()) as VerifyResult
      setResult(data)
    } catch {
      setResult({ success: false, message: "Unable to verify ticket right now." })
    }
  }

  async function handleFallback() {
    if (!fallbackQuery.trim()) return

    setFallbackLoading(true)
    setResult(null)

    try {
      const lookupRes = await fetch(`/api/events/id/${eventId}/lookup?q=${encodeURIComponent(fallbackQuery)}`)
      const lookupData = (await lookupRes.json()) as {
        found?: boolean
        status?: string
        message?: string
        ticketId?: string
      }

      if (!lookupData.found || lookupData.status !== "CONFIRMED") {
        setResult({
          success: false,
          message: lookupData.message ?? "No confirmed registration found.",
        })
        return
      }

      const verifyRes = await fetch(`/api/events/${eventId}/verify-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupTicketId: lookupData.ticketId ?? "" }),
      })

      const verifyData = (await verifyRes.json()) as VerifyResult
      setResult(verifyData)
    } catch {
      setResult({ success: false, message: "Lookup failed. Please try again." })
    } finally {
      setFallbackLoading(false)
    }
  }

  if (eventType === "PHYSICAL") return null

  return (
    <div className="mt-6">
      {!isWindowOpen && countdown && (
        <div className="rounded-xl border border-[#2A2A2A] p-4 text-center">
          <p className="text-sm text-[#525252]">{countdown}</p>
          <p className="mt-1 text-xs text-[#525252]">Have your ticket ready. You will scan it to join.</p>
        </div>
      )}

      {isWindowOpen && !scanning && !result && (
        <div className="space-y-3">
          <button
            onClick={() => void startScanning()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8F55A] py-4 text-base font-bold text-black transition-colors hover:bg-[#b8e040]"
          >
            Scan Ticket to Join
          </button>
          <button
            onClick={() => setFallback(true)}
            className="w-full py-2 text-sm text-[#525252] transition-colors hover:text-[#A3A3A3]"
          >
            Do not have your ticket? Use name or email.
          </button>
        </div>
      )}

      {scanning && (
        <div className="relative overflow-hidden rounded-xl border border-[#C8F55A]">
          <video ref={videoRef} className="w-full" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-lg border-2 border-[#C8F55A] opacity-70" />
          </div>
          <button
            onClick={stopScanning}
            className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white"
          >
            Cancel
          </button>
          <p className="absolute bottom-3 left-0 right-0 bg-black/40 py-1 text-center text-xs text-white">
            Point camera at your ticket QR code
          </p>
        </div>
      )}

      {fallback && !result && (
        <div className="space-y-3 rounded-xl border border-[#2A2A2A] p-4">
          <p className="text-sm font-medium text-white">Enter your name or email</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={fallbackQuery}
              onChange={(e) => setFallbackQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleFallback()
                }
              }}
              placeholder="Your name or email..."
              className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder:text-[#525252] focus:border-[#C8F55A] focus:outline-none"
            />
            <button
              onClick={() => void handleFallback()}
              disabled={fallbackLoading}
              className="rounded-lg bg-[#C8F55A] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              {fallbackLoading ? "..." : "Verify"}
            </button>
          </div>
          <button
            onClick={() => {
              setFallback(false)
              void startScanning()
            }}
            className="text-xs text-[#525252] hover:text-[#A3A3A3]"
          >
            Back to QR scan
          </button>
        </div>
      )}

      {result && (
        <div
          className={`rounded-xl border p-5 ${
            result.success
              ? "border-[#22C55E]/30 bg-[#22C55E]/5"
              : "border-[#EF4444]/30 bg-[#EF4444]/5"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">{result.success ? "Success" : "Denied"}</span>
            <p className="font-semibold text-white">
              {result.success ? `Welcome, ${result.attendeeName ?? "Attendee"}!` : "Access Denied"}
            </p>
          </div>
          <p className="mb-4 text-sm text-[#A3A3A3]">{result.message}</p>

          {result.success && result.meetingLink && (
            <a
              href={result.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8F55A] px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-[#b8e040]"
            >
              Open Google Meet
            </a>
          )}

          {!result.success && result.reason !== "EVENT_ENDED" && (
            <button
              onClick={() => {
                setResult(null)
                setFallback(false)
              }}
              className="mt-3 text-xs text-[#525252] hover:text-[#A3A3A3]"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
