"use client"

import { useState, useEffect } from "react"
import {
  ShieldAlert,
  Clock,
  RefreshCw,
  Search,
  Filter,
  User,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileText,
} from "lucide-react"

interface AuditLogEntry {
  id: string
  action: string
  targetType: string
  targetId: string
  actorEmail: string | null
  details: string | null
  ipAddress: string | null
  createdAt: string
  vacancy?: {
    id: string
    title: string
  } | null
}

export function RecruitmentAuditTrail() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedAction, setSelectedAction] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadAuditLogs = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (selectedAction) params.append("action", selectedAction)
      params.append("page", page.toString())
      params.append("limit", "25")

      const res = await fetch(`/api/admin/recruitment/audit?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to load audit logs")

      setLogs(data.logs || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalCount(data.pagination?.total || 0)
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to retrieve logs")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAuditLogs()
  }, [page, selectedAction])

  const formatNairobi = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-KE", {
        timeZone: "Africa/Nairobi",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-xs text-[#6B7280]">
          Showing <span className="font-bold text-[#0A0A0A]">{logs.length}</span> of{" "}
          <span className="font-bold text-[#0A0A0A]">{totalCount}</span> audit entries
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value)
              setPage(1)
            }}
            className="rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs text-[#374151] focus:border-[#15803D] focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="VACANCY_CREATED">Vacancy Created</option>
            <option value="VACANCY_UPDATED">Vacancy Updated</option>
            <option value="APPLICATION_STATUS_UPDATED">Status Updated</option>
            <option value="INTERNAL_NOTE_ADDED">Note Added</option>
            <option value="DOCUMENT_ACCESSED">Document Streamed</option>
            <option value="APPLICATIONS_CSV_EXPORTED">CSV Exported</option>
            <option value="REVIEWER_ASSIGNED">Reviewer Assigned</option>
            <option value="REVIEWER_REVOKED">Reviewer Revoked</option>
            <option value="REVIEWER_EXTENDED">Reviewer Extended</option>
          </select>

          <button
            onClick={() => loadAuditLogs()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-xs overflow-hidden">
        {logs.length === 0 && !isLoading ? (
          <div className="p-12 text-center text-xs text-[#6B7280]">
            No audit records found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#374151]">
              <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                <tr>
                  <th className="px-5 py-3.5">Timestamp (Nairobi)</th>
                  <th className="px-5 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Target</th>
                  <th className="px-5 py-3.5">Details</th>
                  <th className="px-5 py-3.5">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F9FAFB] transition">
                    <td className="px-5 py-3.5 text-[#6B7280] whitespace-nowrap">
                      {formatNairobi(log.createdAt)}
                    </td>

                    <td className="px-5 py-3.5 font-medium text-[#0A0A0A]">
                      {log.actorEmail || "System"}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[11px] font-bold text-[#15803D]">
                        {log.action}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-[#6B7280]">
                      <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold text-[#374151]">
                        {log.targetType}
                      </span>
                      {log.vacancy && (
                        <div className="text-[11px] text-[#0A0A0A] font-medium mt-0.5">
                          {log.vacancy.title}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-[#374151] max-w-md truncate">
                      {log.details || "—"}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#9CA3AF]">
                      {log.ipAddress || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-[#F3F4F6] flex items-center justify-between text-xs text-[#6B7280]">
            <div>
              Page <span className="font-semibold text-[#0A0A0A]">{page}</span> of{" "}
              <span className="font-semibold text-[#0A0A0A]">{totalPages}</span>
            </div>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1 font-semibold text-[#374151] disabled:opacity-40 hover:bg-[#F9FAFB]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1 font-semibold text-[#374151] disabled:opacity-40 hover:bg-[#F9FAFB]"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
