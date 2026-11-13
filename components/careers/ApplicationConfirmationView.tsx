"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  CheckCircle2,
  Copy,
  Check,
  Search,
  ArrowRight,
  ShieldCheck,
  Clock,
  Briefcase,
  AlertTriangle,
} from "lucide-react"

export function ApplicationConfirmationView() {
  const searchParams = useSearchParams()
  const referenceCode = searchParams.get("code") || "ES-CARE-XXXXXXXX"
  const roleTitle = searchParams.get("role") || "EventSlot Opportunity"
  const submittedAt = searchParams.get("date")

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referenceCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="mx-auto max-w-2xl text-center">
      {/* Success Badge */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D] ring-8 ring-[#DCFCE7]/40 mb-6">
        <CheckCircle2 className="h-9 w-9" />
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-semibold text-[#15803D] mb-4 shadow-sm">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Application Verified & Securely Stored</span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl font-serif">
        Application Submitted!
      </h1>

      <p className="mt-3 text-base text-[#4B5563]">
        Thank you for applying for the{" "}
        <span className="font-bold text-[#0A0A0A]">{roleTitle}</span> role at EventSlot.
        Your application has been delivered to the hiring team.
      </p>

      {/* Reference Code Card */}
      <div className="mt-8 rounded-2xl border-2 border-[#C8F55A] bg-[#0A0A0A] p-6 sm:p-8 text-left text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-[#C8F55A]/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8F55A]">
              Your Unique Application Reference
            </span>
            <div className="mt-1 font-mono text-2xl sm:text-3xl font-bold tracking-wider text-white">
              {referenceCode}
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Required along with your email to check review milestones.
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C8F55A] px-5 py-2.5 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition active:scale-95 shadow"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-[#0A0A0A]" />
                <span>Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-[#0A0A0A]" />
                <span>Copy Reference Code</span>
              </>
            )}
          </button>
        </div>

        {submittedAt && (
          <div className="mt-6 pt-4 border-t border-[#262626] flex items-center gap-2 text-xs text-[#9CA3AF]">
            <Clock className="h-3.5 w-3.5 text-[#C8F55A]" />
            <span>Recorded at: {new Date(submittedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })} EAT</span>
          </div>
        )}
      </div>

      {/* Security & Human Review Guarantee */}
      <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-5 text-left text-xs text-[#4B5563] shadow-sm flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-[#15803D] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[#0A0A0A] block text-sm mb-1">
            EventSlot Human Review Guarantee
          </span>
          All applications undergo genuine, manual evaluation by our team. We do not use automated screening algorithms, keyword scrapers, or AI bots to reject applicants. Every submission is given fair consideration.
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href={`/careers/track?ref=${encodeURIComponent(referenceCode)}`}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-6 py-3 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-md"
        >
          <Search className="h-4 w-4" />
          <span>Track Application Status</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/careers"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-[#D1D5DB] bg-white px-6 py-3 text-xs font-semibold text-[#374151] hover:border-[#15803D] transition shadow-sm"
        >
          <Briefcase className="h-4 w-4" />
          <span>Browse More Roles</span>
        </Link>
      </div>
    </div>
  )
}
