"use client"

import { useState } from "react"
import { Camera, FileUp, Search } from "lucide-react"
import { ManualTicketVerifier } from "@/components/scanner/ManualTicketVerifier"
import { QuickScan } from "@/components/scanner/QuickScan"

type Mode = null | "scan" | "upload" | "manual"

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
        onVerified={onVerified}
        initialInputMode="camera"
        title="VERIFY TICKET"
      />
    )
  }

  if (mode === "upload") {
    return (
      <QuickScan
        eventSlug={eventSlug}
        accessToken={accessToken}
        onExit={() => setMode(null)}
        onVerified={onVerified}
        initialInputMode="upload"
        title="UPLOAD SOFTCOPY"
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
        className="min-h-[70vh] border rounded-2xl flex flex-col items-center justify-center p-6"
        style={{ backgroundColor: scannerSurfaceAlt, borderColor: scannerBorder }}
      >
        <div className="w-full max-w-4xl grid md:grid-cols-3 gap-4">
          <button
            onClick={() => requestCameraAccess("scan")}
            className="w-full border rounded-2xl p-5 text-left transition-colors group"
            style={{ borderColor: scannerBorderSoft, backgroundColor: scannerSurface }}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 flex items-center justify-center shrink-0 group-hover:bg-[#C8F55A]/20 transition-colors">
                <Camera className="w-5 h-5 text-[#C8F55A]" />
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: scannerTextPrimary }}>Scan QR Code</p>
                <p className="text-sm leading-relaxed" style={{ color: scannerTextSecondary }}>
                  Use the camera to scan a physical ticket QR code and verify it instantly.
                </p>
                <p className="text-[#C8F55A] text-xs mt-2">Best for gate check-in</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode("upload")}
            className="w-full border rounded-2xl p-5 text-left transition-colors group"
            style={{ borderColor: scannerBorderSoft, backgroundColor: scannerSurface }}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center shrink-0 group-hover:bg-[#3B82F6]/20 transition-colors">
                <FileUp className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: scannerTextPrimary }}>Upload Softcopy</p>
                <p className="text-sm leading-relaxed" style={{ color: scannerTextSecondary }}>
                  Upload a ticket image or EventSlot PDF and let the system read the ticket for you.
                </p>
                <p className="text-[#60A5FA] text-xs mt-2">Works with image files and EventSlot PDFs</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode("manual")}
            className="w-full border rounded-2xl p-5 text-left transition-colors group"
            style={{ borderColor: scannerBorderSoft, backgroundColor: scannerSurface }}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center shrink-0 group-hover:bg-[#F59E0B]/20 transition-colors">
                <Search className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: scannerTextPrimary }}>Enter Details</p>
                <p className="text-sm leading-relaxed" style={{ color: scannerTextSecondary }}>
                  Search by attendee name, email, ticket number, or confirmation code, then verify or unverify manually.
                </p>
                <p className="text-[#FCD34D] text-xs mt-2">Best for exceptions and follow-up questions</p>
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
