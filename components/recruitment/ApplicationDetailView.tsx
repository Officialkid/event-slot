"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  Send,
  RefreshCw,
  Edit,
  History,
  Lock,
} from "lucide-react"
import {
  APPLICATION_STATUSES,
  type ApplicationStatusValue,
  OPPORTUNITY_TYPES,
  type SubmittedAnswer,
} from "@/lib/recruitment/types"

interface ApplicationDetailProps {
  applicationId: string
}

export function ApplicationDetailView({ applicationId }: ApplicationDetailProps) {
  const [data, setData] = useState<any | null>(null)
  const [permissions, setPermissions] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Status Change State
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [statusNote, setStatusNote] = useState<string>("")
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // New Internal Note State
  const [newNoteText, setNewNoteText] = useState("")
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)

  const loadApplication = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/admin/recruitment/applications/${applicationId}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to load candidate application")
      }

      setData(json.application)
      setPermissions(json.permissions)
      setSelectedStatus(json.application.status)
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadApplication()
  }, [applicationId])

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStatus) return

    setIsSavingStatus(true)
    setStatusMessage(null)

    try {
      const res = await fetch(`/api/admin/recruitment/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedStatus,
          note: statusNote.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to update status")
      }

      setStatusMessage("Status successfully updated.")
      setIsChangingStatus(false)
      setStatusNote("")
      await loadApplication()
    } catch (err: any) {
      setStatusMessage(err.message || "Failed to update status")
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNoteText.trim()) return

    setIsSubmittingNote(true)
    try {
      const res = await fetch(`/api/admin/recruitment/applications/${applicationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteText: newNoteText.trim() }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Failed to save note")
      }

      setNewNoteText("")
      await loadApplication()
    } catch (err: any) {
      alert(err.message || "Failed to post note")
    } finally {
      setIsSubmittingNote(false)
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

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#15803D]" />
        <p className="mt-3 text-xs text-[#6B7280]">Loading application dossier...</p>
      </div>
    )
  }

  if (errorMessage || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        <AlertCircle className="mx-auto h-8 w-8 text-red-600 mb-2" />
        <h2 className="text-base font-bold">Failed to load dossier</h2>
        <p className="mt-1 text-xs">{errorMessage || "Application not found or inaccessible."}</p>
        <Link
          href="/admin/recruitment/applications"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#D1D5DB] px-4 py-2 text-xs font-semibold text-[#374151]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Applications</span>
        </Link>
      </div>
    )
  }

  const answersList: SubmittedAnswer[] = Array.isArray(data.answers)
    ? (data.answers as SubmittedAnswer[])
    : []

  const opportunityTypeLabel =
    OPPORTUNITY_TYPES.find((t) => t.value === data.vacancy.type)?.label ||
    data.vacancy.type

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/admin/recruitment/applications"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B7280] hover:text-[#15803D] transition"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Applications Inbox</span>
              </Link>
              <span className="text-[#D1D5DB]">•</span>
              <span className="font-mono text-xs font-bold text-[#15803D]">
                {data.referenceCode}
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A] font-serif">
              {data.fullName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#4B5563]">
              <span className="font-semibold text-[#0A0A0A]">{data.vacancy.title}</span>
              <span>•</span>
              <span className="text-[#6B7280]">{data.vacancy.department}</span>
              <span>•</span>
              <span className="rounded bg-[#F3F4F6] px-2 py-0.5 font-medium text-[#374151]">
                {opportunityTypeLabel}
              </span>
            </div>
          </div>

          {/* Status Badge & Transition Trigger */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold ${getStatusStyle(
                data.status
              )}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {APPLICATION_STATUSES.find((s) => s.value === data.status)?.label || data.status}
            </span>

            {permissions?.canUpdateStatus && (
              <button
                onClick={() => setIsChangingStatus(!isChangingStatus)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0A0A0A] px-4 py-2 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-xs"
              >
                <Edit className="h-3.5 w-3.5 text-[#C8F55A]" />
                <span>Update Status</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Change Form Dropdown */}
        {isChangingStatus && (
          <div className="mt-6 pt-6 border-t border-[#F3F4F6]">
            <form onSubmit={handleUpdateStatus} className="max-w-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#374151]">
                Transition Application Stage
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Optional transition reason or note..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="flex-1 rounded-xl border border-[#D1D5DB] px-3 py-2 text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={isSavingStatus}
                  className="rounded-xl bg-[#15803D] px-4 py-2 text-xs font-bold text-white hover:bg-[#166534] transition shadow-xs disabled:opacity-50"
                >
                  {isSavingStatus ? "Saving..." : "Apply Transition"}
                </button>
              </div>
            </form>
          </div>
        )}

        {statusMessage && (
          <div className="mt-3 text-xs font-semibold text-[#15803D]">{statusMessage}</div>
        )}
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Dossier & Answers & Documents) - Span 2 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Details Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#374151] mb-4">
              Candidate Profile
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-center gap-2 text-[#4B5563]">
                <Mail className="h-4 w-4 text-[#15803D] shrink-0" />
                <a
                  href={`mailto:${data.email}`}
                  className="font-medium text-[#0A0A0A] hover:underline"
                >
                  {data.email}
                </a>
              </div>
              <div className="flex items-center gap-2 text-[#4B5563]">
                <Phone className="h-4 w-4 text-[#15803D] shrink-0" />
                <span className="font-medium text-[#0A0A0A]">{data.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-[#4B5563]">
                <MapPin className="h-4 w-4 text-[#15803D] shrink-0" />
                <span className="font-medium text-[#0A0A0A]">{data.location}</span>
              </div>
              <div className="flex items-center gap-2 text-[#4B5563]">
                <Clock className="h-4 w-4 text-[#15803D] shrink-0" />
                <span>Submitted: {formatNairobi(data.submittedAt || data.createdAt)} EAT</span>
              </div>
            </div>

            {data.portfolioLinks && (
              <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
                <span className="block text-xs font-bold text-[#374151] mb-1">
                  Portfolio / Online Profiles
                </span>
                <p className="text-xs text-[#4B5563] whitespace-pre-wrap">
                  {data.portfolioLinks}
                </p>
              </div>
            )}
          </div>

          {/* Background Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#374151] mb-4">
              Background & Experience
            </h2>

            <div className="space-y-4 text-xs">
              {data.experience && (
                <div>
                  <span className="font-bold text-[#0A0A0A] block mb-1">
                    Work Experience Summary
                  </span>
                  <p className="text-[#4B5563] whitespace-pre-wrap bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E7EB]/60">
                    {data.experience}
                  </p>
                </div>
              )}

              {data.education && (
                <div>
                  <span className="font-bold text-[#0A0A0A] block mb-1">
                    Education & Credentials
                  </span>
                  <p className="text-[#4B5563] whitespace-pre-wrap bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E7EB]/60">
                    {data.education}
                  </p>
                </div>
              )}

              {data.skills && (
                <div>
                  <span className="font-bold text-[#0A0A0A] block mb-1">
                    Core Skills & Proficiencies
                  </span>
                  <p className="text-[#4B5563] whitespace-pre-wrap bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E7EB]/60">
                    {data.skills}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Snapshot Custom Questions & Answers */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#374151]">
                Custom Vacancy Questions (Snapshot)
              </h2>
              <span className="text-[11px] font-semibold text-[#15803D]">
                Permanently Preserved
              </span>
            </div>

            {answersList.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">
                No custom questions were attached to this vacancy.
              </p>
            ) : (
              <div className="space-y-4">
                {answersList.map((ans, idx) => (
                  <div
                    key={ans.questionId || idx}
                    className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 text-xs"
                  >
                    <div className="font-bold text-[#0A0A0A] mb-1.5 flex items-start justify-between gap-2">
                      <span>{ans.questionLabel || `Question ${idx + 1}`}</span>
                      <span className="rounded bg-white border border-[#E5E7EB] px-2 py-0.5 text-[10px] text-[#6B7280]">
                        {ans.questionType}
                      </span>
                    </div>

                    <div className="text-[#374151] font-medium bg-white p-3 rounded-lg border border-[#E5E7EB]">
                      {Array.isArray(ans.value)
                        ? ans.value.join(", ")
                        : typeof ans.value === "boolean"
                        ? ans.value
                          ? "Yes"
                          : "No"
                        : ans.value || <span className="text-[#9CA3AF]">No answer provided</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Uploaded Documents */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#374151]">
                Candidate Documents
              </h2>
              <div className="flex items-center gap-1 text-[11px] text-[#15803D]">
                <Lock className="h-3.5 w-3.5" />
                <span>Private & Secure Stream</span>
              </div>
            </div>

            {(!data.documents || data.documents.length === 0) ? (
              <p className="text-xs text-[#9CA3AF]">No documents were uploaded.</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {data.documents.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#15803D]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#0A0A0A]">
                          {doc.fileName || doc.originalFilename}
                        </div>
                        <div className="text-[11px] text-[#6B7280]">
                          <span className="font-semibold text-[#15803D] uppercase">
                            {doc.documentType || doc.type}
                          </span>{" "}
                          • {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>

                    <a
                      href={`/api/admin/recruitment/applications/${applicationId}/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#D1D5DB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>View / Download</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Notes & History) - Span 1 */}
        <div className="space-y-6">
          {/* Internal Notes Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#374151] mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#15803D]" />
              <span>Internal Evaluation Notes</span>
            </h2>

            {/* Note Composer */}
            {permissions?.canAddNote && (
              <form onSubmit={handleAddNote} className="mb-4">
                <textarea
                  rows={3}
                  required
                  placeholder="Record an internal interview impression or reviewer feedback..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full rounded-xl border border-[#D1D5DB] p-3 text-xs text-[#0A0A0A] placeholder-[#9CA3AF] focus:border-[#15803D] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0A0A0A] px-4 py-2 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-xs disabled:opacity-50"
                >
                  <Send className="h-3 w-3 text-[#C8F55A]" />
                  <span>{isSubmittingNote ? "Saving..." : "Add Internal Note"}</span>
                </button>
              </form>
            )}

            {/* Notes List */}
            {(!(data.notes || data.internalNotes) || (data.notes || data.internalNotes).length === 0) ? (
              <p className="text-xs text-[#9CA3AF]">
                No internal notes recorded for this applicant yet.
              </p>
            ) : (
              <div className="space-y-3">
                {(data.notes || data.internalNotes).map((note: any) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#6B7280] mb-1">
                      <span className="font-bold text-[#0A0A0A]">
                        {note.author?.name || note.author?.email || "Reviewer"}
                      </span>
                      <span>{formatNairobi(note.createdAt)}</span>
                    </div>
                    <p className="text-[#374151] whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status & Audit History Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#374151] mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-[#15803D]" />
              <span>Status History</span>
            </h2>

            {(!(data.timeline || data.statusHistory) || (data.timeline || data.statusHistory).length === 0) ? (
              <p className="text-xs text-[#9CA3AF]">Initial submission stage.</p>
            ) : (
              <div className="space-y-3">
                {(data.timeline || data.statusHistory).map((hist: any) => (
                  <div
                    key={hist.id}
                    className="border-l-2 border-[#15803D] pl-3 py-1 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                      <span className="font-bold text-[#0A0A0A]">
                        {hist.previousStatus || "START"} → {hist.newStatus}
                      </span>
                      <span>{formatNairobi(hist.createdAt)}</span>
                    </div>
                    {(hist.publicReason || hist.note) && (
                      <p className="text-[#4B5563] text-[11px] italic">“{hist.publicReason || hist.note}”</p>
                    )}
                    <div className="text-[10px] text-[#9CA3AF]">
                      By {hist.changedBy?.name || hist.changedBy?.email || "System"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zero-AI Governance Guarantee */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-xs text-[#6B7280] flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#15803D] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#0A0A0A] block mb-0.5">
                Human-Governed Review
              </span>
              EventSlot recruitment is strictly human-evaluated. No automated ranking or AI bot decisions are permitted.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
