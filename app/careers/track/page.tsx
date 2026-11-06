import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { MarketingFooter } from "@/components/MarketingFooter"
import { CandidateTracker } from "@/components/careers/CandidateTracker"
import { ArrowLeft, Search, ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Track Application Status — EventSlot Careers",
  description:
    "Check the real-time review status of your EventSlot job application using your reference code.",
}

export default function TrackApplicationPage() {
  return (
    <main className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A]">
      {/* Top Breadcrumb Nav */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="marketing-shell px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#15803D] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Careers Portal</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 text-xs text-[#64748B]">
            <ShieldCheck className="h-4 w-4 text-[#15803D]" />
            <span>Zero-AI Human Evaluation</span>
          </div>
        </div>
      </div>

      {/* Header Banner */}
      <header className="border-b border-[#E5E7EB] bg-white py-10 sm:py-14 text-center">
        <div className="marketing-shell px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D] mb-4">
            <Search className="h-6 w-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0A0A0A] font-serif">
            Track Application Status
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#64748B] max-w-lg mx-auto">
            Check the real-time status of your submission. Enter your 8-character reference code and registered email below.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="marketing-shell px-4 py-10 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="py-20 text-center text-sm text-[#64748B]">
              Loading application tracking system...
            </div>
          }
        >
          <CandidateTracker />
        </Suspense>
      </div>

      <MarketingFooter />
    </main>
  )
}
