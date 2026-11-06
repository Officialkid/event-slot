"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  OPPORTUNITY_TYPES,
  WORK_ARRANGEMENTS,
  VACANCY_STATUSES,
  QUESTION_TYPES,
  type VacancyQuestion,
  type QuestionTypeValue,
} from "@/lib/recruitment/types"
import {
  ArrowLeft,
  Plus,
  Trash2,
  HelpCircle,
  Save,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from "lucide-react"

interface VacancyFormProps {
  initialData?: any
  isEditing?: boolean
}

export function VacancyForm({ initialData, isEditing = false }: VacancyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Basic Information
  const [title, setTitle] = useState(initialData?.title || "")
  const [slug, setSlug] = useState(initialData?.slug || "")
  const [type, setType] = useState(initialData?.type || "FULL_TIME")
  const [department, setDepartment] = useState(initialData?.department || "Engineering")
  const [location, setLocation] = useState(initialData?.location || "Nairobi, Kenya")
  const [workArrangement, setWorkArrangement] = useState(
    initialData?.workArrangement || "REMOTE"
  )
  const [openingsCount, setOpeningsCount] = useState(initialData?.openingsCount || 1)
  const [compensation, setCompensation] = useState(initialData?.compensation || "")
  const [shortSummary, setShortSummary] = useState(initialData?.shortSummary || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [responsibilities, setResponsibilities] = useState(
    initialData?.responsibilities || ""
  )
  const [qualifications, setQualifications] = useState(
    initialData?.qualifications || ""
  )
  const [skillsText, setSkillsText] = useState(
    Array.isArray(initialData?.skills) ? initialData.skills.join(", ") : ""
  )

  // Recruitment Configuration
  const [status, setStatus] = useState(initialData?.status || "DRAFT")
  const [opensAt, setOpensAt] = useState(
    initialData?.opensAt ? new Date(initialData.opensAt).toISOString().slice(0, 16) : ""
  )
  const [closesAt, setClosesAt] = useState(
    initialData?.closesAt ? new Date(initialData.closesAt).toISOString().slice(0, 16) : ""
  )

  // Document requirements
  const [reqResume, setReqResume] = useState(true)
  const [reqPortfolio, setReqPortfolio] = useState(
    Array.isArray(initialData?.requiredDocuments)
      ? initialData.requiredDocuments.includes("PORTFOLIO")
      : false
  )
  const [reqCoverLetter, setReqCoverLetter] = useState(
    Array.isArray(initialData?.requiredDocuments)
      ? initialData.requiredDocuments.includes("COVER_LETTER")
      : false
  )

  // Dynamic questions
  const [questions, setQuestions] = useState<VacancyQuestion[]>(
    Array.isArray(initialData?.questions) ? initialData.questions : []
  )

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!isEditing && (!slug || slug === autoSlug(title))) {
      setSlug(autoSlug(val))
    }
  }

  function autoSlug(text: string) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  const handleAddQuestion = () => {
    const newQ: VacancyQuestion = {
      id: "q_" + Date.now().toString(36),
      label: "",
      type: "SHORT_TEXT",
      required: true,
      placeholder: "",
    }
    setQuestions([...questions, newQ])
  }

  const handleUpdateQuestion = (
    index: number,
    field: keyof VacancyQuestion,
    val: any
  ) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: val }
    setQuestions(updated)
  }

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleSubmit = async (submitStatus: string) => {
    setError(null)
    setSuccess(null)
    setLoading(true)

    const requiredDocs: string[] = []
    if (reqResume) requiredDocs.push("RESUME")
    if (reqPortfolio) requiredDocs.push("PORTFOLIO")
    if (reqCoverLetter) requiredDocs.push("COVER_LETTER")

    const skillsArray = skillsText
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)

    const payload = {
      title,
      slug,
      type,
      department,
      location,
      workArrangement,
      openingsCount: parseInt(String(openingsCount), 10) || 1,
      compensation,
      shortSummary,
      description,
      responsibilities,
      qualifications,
      skills: skillsArray,
      status: submitStatus,
      opensAt: opensAt ? new Date(opensAt).toISOString() : null,
      closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      requiredDocuments: requiredDocs,
      optionalDocuments: [],
      questions,
    }

    try {
      const url = isEditing
        ? `/api/admin/recruitment/vacancies/${initialData.id}`
        : `/api/admin/recruitment/vacancies`
      const method = isEditing ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to save vacancy")
      }

      setSuccess("Vacancy saved successfully!")
      setTimeout(() => {
        router.push("/admin/recruitment/vacancies")
        router.refresh()
      }, 1000)
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/recruitment/vacancies"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#0A0A0A] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Vacancies</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSubmit("DRAFT")}
            disabled={loading}
            className="rounded-full border border-[#D1D5DB] bg-white px-5 py-2 text-xs font-semibold text-[#374151] hover:border-[#15803D] transition shadow-sm disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("PUBLISHED")}
            disabled={loading}
            className="rounded-full bg-[#C8F55A] px-6 py-2 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Publish Vacancy</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-xs text-[#991B1B] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-xs text-[#166534] flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
          <span>{success}</span>
        </div>
      )}

      {/* 1. Basic Information */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-5">
        <h3 className="text-base font-bold text-[#0A0A0A] border-b border-[#F1F5F9] pb-3">
          1. Basic Information
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Position Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              URL Slug *
            </label>
            <div className="flex rounded-xl border border-[#D1D5DB] bg-[#F8FAFC] overflow-hidden focus-within:border-[#15803D]">
              <span className="px-3 py-2.5 text-xs text-[#94A3B8] border-r border-[#E2E8F0]">
                /careers/
              </span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="senior-backend-engineer"
                className="w-full px-3 py-2.5 text-sm bg-transparent text-[#0A0A0A] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Opportunity Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            >
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Department *
            </label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Design, Community"
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Work Arrangement
            </label>
            <select
              value={workArrangement}
              onChange={(e) => setWorkArrangement(e.target.value)}
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            >
              {WORK_ARRANGEMENTS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Nairobi, Kenya / Remote (Africa)"
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Openings Count
            </label>
            <input
              type="number"
              min={1}
              value={openingsCount}
              onChange={(e) => setOpeningsCount(e.target.value)}
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Compensation (Optional)
            </label>
            <input
              type="text"
              value={compensation}
              onChange={(e) => setCompensation(e.target.value)}
              placeholder="e.g. Competitive monthly retainer / KSh 120,000 - 180,000"
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Short Summary *
            </label>
            <textarea
              required
              rows={2}
              value={shortSummary}
              onChange={(e) => setShortSummary(e.target.value)}
              placeholder="A concise 1-2 sentence overview shown on cards and search results..."
              className="w-full rounded-xl border border-[#D1D5DB] p-3 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Full Description *
            </label>
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the opportunity and team context..."
              className="w-full rounded-xl border border-[#D1D5DB] p-3 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Key Responsibilities *
            </label>
            <textarea
              required
              rows={5}
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              placeholder="List the key deliverables and daily responsibilities..."
              className="w-full rounded-xl border border-[#D1D5DB] p-3 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Qualifications &amp; Requirements *
            </label>
            <textarea
              required
              rows={5}
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              placeholder="Requirements, experience levels, and practical competencies..."
              className="w-full rounded-xl border border-[#D1D5DB] p-3 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Key Skills Tags (Comma-separated)
            </label>
            <input
              type="text"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="e.g. Next.js, TypeScript, PostgreSQL, Prisma, Event Operations"
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* 2. Schedule, Deadlines & Document Requirements */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-5">
        <h3 className="text-base font-bold text-[#0A0A0A] border-b border-[#F1F5F9] pb-3">
          2. Recruitment Schedule &amp; Documents
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Application Opening Date
            </label>
            <input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
            <span className="text-[0.7rem] text-[#64748B] mt-1 block">
              Default is now if omitted.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
              Application Deadline (Nairobi Time)
            </label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
            />
            <span className="text-[0.7rem] text-[#64748B] mt-1 block">
              Leave empty for rolling recruitment / open until filled.
            </span>
          </div>

          <div className="sm:col-span-2 pt-3 border-t border-[#F1F5F9]">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-3">
              Required Documents
            </label>
            <div className="flex flex-wrap gap-5 text-xs text-[#374151]">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reqResume}
                  onChange={(e) => setReqResume(e.target.checked)}
                  className="rounded text-[#15803D] focus:ring-[#15803D]"
                />
                <span>CV / Résumé (Mandatory)</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reqPortfolio}
                  onChange={(e) => setReqPortfolio(e.target.checked)}
                  className="rounded text-[#15803D] focus:ring-[#15803D]"
                />
                <span>Portfolio / Work Samples</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reqCoverLetter}
                  onChange={(e) => setReqCoverLetter(e.target.checked)}
                  className="rounded text-[#15803D] focus:ring-[#15803D]"
                />
                <span>Cover Letter / Statement of Interest</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Vacancy-Specific Custom Questions */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#0A0A0A]">
              3. Vacancy-Specific Application Questions
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Add custom intake questions relevant to this specific role.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddQuestion}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A0A0A] hover:border-[#15803D] transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Question
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div
              key={q.id || idx}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#475569]">Question #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveQuestion(idx)}
                  className="text-[#DC2626] hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <label className="block text-[0.7rem] font-semibold text-[#64748B] mb-1">
                    Question Prompt / Label
                  </label>
                  <input
                    type="text"
                    value={q.label}
                    onChange={(e) => handleUpdateQuestion(idx, "label", e.target.value)}
                    placeholder="e.g. Share a link to a project or system you architected..."
                    className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[0.7rem] font-semibold text-[#64748B] mb-1">
                    Response Type
                  </label>
                  <select
                    value={q.type}
                    onChange={(e) =>
                      handleUpdateQuestion(idx, "type", e.target.value as QuestionTypeValue)
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                  >
                    {QUESTION_TYPES.map((qt) => (
                      <option key={qt.value} value={qt.value}>
                        {qt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") && (
                <div>
                  <label className="block text-[0.7rem] font-semibold text-[#64748B] mb-1">
                    Options (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(q.options) ? q.options.join(", ") : ""}
                    onChange={(e) =>
                      handleUpdateQuestion(
                        idx,
                        "options",
                        e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder="Option 1, Option 2, Option 3"
                    className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#475569]">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => handleUpdateQuestion(idx, "required", e.target.checked)}
                    className="rounded text-[#15803D] focus:ring-[#15803D]"
                  />
                  <span>Mandatory response required from applicant</span>
                </label>
              </div>
            </div>
          ))}

          {questions.length === 0 && (
            <div className="py-6 text-center text-xs text-[#64748B] border border-dashed border-[#CBD5E1] rounded-xl">
              No custom questions configured. The standard personal and background info will be collected.
            </div>
          )}
        </div>
      </section>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
        <Link
          href="/admin/recruitment/vacancies"
          className="text-xs font-semibold text-[#64748B] hover:text-[#0A0A0A]"
        >
          Cancel
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSubmit("DRAFT")}
            disabled={loading}
            className="rounded-full border border-[#D1D5DB] bg-white px-6 py-2.5 text-xs font-semibold text-[#374151] hover:border-[#15803D] transition shadow-sm disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("PUBLISHED")}
            disabled={loading}
            className="rounded-full bg-[#C8F55A] px-7 py-2.5 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-md disabled:opacity-50"
          >
            {isEditing ? "Update & Publish" : "Publish Vacancy"}
          </button>
        </div>
      </div>
    </div>
  )
}
