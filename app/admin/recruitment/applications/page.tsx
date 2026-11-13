import type { Metadata } from "next"
import { ApplicationsInboxTable } from "@/components/recruitment/ApplicationsInboxTable"
import { Users2, ArrowLeft } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Candidate Applications — EventSlot Admin",
  description: "Review and evaluate received recruitment applications.",
}

export default function AdminApplicationsPage() {
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
            Candidate Applications
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
            All submitted candidate dossiers. Evaluate profiles, stream private documents, record internal notes, and manage stages.
          </p>
        </div>
      </div>

      <ApplicationsInboxTable />
    </div>
  )
}
