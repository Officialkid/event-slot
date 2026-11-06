"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  OPPORTUNITY_TYPES,
  VACANCY_STATUSES,
  type VacancyTypeValue,
  type VacancyStatusValue,
} from "@/lib/recruitment/types"
import { formatNairobiDeadline } from "@/components/careers/CareersDiscovery"
import {
  Search,
  Plus,
  Eye,
  Edit2,
  CheckCircle,
  XCircle,
  Archive,
  RefreshCw,
  Clock,
  Briefcase,
  AlertCircle,
} from "lucide-react"

export interface AdminVacancyItem {
  id: string
  title: string
  slug: string
  type: VacancyTypeValue
  department: string
  location: string
  workArrangement: string
  openingsCount: number
  status: VacancyStatusValue
  closesAt: string | null
  createdAt: string
  applicationsCount: number
}

interface VacanciesListTableProps {
  initialVacancies: AdminVacancyItem[]
  isGlobalAdmin: boolean
}

export function VacanciesListTable({
  initialVacancies,
  isGlobalAdmin,
}: VacanciesListTableProps) {
  const router = useRouter()
  const [vacancies, setVacancies] = useState<AdminVacancyItem[]>(initialVacancies)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const filteredVacancies = vacancies.filter((v) => {
    if (statusFilter !== "ALL" && v.status !== statusFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        v.title.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q) ||
        v.slug.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleUpdateStatus = async (vacancyId: string, newStatus: VacancyStatusValue) => {
    setActionLoading(vacancyId)
    setMessage(null)

    try {
      const res = await fetch(`/api/admin/recruitment/vacancies/${vacancyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status")
      }

      setVacancies((prev) =>
        prev.map((v) => (v.id === vacancyId ? { ...v, status: newStatus } : v))
      )
      setMessage({ text: `Vacancy status updated to ${newStatus}`, type: "success" })
      router.refresh()
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to update status", type: "error" })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vacancies by title or department..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none shadow-sm"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            {VACANCY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {isGlobalAdmin && (
          <Link
            href="/admin/recruitment/vacancies/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#C8F55A] px-5 py-2 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Vacancy</span>
          </Link>
        )}
      </div>

      {message && (
        <div
          className={`rounded-xl p-3 text-xs flex items-center gap-2 ${
            message.type === "success"
              ? "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
              : "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-[#16A34A]" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#F1F5F9] bg-[#F8FAFC] text-[0.7rem] uppercase font-bold text-[#64748B]">
              <tr>
                <th className="px-5 py-3.5">Vacancy / Role</th>
                <th className="px-4 py-3.5">Department</th>
                <th className="px-4 py-3.5">Type &amp; Work</th>
                <th className="px-4 py-3.5">Applications</th>
                <th className="px-4 py-3.5">Deadline (Nairobi)</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredVacancies.length > 0 ? (
                filteredVacancies.map((vacancy) => {
                  const typeLabel =
                    OPPORTUNITY_TYPES.find((t) => t.value === vacancy.type)?.label ||
                    vacancy.type

                  return (
                    <tr key={vacancy.id} className="hover:bg-[#FDFCFB] transition">
                      {/* Role Info */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-[#0A0A0A] text-sm">
                          {vacancy.title}
                        </div>
                        <div className="font-mono text-[0.68rem] text-[#94A3B8] mt-0.5">
                          /careers/{vacancy.slug}
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-4 text-[#475569] font-medium">
                        {vacancy.department}
                      </td>

                      {/* Type & Arrangement */}
                      <td className="px-4 py-4">
                        <span className="font-semibold text-[#0A0A0A]">
                          {typeLabel}
                        </span>
                        <div className="text-[0.68rem] text-[#64748B] capitalize">
                          {vacancy.workArrangement.toLowerCase()} · {vacancy.openingsCount} {vacancy.openingsCount === 1 ? "opening" : "openings"}
                        </div>
                      </td>

                      {/* Applications Count */}
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/recruitment/applications?vacancyId=${vacancy.id}`}
                          className="inline-flex items-center gap-1 font-mono font-bold text-[#15803D] hover:underline"
                        >
                          {vacancy.applicationsCount} received
                        </Link>
                      </td>

                      {/* Deadline */}
                      <td className="px-4 py-4 text-[#64748B]">
                        {vacancy.closesAt
                          ? formatNairobiDeadline(vacancy.closesAt)
                          : "Open until filled"}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider ${
                            vacancy.status === "PUBLISHED"
                              ? "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]"
                              : vacancy.status === "CLOSED"
                              ? "bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]"
                              : vacancy.status === "ARCHIVED"
                              ? "bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]"
                              : "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]"
                          }`}
                        >
                          {vacancy.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/careers/${vacancy.slug}`}
                            target="_blank"
                            title="Preview Public Page"
                            className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0A0A0A] transition"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {isGlobalAdmin && (
                            <>
                              <Link
                                href={`/admin/recruitment/vacancies/${vacancy.id}/edit`}
                                title="Edit Vacancy"
                                className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0A0A0A] transition"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Link>

                              {vacancy.status === "DRAFT" && (
                                <button
                                  type="button"
                                  disabled={actionLoading === vacancy.id}
                                  onClick={() => handleUpdateStatus(vacancy.id, "PUBLISHED")}
                                  className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-2 py-1 text-[0.68rem] font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition"
                                >
                                  Publish
                                </button>
                              )}

                              {vacancy.status === "PUBLISHED" && (
                                <button
                                  type="button"
                                  disabled={actionLoading === vacancy.id}
                                  onClick={() => handleUpdateStatus(vacancy.id, "CLOSED")}
                                  className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2 py-1 text-[0.68rem] font-semibold text-[#DC2626] hover:bg-[#FEE2E2] transition"
                                >
                                  Close
                                </button>
                              )}

                              {vacancy.status === "CLOSED" && (
                                <button
                                  type="button"
                                  disabled={actionLoading === vacancy.id}
                                  onClick={() => handleUpdateStatus(vacancy.id, "PUBLISHED")}
                                  className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-2 py-1 text-[0.68rem] font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition"
                                >
                                  Reopen
                                </button>
                              )}

                              {vacancy.status !== "ARCHIVED" && (
                                <button
                                  type="button"
                                  disabled={actionLoading === vacancy.id}
                                  onClick={() => handleUpdateStatus(vacancy.id, "ARCHIVED")}
                                  title="Archive Vacancy"
                                  className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#64748B] transition"
                                >
                                  <Archive className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[#64748B]">
                    No vacancies found matching the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
