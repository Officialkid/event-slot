"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Search,
  Filter,
  Download,
  Eye,
  FileText,
  Clock,
  User,
  Building,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  APPLICATION_STATUSES,
  type ApplicationStatusValue,
  OPPORTUNITY_TYPES,
} from "@/lib/recruitment/types"

interface VacancyOption {
  id: string
  title: string
  department: string
}

interface ApplicationListItem {
  id: string
  referenceCode: string
  fullName: string
  email: string
  phone: string
  location: string
  status: ApplicationStatusValue
  submittedAt?: string
  createdAt: string
  vacancy: {
    id: string
    title: string
    slug: string
    department: string
    type: string
  }
  documents: {
    id: string
    documentType?: string
    type?: string
    fileName?: string
    originalFilename?: string
    fileSize: number
  }[]
  _count: {
    notes?: number
    internalNotes?: number
  }
}

export function ApplicationsInboxTable() {
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [vacancies, setVacancies] = useState<VacancyOption[]>([])
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>("")
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [page, setPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch vacancies options for filtering
  useEffect(() => {
    async function loadVacancies() {
      try {
        const res = await fetch("/api/admin/recruitment/vacancies")
        if (res.ok) {
          const data = await res.json()
          setVacancies(data)
        }
      } catch {
        // noop
      }
    }
    loadVacancies()
  }, [])

  const fetchApplications = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (selectedVacancyId) params.append("vacancyId", selectedVacancyId)
      if (selectedStatus) params.append("status", selectedStatus)
      if (searchTerm.trim()) params.append("search", searchTerm.trim())
      params.append("page", page.toString())
      params.append("limit", "15")

      const res = await fetch(`/api/admin/recruitment/applications?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load candidate applications")
      }

      setApplications(data.applications || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalCount(data.pagination?.total || 0)
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to fetch applications")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [selectedVacancyId, selectedStatus, page])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchApplications()
  }

  const handleExportCsv = () => {
    const params = new URLSearchParams()
    if (selectedVacancyId) params.append("vacancyId", selectedVacancyId)
    if (selectedStatus) params.append("status", selectedStatus)
    window.open(`/api/admin/recruitment/applications/export?${params.toString()}`, "_blank")
  }

  const getStatusStyle = (status: ApplicationStatusValue) => {
    switch (status) {
      case "SUBMITTED":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "UNDER_REVIEW":
        return "bg-amber-50 text-amber-800 border-amber-200"
      case "SHORTLISTED":
        return "bg-purple-50 text-purple-700 border-purple-200"
      case "ASSESSMENT_INTERVIEW":
        return "bg-indigo-50 text-indigo-700 border-indigo-200"
      case "REFERENCE_CHECKS":
        return "bg-sky-50 text-sky-700 border-sky-200"
      case "OFFER_MADE":
        return "bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]"
      case "HIRED":
        return "bg-[#0A0A0A] text-[#C8F55A] border-[#C8F55A]"
      case "NOT_SELECTED":
        return "bg-gray-100 text-gray-700 border-gray-300"
      case "WITHDRAWN":
        return "bg-zinc-100 text-zinc-600 border-zinc-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
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

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search candidate name, email, or reference code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-[#D1D5DB] pl-10 pr-4 py-2 text-xs text-[#0A0A0A] placeholder-[#9CA3AF] focus:border-[#15803D] focus:outline-none focus:ring-1 focus:ring-[#15803D]"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#0A0A0A] px-4 py-2 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-xs"
          >
            Search
          </button>
        </form>

        {/* Filters & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Vacancy Filter */}
          <select
            value={selectedVacancyId}
            onChange={(e) => {
              setSelectedVacancyId(e.target.value)
              setPage(1)
            }}
            className="rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs text-[#374151] focus:border-[#15803D] focus:outline-none"
          >
            <option value="">All Vacancies</option>
            {vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title} ({v.department})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs text-[#374151] focus:border-[#15803D] focus:outline-none"
          >
            <option value="">All Statuses</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:border-[#15803D] transition shadow-2xs"
            title="Export filtered candidates to CSV"
          >
            <Download className="h-3.5 w-3.5 text-[#15803D]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Applications Table */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
            Applications Inbox ({totalCount} total)
          </div>
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#15803D]" />
              <span>Loading...</span>
            </div>
          )}
        </div>

        {applications.length === 0 && !isLoading ? (
          <div className="p-12 text-center text-xs text-[#6B7280]">
            No applications found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#374151]">
              <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                <tr>
                  <th className="px-5 py-3.5">Candidate</th>
                  <th className="px-5 py-3.5">Role & Dept</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Documents</th>
                  <th className="px-5 py-3.5">Notes</th>
                  <th className="px-5 py-3.5">Submitted (Nairobi)</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-[#F9FAFB] transition">
                    {/* Candidate */}
                    <td className="px-5 py-4">
                      <div className="font-bold text-[#0A0A0A]">{app.fullName}</div>
                      <div className="text-[#6B7280]">{app.email}</div>
                      <div className="font-mono text-[11px] text-[#9CA3AF] mt-0.5">
                        {app.referenceCode}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#0A0A0A]">
                        {app.vacancy?.title || "Role"}
                      </div>
                      <div className="text-[#6B7280]">{app.vacancy?.department}</div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${getStatusStyle(
                          app.status
                        )}`}
                      >
                        {APPLICATION_STATUSES.find((s) => s.value === app.status)?.label ||
                          app.status}
                      </span>
                    </td>

                    {/* Documents */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {app.documents?.map((doc) => (
                          <span
                            key={doc.id}
                            className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#4B5563]"
                          >
                            <FileText className="h-2.5 w-2.5 text-[#6B7280]" />
                            <span>{doc.documentType || doc.type}</span>
                          </span>
                        ))}
                        {(!app.documents || app.documents.length === 0) && (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </div>
                    </td>

                    {/* Notes count */}
                    <td className="px-5 py-4">
                      {(app._count?.notes ?? app._count?.internalNotes ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[#15803D] font-semibold">
                          <MessageSquare className="h-3 w-3" />
                          <span>{app._count?.notes ?? app._count?.internalNotes}</span>
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">0</span>
                      )}
                    </td>

                    {/* Submitted At */}
                    <td className="px-5 py-4 text-[#6B7280] whitespace-nowrap">
                      {formatNairobi(app.submittedAt || app.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/recruitment/applications/${app.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1 text-xs font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition shadow-2xs"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Review</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
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
                className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1 font-semibold text-[#374151] disabled:opacity-40 hover:bg-[#F9FAFB] transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1 font-semibold text-[#374151] disabled:opacity-40 hover:bg-[#F9FAFB] transition"
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
