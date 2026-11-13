import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { MarketingFooter } from "@/components/MarketingFooter"
import { ApplicationConfirmationView } from "@/components/careers/ApplicationConfirmationView"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Application Received — EventSlot Careers",
  description: "Your application has been received. Save your reference code to track status.",
}

export default function ApplicationConfirmationPage() {
  return (
    <main className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A]">
      {/* Top Breadcrumb Nav */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="marketing-shell px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#15803D] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Careers Portal</span>
          </Link>
        </div>
      </div>

      <div className="marketing-shell px-4 py-12 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="py-20 text-center text-sm text-[#64748B]">
              Loading application confirmation...
            </div>
          }
        >
          <ApplicationConfirmationView />
        </Suspense>
      </div>

      <MarketingFooter />
    </main>
  )
}
