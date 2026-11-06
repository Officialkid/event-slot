"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Search,
  CheckCircle2,
  Clock,
  Briefcase,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  User,
  HelpCircle,
  FileText,
  Building,
} from "lucide-react"
import {
  type PublicTrackingResponse,
  type ApplicationStatusValue,
  OPPORTUNITY_TYPES,
} from "@/lib/recruitment/types"

const STATUS_PROGRESS_ORDER: ApplicationStatusValue[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "ASSESSMENT_INTERVIEW",
  "REFERENCE_CHECKS",
  "OFFER_MADE",
  "HIRED",
]

export function CandidateTracker() {
  const searchParams = useSearchParams()
  const initialRef = searchParams.get("ref") || ""

  const [referenceCode, setReferenceCode] = useState(initialRef)
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<PublicTrackingResponse | null>(null)
  const [copied, setCopied] = useState(false)

  // Auto-focus or preset
  useEffect(() => {
    if (initialRef) {
      setReferenceCode(initialRef)
    }
  }, [initialRef])

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!referenceCode.trim() || !email.trim()) {
      setErrorMessage("Please enter both your reference code and email address.")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const res = await fetch("/api/careers/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceCode: referenceCode.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Application not found.")
      }

      setResult(data)
    } catch (err: any) {
      setResult(null)
      setErrorMessage(err.message || "Failed to retrieve status.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.referenceCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // noop
    }
  }

  const getStatusBadge = (status: ApplicationStatusValue) => {
    switch (status) {
      case "SUBMITTED":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          dot: "bg-blue-500",
        }
      case "UNDER_REVIEW":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          dot: "bg-amber-500",
        }
      case "SHORTLISTED":
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          dot: "bg-purple-500",
        }
      case "ASSESSMENT_INTERVIEW":
        return {
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
          dot: "bg-indigo-500",
        }
      case "REFERENCE_CHECKS":
        return {
          bg: "bg-sky-50 text-sky-700 border-sky-200",
          dot: "bg-sky-500",
        }
      case "OFFER_MADE":
        return {
          bg: "bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]",
          dot: "bg-[#15803D]",
        }
      case "HIRED":
        return {
          bg: "bg-[#0A0A0A] text-[#C8F55A] border-[#C8F55A]",
          dot: "bg-[#C8F55A]",
        }
      case "NOT_SELECTED":
        return {
          bg: "bg-gray-100 text-gray-700 border-gray-300",
          dot: "bg-gray-400",
        }
      case "WITHDRAWN":
        return {
          bg: "bg-zinc-100 text-zinc-600 border-zinc-200",
          dot: "bg-zinc-400",
        }
      default:
        return {
          bg: "bg-gray-50 text-gray-700 border-gray-200",
          dot: "bg-gray-400",
        }
    }
  }

  const typeLabel = result
    ? OPPORTUNITY_TYPES.find((t) => t.value === result.opportunityType)?.label ||
      result.opportunityType
    : ""

  const formatNairobi = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-KE", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Lookup Form Card */}
      {!result ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-[#0A0A0A] font-serif">
              Check Application Status
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
              Enter the unique reference code provided when you submitted your application, along with your registered email address.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs sm:text-sm text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1.5">
                Reference Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="ES-CARE-XXXXXXXX"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 font-mono text-sm tracking-wider text-[#0A0A0A] placeholder-[#9CA3AF] focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#6B7280]">
                8-character code sent to your confirmation screen (e.g. ES-CARE-9K4M7X2P).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-[#0A0A0A] placeholder-[#9CA3AF] focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
              />
              <p className="mt-1 text-[11px] text-[#6B7280]">
                Must match the exact email address used during application.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-md disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-[#C8F55A]" />
                  <span>Checking Status...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 text-[#C8F55A]" />
                  <span>Look Up Application</span>
                </>
              )}
            </button>
          </form>

          {/* Privacy & Zero-AI Guarantee */}
          <div className="mt-8 pt-6 border-t border-[#F3F4F6] flex items-start gap-3 text-xs text-[#6B7280]">
            <ShieldCheck className="h-4 w-4 text-[#15803D] shrink-0 mt-0.5" />
            <span>
              Candidate records are strictly confidential. We do not expose personal contact info or internal notes on this tracking page.
            </span>
          </div>
        </div>
      ) : (
        /* Results View */
        <div className="space-y-6">
          {/* Main Status Header Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-[#F3F4F6] pb-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  Applicant Record
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A] font-serif mt-0.5">
                  {result.candidateDisplayName}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#4B5563]">
                  <span className="font-semibold text-[#0A0A0A]">{result.positionTitle}</span>
                  <span>•</span>
                  <span className="rounded bg-[#F3F4F6] px-2 py-0.5 font-medium text-[#374151]">
                    {typeLabel}
                  </span>
                </div>
              </div>

              {/* Reference Code Tag */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                <span className="font-mono text-xs font-bold text-[#6B7280]">
                  {result.referenceCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 rounded-full border border-[#D1D5DB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#374151] hover:border-[#15803D] transition shadow-2xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-[#15803D]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-[#6B7280]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Current Status Banner */}
            <div className="mt-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Current Status
              </span>
              <div className="mt-2 flex items-center gap-3">
                {(() => {
                  const style = getStatusBadge(result.status)
                  return (
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold ${style.bg}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                      {result.statusLabel}
                    </span>
                  )
                })()}
                <span className="text-xs text-[#6B7280]">
                  Updated: {formatNairobi(result.lastStatusUpdateAt)} EAT
                </span>
              </div>

              {/* Stage Description */}
              <div className="mt-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] p-4 text-xs sm:text-sm text-[#374151] leading-relaxed">
                <p className="font-medium text-[#111827]">{result.statusDescription}</p>
                <div className="mt-2 pt-2 border-t border-[#E5E7EB]/60 flex items-center gap-2 text-xs text-[#6B7280]">
                  <Clock className="h-3.5 w-3.5 text-[#15803D]" />
                  <span>Submitted on: {formatNairobi(result.submittedAt)} EAT</span>
                </div>
              </div>
            </div>

            {/* Application Milestone Stepper */}
            <div className="mt-8 border-t border-[#F3F4F6] pt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-4">
                Recruitment Journey Progress
              </h3>

              {result.status === "NOT_SELECTED" ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
                  This application has concluded. Our team has reviewed your materials and decided not to proceed with an offer at this stage. We appreciate your interest in EventSlot and invite you to apply for future openings that match your skills.
                </div>
              ) : result.status === "WITHDRAWN" ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
                  This application has been marked as withdrawn.
                </div>
              ) : (
                <div className="relative">
                  {/* Stepper Bar */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {/* Step 1 */}
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#15803D] text-white text-xs font-bold shadow-sm">
                        <Check className="h-4 w-4" />
                      </div>
                      <span className="mt-2 text-[11px] font-bold text-[#0A0A0A]">
                        Received
                      </span>
                    </div>

                    {/* Step 2 */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                          result.status !== "SUBMITTED"
                            ? "bg-[#15803D] text-white"
                            : "bg-[#0A0A0A] text-[#C8F55A]"
                        }`}
                      >
                        {result.status !== "SUBMITTED" ? <Check className="h-4 w-4" /> : "2"}
                      </div>
                      <span
                        className={`mt-2 text-[11px] font-semibold ${
                          result.status !== "SUBMITTED" ? "text-[#0A0A0A]" : "text-[#15803D]"
                        }`}
                      >
                        Under Review
                      </span>
                    </div>

                    {/* Step 3 */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                          [
                            "ASSESSMENT_INTERVIEW",
                            "REFERENCE_CHECKS",
                            "OFFER_MADE",
                            "HIRED",
                          ].includes(result.status)
                            ? "bg-[#15803D] text-white"
                            : result.status === "SHORTLISTED"
                            ? "bg-[#0A0A0A] text-[#C8F55A]"
                            : "bg-[#E5E7EB] text-[#6B7280]"
                        }`}
                      >
                        {[
                          "ASSESSMENT_INTERVIEW",
                          "REFERENCE_CHECKS",
                          "OFFER_MADE",
                          "HIRED",
                        ].includes(result.status) ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          "3"
                        )}
                      </div>
                      <span
                        className={`mt-2 text-[11px] font-semibold ${
                          [
                            "SHORTLISTED",
                            "ASSESSMENT_INTERVIEW",
                            "REFERENCE_CHECKS",
                            "OFFER_MADE",
                            "HIRED",
                          ].includes(result.status)
                            ? "text-[#0A0A0A]"
                            : "text-[#9CA3AF]"
                        }`}
                      >
                        Interview / Eval
                      </span>
                    </div>

                    {/* Step 4 */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                          result.status === "HIRED"
                            ? "bg-[#0A0A0A] text-[#C8F55A] ring-2 ring-[#C8F55A]"
                            : result.status === "OFFER_MADE"
                            ? "bg-[#15803D] text-white"
                            : "bg-[#E5E7EB] text-[#6B7280]"
                        }`}
                      >
                        {result.status === "HIRED" ? <Check className="h-4 w-4" /> : "4"}
                      </div>
                      <span
                        className={`mt-2 text-[11px] font-semibold ${
                          ["OFFER_MADE", "HIRED"].includes(result.status)
                            ? "text-[#0A0A0A]"
                            : "text-[#9CA3AF]"
                        }`}
                      >
                        Final Decision
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={() => {
                setResult(null)
                setReferenceCode("")
                setEmail("")
              }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#0A0A0A] transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Check another application</span>
            </button>

            <Link
              href="/careers"
              className="inline-flex items-center gap-2 rounded-full border border-[#D1D5DB] bg-white px-5 py-2 text-xs font-semibold text-[#374151] hover:border-[#15803D] transition shadow-xs"
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Explore More Roles</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
