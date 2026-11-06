import { Suspense } from "react"
import type { Metadata } from "next"
import { InvitationAcceptanceView } from "@/components/recruitment/InvitationAcceptanceView"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Accept Recruitment Reviewer Invitation — EventSlot",
  description: "Accept temporary reviewer assignment for EventSlot recruitment.",
}

export default function InviteAcceptPage() {
  return (
    <main className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A] flex flex-col justify-between">
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="marketing-shell px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#15803D] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>EventSlot Careers</span>
          </Link>
        </div>
      </div>

      <div className="marketing-shell px-4 py-12 sm:px-6 lg:px-8 flex-1 flex items-center justify-center">
        <Suspense
          fallback={
            <div className="py-20 text-center text-xs text-[#6B7280]">
              Loading invitation details...
            </div>
          }
        >
          <InvitationAcceptanceView />
        </Suspense>
      </div>

      <div className="py-6 text-center text-xs text-[#9CA3AF] border-t border-[#E5E7EB] bg-white">
        © EventSlot 2026. Recruitment Operations.
      </div>
    </main>
  )
}
