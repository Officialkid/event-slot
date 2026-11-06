"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search, MapPin, Briefcase, Clock, ArrowRight, Building, CheckCircle2 } from "lucide-react"
import { OPPORTUNITY_TYPES, type VacancyTypeValue } from "@/lib/recruitment/types"

export interface VacancyListItem {
  id: string
  slug: string
  title: string
  type: VacancyTypeValue
  department: string
  location: string
  workArrangement: "REMOTE" | "HYBRID" | "ON_SITE"
  shortSummary: string
  closesAt: string | null
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED"
  isClosed: boolean
}

interface CareersDiscoveryProps {
  initialVacancies: VacancyListItem[]
}

export function formatNairobiDeadline(dateVal: string | Date | null): string {
  if (!dateVal) return "Open until filled"
  const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal
  if (isNaN(d.getTime())) return "Open until filled"

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d)
}

export function CareersDiscovery({ initialVacancies }: CareersDiscoveryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<string>("ALL")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL")

  const departments = useMemo(() => {
    const set = new Set<string>()
    initialVacancies.forEach((v) => {
      if (v.department) set.add(v.department)
    })
    return Array.from(set).sort()
  }, [initialVacancies])

  const filteredVacancies = useMemo(() => {
    return initialVacancies.filter((v) => {
      // Type filter
      if (selectedType !== "ALL" && v.type !== selectedType) {
        return false
      }
      // Department filter
      if (selectedDepartment !== "ALL" && v.department !== selectedDepartment) {
        return false
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = v.title.toLowerCase().includes(q)
        const matchesDept = v.department.toLowerCase().includes(q)
        const matchesSummary = v.shortSummary.toLowerCase().includes(q)
        const matchesLocation = v.location.toLowerCase().includes(q)
        return matchesTitle || matchesDept || matchesSummary || matchesLocation
      }
      return true
    })
  }, [initialVacancies, selectedType, selectedDepartment, searchQuery])

  const openCount = initialVacancies.filter((v) => !v.isClosed).length

  return (
    <div className="space-y-10">
      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-6 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-12">
          {/* Text Search Input */}
          <div className="sm:col-span-8 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role title, department, or keyword..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#D1D5DB] bg-[#F8FAFC] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:border-[#15803D] focus:bg-white focus:outline-none transition"
            />
          </div>

          {/* Department Dropdown */}
          <div className="sm:col-span-4">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-[#F8FAFC] text-sm text-[#0F172A] focus:border-[#15803D] focus:bg-white focus:outline-none transition"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Opportunity Type Pills */}
        <div className="pt-2 border-t border-[#F1F5F9] flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedType("ALL")}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedType === "ALL"
                ? "bg-[#0A0A0A] text-[#C8F55A] shadow-sm"
                : "border border-[#E2E8F0] bg-white text-[#475569] hover:border-[#15803D] hover:text-[#0A0A0A]"
            }`}
          >
            All Roles ({initialVacancies.length})
          </button>
          {OPPORTUNITY_TYPES.map((t) => {
            const count = initialVacancies.filter((v) => v.type === t.value).length
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setSelectedType(t.value)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedType === t.value
                    ? "bg-[#0A0A0A] text-[#C8F55A] shadow-sm"
                    : "border border-[#E2E8F0] bg-white text-[#475569] hover:border-[#15803D] hover:text-[#0A0A0A]"
                }`}
              >
                {t.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-[#475569]">
        <div>
          Showing <strong className="text-[#0A0A0A]">{filteredVacancies.length}</strong>{" "}
          {filteredVacancies.length === 1 ? "opportunity" : "opportunities"}
          {selectedType !== "ALL" && (
            <span>
              {" "}
              in{" "}
              <strong>
                {OPPORTUNITY_TYPES.find((t) => t.value === selectedType)?.label}
              </strong>
            </span>
          )}
        </div>
        <Link
          href="/careers/track"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D] hover:underline"
        >
          <span>Already applied? Track your application</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Opportunity Cards List */}
      {filteredVacancies.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVacancies.map((vacancy) => {
            const typeLabel =
              OPPORTUNITY_TYPES.find((t) => t.value === vacancy.type)?.label ||
              vacancy.type

            return (
              <article
                key={vacancy.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm hover:border-[#15803D] hover:shadow-md transition-all duration-200"
              >
                <div>
                  {/* Badges Row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.22)] px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-[#0A0A0A]">
                      {typeLabel}
                    </span>

                    {vacancy.isClosed ? (
                      <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[0.65rem] font-bold text-[#DC2626]">
                        Applications Closed
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[0.65rem] font-bold text-[#15803D] flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                        Open
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="mt-4 text-[1.25rem] font-semibold text-[#0A0A0A] leading-snug group-hover:text-[#15803D] transition">
                    <Link href={`/careers/${vacancy.slug}`} className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      {vacancy.title}
                    </Link>
                  </h3>

                  {/* Department & Location */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B]">
                    <span className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 text-[#94A3B8]" />
                      {vacancy.department}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[#94A3B8]" />
                      {vacancy.location} ({vacancy.workArrangement.toLowerCase()})
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="mt-3.5 text-[0.86rem] leading-relaxed text-[#475569] line-clamp-3">
                    {vacancy.shortSummary}
                  </p>
                </div>

                {/* Footer with Deadline & CTA */}
                <div className="mt-6 pt-4 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#64748B]">
                    <Clock className="h-3.5 w-3.5 text-[#94A3B8]" />
                    <span className="truncate">
                      {vacancy.closesAt
                        ? `Closes: ${formatNairobiDeadline(vacancy.closesAt)}`
                        : "Open until filled"}
                    </span>
                  </div>
                  <span className="font-semibold text-[#15803D] group-hover:translate-x-0.5 transition flex items-center gap-1 shrink-0">
                    View Role <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-[#F8FAFC] p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#E5E7EB] text-[#94A3B8]">
            <Briefcase className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#0A0A0A]">
            {initialVacancies.length === 0
              ? "No open opportunities at the moment"
              : "No matching opportunities found"}
          </h3>
          <p className="mt-2 text-sm text-[#475569] max-w-md mx-auto">
            {initialVacancies.length === 0
              ? "We're not currently accepting applications, but our Careers page will remain available. Please check back for future opportunities to work with EventSlot."
              : "Try adjusting your search keywords or clearing your opportunity type and department filters."}
          </p>
          {(searchQuery || selectedType !== "ALL" || selectedDepartment !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("")
                setSelectedType("ALL")
                setSelectedDepartment("ALL")
              }}
              className="mt-5 rounded-full border border-[#D1D5DB] bg-white px-4 py-2 text-xs font-semibold text-[#0A0A0A] hover:border-[#15803D] transition shadow-sm"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
