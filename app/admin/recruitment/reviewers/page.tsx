import type { Metadata } from "next"
import { ReviewersManagement } from "@/components/recruitment/ReviewersManagement"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Temporary Reviewers — EventSlot Admin",
  description: "Manage scoped, time-bounded reviewer access for recruitment.",
}

export default function AdminReviewersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-1">
            <Link
              href="/admin/recruitment"
              className="inline-flex items-center gap-1 hover:text-[#15803D] transition"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Recruitment Hub</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A] font-serif">
            Temporary Reviewer Access
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
            Configure and govern scoped reviewer privileges. Enforce mandatory expiration dates and instant revocation.
          </p>
        </div>
      </div>

      <ReviewersManagement />
    </div>
  )
}
