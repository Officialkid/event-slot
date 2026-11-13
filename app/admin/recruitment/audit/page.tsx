import type { Metadata } from "next"
import { RecruitmentAuditTrail } from "@/components/recruitment/RecruitmentAuditTrail"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Recruitment Audit Trail — EventSlot Admin",
  description: "Cryptographic activity log and operational recruitment audit trail.",
}

export default function AdminAuditPage() {
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
            Recruitment Audit Trail
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
            Full chronological audit log of administrative actions, reviewer assignments, document access, and stage transitions.
          </p>
        </div>
      </div>

      <RecruitmentAuditTrail />
    </div>
  )
}
