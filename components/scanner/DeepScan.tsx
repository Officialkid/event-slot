"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { decodeQrFromImageFile, downloadCsv, normalizeDecodedValue } from "@/components/scanner/qr-utils"

type InputMode = "camera" | "upload" | "manual"

type ProfileResponse = {
  found: boolean
  ticketCode?: string
  alreadyScanned?: boolean
  scannedAt?: string | null
  attendee?: {
    name: string
    email: string | null
    registrationDate: string
    status: string
    customAnswers: Array<{ question: string; answer: string }>
    notes: Array<{ content: string; createdAt: string }>
  }
  error?: string
}

type HistoryItem = {
  time: string
  ticketCode: string
  attendee: string
  action: "mark_attended" | "skipped"
}

interface Props {
  eventSlug: string
  accessToken: string
  onExit: () => void
  onVerified?: () => void
}

const scannerSurface = "var(--surface)"
const scannerSurfaceAlt = "var(--surface-2)"
const scannerBorder = "var(--border)"
const scannerBorderSoft = "var(--border-subtle)"
const scannerTextPrimary = "var(--text-primary)"
const scannerTextSecondary = "var(--text-secondary)"
const scannerTextMuted = "var(--text-muted)"

export function DeepScan({ eventSlug, accessToken, onExit, onVerified }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const lockRef = useRef(false)

  const [inputMode, setInputMode] = useState<InputMode>("camera")
  const [cameraReady, setCameraReady] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [pendingCode, setPendingCode] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [manualCode, setManualCode] = useState("")
  const [manualIdentity, setManualIdentity] = useState("")

  const resetForNext = useCallback(() => {
    lockRef.current = false
    setProfile(null)
    setError("")
    setPendingCode("")
    setNote("")
  }, [])

  const parseScannedCode = (raw: string): string => {
    const normalized = normalizeDecodedValue(raw)
    if (normalized.kind === "qrPayload") return normalized.value
    if (normalized.kind === "ticketCode") return normalized.value
    return raw.trim()
  }

  const loadProfile = useCallback(
    async (rawCode: string) => {
      if (!rawCode.trim()) return
      lockRef.current = true
      setLoadingProfile(true)
      setError("")
      setProfile(null)

      try {
        const code = parseScannedCode(rawCode)
        const params = new URLSearchParams({ code, token: accessToken })
        const res = await fetch(`/api/events/${eventSlug}/attendee-profile?${params.toString()}`)
        const data = (await res.json()) as ProfileResponse

        if (!res.ok) {
          setError(data.error || "Unable to load attendee profile")
          lockRef.current = false
          return
        }

        if (!data.found) {
          setError("Ticket not found")
          lockRef.current = false
          return
        }

        setPendingCode(data.ticketCode || code)
        setProfile(data)
      } catch {
        setError("Connection error while loading profile")
        lockRef.current = false
      } finally {
        setLoadingProfile(false)
      }
    },
    [accessToken, eventSlug]
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
    if (inputMode !== "camera" || profile) {
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
          if (!videoRef.current || !canvasRef.current || lockRef.current || profile) {
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
            void loadProfile(decoded.data)
          }

          frameRef.current = requestAnimationFrame(tick)
        }

        frameRef.current = requestAnimationFrame(tick)
      } catch {
        setError("Camera not available. Use upload/manual")
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [inputMode, loadProfile, profile])

  const onUpload = async (file: File | null) => {
    if (!file) return
    const decoded = await decodeQrFromImageFile(file)
    if (!decoded) {
      setError("Could not detect QR in uploaded image")
      return
    }
    await loadProfile(decoded)
  }

  const markAttended = async () => {
    if (!pendingCode) return
    setSaving(true)
    setError("")

    try {
      const res = await fetch(`/api/events/${eventSlug}/attendee-profile/mark-attended`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accessToken, ticketCode: pendingCode, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || "Unable to mark attendee")
        return
      }

      setHistory((prev) => [
        {
          time: new Date().toISOString(),
          ticketCode: pendingCode,
          attendee: profile?.attendee?.name || "Attendee",
          action: "mark_attended",
        },
        ...prev,
      ])
      onVerified?.()
      resetForNext()
    } catch {
      setError("Connection error while marking attendance")
    } finally {
      setSaving(false)
    }
  }

  const skipAttendee = () => {
    if (!pendingCode) return
    setHistory((prev) => [
      {
        time: new Date().toISOString(),
        ticketCode: pendingCode,
        attendee: profile?.attendee?.name || "Attendee",
        action: "skipped",
      },
      ...prev,
    ])
    resetForNext()
  }

  const exportHistory = () => {
    if (history.length === 0) return

    const rows = [
      ["Time", "Ticket Code", "Attendee", "Action"],
      ...history.map((item) => [
        new Date(item.time).toLocaleString(),
        item.ticketCode,
        item.attendee,
        item.action,
      ]),
    ]

    downloadCsv(`deep-scan-history-${eventSlug}.csv`, rows)
  }

  const statusBadge = (status: string, alreadyScanned?: boolean) => {
    if (alreadyScanned) {
      return (
        <span className="text-xs bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30 px-2 py-0.5 rounded-full">
          ALREADY SCANNED
        </span>
      )
    }

    if (status.toLowerCase() === "confirmed") {
      return (
        <span className="text-xs bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 px-2 py-0.5 rounded-full">
          CONFIRMED
        </span>
      )
    }

    if (status.toLowerCase().includes("waitlist")) {
      return (
        <span className="text-xs bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 px-2 py-0.5 rounded-full">
          WAITLISTED
        </span>
      )
    }

    return (
      <span
        className="text-xs border px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: scannerSurfaceAlt,
          color: scannerTextSecondary,
          borderColor: scannerBorderSoft,
        }}
      >
        {status.toUpperCase()}
      </span>
    )
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border"
      style={{ borderColor: scannerBorder, backgroundColor: scannerSurfaceAlt }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: scannerBorder }}>
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="px-3 py-1.5 rounded-full text-xs border"
            style={{
              backgroundColor: scannerSurface,
              borderColor: scannerBorderSoft,
              color: scannerTextPrimary,
            }}
          >
            Exit
          </button>
          <span className="px-3 py-1.5 rounded-full bg-[#3B82F6] text-white text-xs font-semibold">DEEP SCAN</span>
        </div>
        <button
          onClick={exportHistory}
          disabled={history.length === 0}
          className="px-3 py-1.5 rounded-full text-xs border disabled:opacity-40"
          style={{ borderColor: scannerBorderSoft, color: scannerTextSecondary }}
        >
          Export history
        </button>
      </div>

      <div className="grid md:grid-cols-[1.2fr_1fr] gap-0">
        <div className="relative min-h-[68vh] border-r" style={{ borderColor: scannerBorder }}>
          <div className="absolute z-10 top-3 right-3 flex gap-2">
            {(["camera", "upload", "manual"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setInputMode(mode)
                  setError("")
                }}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  inputMode === mode ? "bg-[#C8F55A] text-black border-[#C8F55A]" : ""
                }`}
                style={
                  inputMode === mode
                    ? undefined
                    : {
                        backgroundColor: scannerSurface,
                        color: scannerTextSecondary,
                        borderColor: scannerBorderSoft,
                      }
                }
              >
                {mode === "camera" ? "Scan" : mode === "upload" ? "Upload" : "Manual"}
              </button>
            ))}
          </div>

          {inputMode === "camera" && !profile && (
            <>
              <video ref={videoRef} className="w-full h-full min-h-[68vh] object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-[#60A5FA] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]" />
                <p
                  className="absolute bottom-10 text-xs"
                  style={{ color: "#f8fafc", textShadow: "0 2px 12px rgba(0,0,0,0.55)" }}
                >
                  {cameraReady ? "Scan ticket QR" : "Starting camera..."}
                </p>
              </div>
            </>
          )}

          {inputMode === "upload" && !profile && (
            <div className="h-full min-h-[68vh] flex items-center justify-center p-8">
              <label
                className="w-full max-w-md border border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: scannerBorderSoft,
                  backgroundColor: scannerSurface,
                  color: scannerTextSecondary,
                }}
              >
                <p className="text-sm mb-2">Upload ticket image</p>
                <p className="text-xs mb-4" style={{ color: scannerTextMuted }}>
                  PNG / JPG with visible QR code
                </p>
                <input
                  type="file"
                  accept="image/*"
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

          {inputMode === "manual" && !profile && (
            <div className="h-full min-h-[68vh] flex items-center justify-center p-6">
              <div
                className="w-full max-w-md border rounded-2xl p-5 space-y-3"
                style={{ borderColor: scannerBorder, backgroundColor: scannerSurface }}
              >
                <p className="text-sm" style={{ color: scannerTextPrimary }}>Manual lookup</p>
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
                  onClick={() => void loadProfile(manualCode)}
                  disabled={!manualCode.trim()}
                  className="bg-[#C8F55A] text-black font-bold px-6 py-3 rounded-xl hover:bg-[#b8e040] transition-colors w-full text-sm disabled:opacity-50"
                >
                  Load by ticket code
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
                  onClick={() => void loadProfile(manualIdentity)}
                  disabled={!manualIdentity.trim()}
                  className="w-full border text-sm rounded-xl py-3 disabled:opacity-50"
                  style={{
                    backgroundColor: scannerSurface,
                    borderColor: scannerBorderSoft,
                    color: scannerTextSecondary,
                  }}
                >
                  Load by email/name
                </button>
              </div>
            </div>
          )}

          {(loadingProfile || error) && !profile && (
            <div className="absolute inset-x-0 bottom-0 p-3">
              {loadingProfile && <p className="text-xs text-[#60A5FA]">Loading attendee profile...</p>}
              {error && <p className="text-xs text-[#F87171]">{error}</p>}
            </div>
          )}
        </div>

        <div className="min-h-[68vh] p-4" style={{ backgroundColor: scannerSurface }}>
          {!profile && (
            <div className="h-full flex flex-col justify-center text-center">
              <p className="text-sm font-semibold" style={{ color: scannerTextPrimary }}>Awaiting scan</p>
              <p className="text-xs mt-1" style={{ color: scannerTextMuted }}>
                Scan, upload, or enter ticket code/email/name
              </p>
              {error && <p className="text-[#F87171] text-xs mt-3">{error}</p>}
            </div>
          )}

          {profile && profile.attendee && (
            <div className="space-y-4">
              <div>
                <p className="text-2xl font-semibold" style={{ color: scannerTextPrimary }}>
                  {profile.attendee.name || "Attendee"}
                </p>
                <p className="text-sm" style={{ color: scannerTextSecondary }}>
                  {profile.attendee.email || "No email"}
                </p>
                <div className="mt-2">{statusBadge(profile.attendee.status, profile.alreadyScanned)}</div>
              </div>

              <div className="text-xs space-y-1" style={{ color: scannerTextSecondary }}>
                <p>Ticket: {profile.ticketCode || pendingCode}</p>
                <p>Registered: {new Date(profile.attendee.registrationDate).toLocaleString()}</p>
                {profile.scannedAt && <p>Scanned: {new Date(profile.scannedAt).toLocaleString()}</p>}
              </div>

              {profile.attendee.customAnswers.length > 0 && (
                <div className="border rounded-xl p-3" style={{ borderColor: scannerBorder }}>
                  <p className="text-xs uppercase tracking-wide mb-2" style={{ color: scannerTextSecondary }}>
                    Custom answers
                  </p>
                  <div className="space-y-1.5">
                    {profile.attendee.customAnswers.map((item, idx) => (
                      <div key={`${item.question}-${idx}`} className="text-xs" style={{ color: scannerTextSecondary }}>
                        <span style={{ color: scannerTextMuted }}>{item.question}: </span>
                        <span>{item.answer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border rounded-xl p-3" style={{ borderColor: scannerBorder }}>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: scannerTextSecondary }}>
                  Previous notes
                </p>
                {profile.attendee.notes.length === 0 ? (
                  <p className="text-xs" style={{ color: scannerTextMuted }}>No notes yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {profile.attendee.notes.map((item, idx) => (
                      <p key={`${item.createdAt}-${idx}`} className="text-xs" style={{ color: scannerTextSecondary }}>
                        {item.content}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add note (optional)"
                rows={3}
                className="border rounded-xl px-4 py-3 placeholder:text-[#6b7280] focus:outline-none focus:border-[#C8F55A] transition-colors w-full text-sm"
                style={{
                  backgroundColor: scannerSurfaceAlt,
                  borderColor: scannerBorderSoft,
                  color: scannerTextPrimary,
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => void markAttended()}
                  disabled={saving}
                  className="flex-1 bg-[#C8F55A] text-black text-sm font-bold rounded-xl py-3 hover:bg-[#b8e040] transition-colors disabled:opacity-50"
                >
                  Mark attended
                </button>
                <button
                  onClick={skipAttendee}
                  disabled={saving}
                  className="flex-1 border text-sm rounded-xl py-3 disabled:opacity-50"
                  style={{
                    backgroundColor: scannerSurface,
                    borderColor: scannerBorderSoft,
                    color: scannerTextSecondary,
                  }}
                >
                  Skip
                </button>
              </div>

              <button
                onClick={resetForNext}
                className="w-full text-xs border rounded-lg py-2"
                style={{ color: "#60A5FA", borderColor: "rgba(96,165,250,0.35)" }}
              >
                Next attendee
              </button>
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-5 border-t pt-4" style={{ borderColor: scannerBorder }}>
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: scannerTextSecondary }}>
                Session history
              </p>
              <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
                {history.slice(0, 12).map((item, idx) => (
                  <div
                    key={`${item.ticketCode}-${idx}`}
                    className="text-xs flex items-center justify-between gap-2"
                    style={{ color: scannerTextSecondary }}
                  >
                    <span className="truncate">{item.attendee}</span>
                    <span className={item.action === "mark_attended" ? "text-[#86EFAC]" : "text-[#93C5FD]"}>
                      {item.action === "mark_attended" ? "MARKED" : "SKIPPED"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
