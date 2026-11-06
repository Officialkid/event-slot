"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  User,
  ArrowRight,
  RefreshCw,
  Lock,
} from "lucide-react"

export function InvitationAcceptanceView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") || ""

  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [data, setData] = useState<any | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setErrorMessage("No invitation token provided. Please verify the invitation link.")
      setIsLoading(false)
      return
    }

    async function verifyToken() {
      try {
        const res = await fetch(`/api/admin/recruitment/invite/accept?token=${encodeURIComponent(token)}`)
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error || "Invalid invitation")
        }

        setData(json)
      } catch (err: any) {
        setErrorMessage(err.message || "Unable to verify invitation link.")
      } finally {
        setIsLoading(false)
      }
    }

    verifyToken()
  }, [token])

  const handleAccept = async () => {
    setIsAccepting(true)
    setErrorMessage(null)

    try {
      const res = await fetch("/api/admin/recruitment/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to accept invitation")
      }

      setSuccessMessage(json.message || "Invitation accepted!")
      setTimeout(() => {
        router.push(json.redirectUrl || "/admin/recruitment")
      }, 1200)
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.")
      setIsAccepting(false)
    }
  }

  const formatNairobi = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-KE", {
        timeZone: "Africa/Nairobi",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#15803D]" />
        <p className="mt-3 text-xs text-[#6B7280]">Verifying invitation link...</p>
      </div>
    )
  }

  if (errorMessage || !data) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-[#0A0A0A]">Invitation Unavailable</h2>
        <p className="mt-2 text-xs text-[#6B7280] leading-relaxed">{errorMessage}</p>
        <div className="mt-6">
          <Link
            href="/careers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D] hover:underline"
          >
            <span>Return to EventSlot Careers</span>
          </Link>
        </div>
      </div>
    )
  }

  const isUserLoggedIn = !!data.currentUser
  const isEmailMatch = isUserLoggedIn && data.currentUser.email?.toLowerCase() === data.email.toLowerCase()

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        {/* Header Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D] mb-5 ring-8 ring-[#DCFCE7]/40">
          <ShieldCheck className="h-7 w-7" />
        </div>

        <div className="text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#15803D]">
            Recruitment Team Invitation
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0A0A0A] font-serif">
            Join Review Panel
          </h1>
          <p className="mt-2 text-xs text-[#6B7280]">
            You have been invited by <strong className="text-[#0A0A0A]">{data.invitedBy}</strong> to evaluate candidate applications for EventSlot.
          </p>
        </div>

        {/* Invitation Metadata Card */}
        <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[#6B7280]">Assigned Role:</span>
            <span className="font-bold text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">
              {data.role}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#6B7280]">Vacancy Scope:</span>
            <span className="font-semibold text-[#0A0A0A]">
              {data.vacancy ? data.vacancy.title : "All Open Vacancies"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#6B7280]">Invited Email:</span>
            <span className="font-mono text-[#0A0A0A]">{data.email}</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#E5E7EB]/60">
            <span className="text-[#6B7280]">Access Validity:</span>
            <span className="inline-flex items-center gap-1 text-[#15803D] font-medium">
              <Clock className="h-3 w-3" />
              Until {formatNairobi(data.expiresAt)} EAT
            </span>
          </div>
        </div>

        {/* State A: User Not Logged In */}
        {!isUserLoggedIn && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-800">
              <p className="font-semibold mb-1">EventSlot Account Required</p>
              Please sign in or create an account with <strong>{data.email}</strong> to activate your reviewer access.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/signin?callbackUrl=${encodeURIComponent(
                  `/admin/recruitment/invite/accept?token=${token}`
                )}`}
                className="inline-flex items-center justify-center rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-xs"
              >
                Sign In
              </Link>
              <Link
                href={`/signup?callbackUrl=${encodeURIComponent(
                  `/admin/recruitment/invite/accept?token=${token}`
                )}`}
                className="inline-flex items-center justify-center rounded-xl border border-[#D1D5DB] bg-white px-4 py-2.5 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] transition shadow-xs"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}

        {/* State B: User Logged In */}
        {isUserLoggedIn && (
          <div className="mt-6 space-y-4">
            {!isEmailMatch && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-800">
                You are currently signed in as <strong>{data.currentUser.email}</strong>. Accepting this invite will attach reviewer privileges to this account.
              </div>
            )}

            {successMessage ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-6 py-3.5 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-md disabled:opacity-50"
              >
                {isAccepting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-[#C8F55A]" />
                    <span>Activating Workspace...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 text-[#C8F55A]" />
                    <span>Accept Reviewer Assignment</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-[#F3F4F6] text-center text-[11px] text-[#9CA3AF]">
          Reviewer access is time-bounded, private, and strictly restricted to recruitment tasks.
        </div>
      </div>
    </div>
  )
}
