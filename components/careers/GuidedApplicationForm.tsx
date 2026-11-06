"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  type VacancyQuestion,
  type SubmittedAnswer,
} from "@/lib/recruitment/types"
import {
  User,
  GraduationCap,
  HelpCircle,
  FileUp,
  CheckSquare,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Upload,
  CheckCircle2,
  Lock,
} from "lucide-react"

interface GuidedApplicationFormProps {
  vacancy: {
    slug: string
    title: string
    department: string
    type: string
    requiredDocuments: string[]
    questions: VacancyQuestion[]
  }
}

export function GuidedApplicationForm({ vacancy }: GuidedApplicationFormProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Step 1: Personal Info
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [location, setLocation] = useState("")

  // Step 2: Background
  const [education, setEducation] = useState("")
  const [experience, setExperience] = useState("")
  const [skills, setSkills] = useState("")
  const [portfolioLinks, setPortfolioLinks] = useState("")

  // Step 3: Vacancy Questions
  const [answers, setAnswers] = useState<Record<string, any>>({})

  // Step 4: Documents
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null)

  // Step 5: Privacy Agreement
  const [privacyAgreed, setPrivacyAgreed] = useState(false)

  const handleAnswerChange = (qId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }))
  }

  // Step Validation
  const validateStep = (step: number): boolean => {
    setErrorMessage(null)

    if (step === 1) {
      if (!fullName.trim()) {
        setErrorMessage("Please enter your full name.")
        return false
      }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setErrorMessage("Please enter a valid email address.")
        return false
      }
      return true
    }

    if (step === 3) {
      for (const q of vacancy.questions) {
        if (q.required) {
          const val = answers[q.id]
          if (
            val === undefined ||
            val === null ||
            (typeof val === "string" && !val.trim()) ||
            (Array.isArray(val) && val.length === 0)
          ) {
            setErrorMessage(`Please answer the required question: "${q.label}"`)
            return false
          }
        }
      }
      return true
    }

    if (step === 4) {
      if (vacancy.requiredDocuments.includes("RESUME") && !resumeFile) {
        setErrorMessage("Please select and upload your CV / Résumé.")
        return false
      }
      return true
    }

    return true
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(5, prev + 1))
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handlePrev = () => {
    setErrorMessage(null)
    setCurrentStep((prev) => Math.max(1, prev - 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep(1) || !validateStep(3) || !validateStep(4)) return

    if (!privacyAgreed) {
      setErrorMessage("Please acknowledge the recruitment privacy notice to proceed.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.append("fullName", fullName.trim())
      formData.append("email", email.trim().toLowerCase())
      formData.append("phone", phone.trim())
      formData.append("location", location.trim())
      formData.append("education", education.trim())
      formData.append("experience", experience.trim())
      formData.append("skills", skills.trim())
      formData.append("portfolioLinks", portfolioLinks.trim())
      formData.append("privacyAcknowledged", "true")

      // Package answers with question labels for version-aware permanence
      const answersPayload: SubmittedAnswer[] = vacancy.questions.map((q) => ({
        questionId: q.id,
        questionLabel: q.label,
        questionType: q.type,
        value: answers[q.id] ?? "",
      }))
      formData.append("answers", JSON.stringify(answersPayload))

      if (resumeFile) formData.append("resume", resumeFile)
      if (portfolioFile) formData.append("portfolio", portfolioFile)
      if (coverLetterFile) formData.append("coverLetter", coverLetterFile)

      const response = await fetch(`/api/careers/${vacancy.slug}/apply`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Submission failed. Please check your answers.")
      }

      // Route to confirmation view
      router.push(
        `/careers/confirmation?code=${encodeURIComponent(
          data.referenceCode
        )}&role=${encodeURIComponent(data.vacancyTitle)}&date=${encodeURIComponent(
          data.submittedAt
        )}`
      )
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.")
      setIsSubmitting(false)
    }
  }

  const STEPS = [
    { num: 1, label: "Personal Info", icon: User },
    { num: 2, label: "Background", icon: GraduationCap },
    { num: 3, label: "Role Questions", icon: HelpCircle },
    { num: 4, label: "Documents", icon: FileUp },
    { num: 5, label: "Review & Submit", icon: CheckSquare },
  ]

  return (
    <div className="space-y-8">
      {/* Stepper Progress Bar */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between overflow-x-auto pb-1 scrollbar-none gap-2">
          {STEPS.map((s) => {
            const Icon = s.icon
            const isActive = currentStep === s.num
            const isCompleted = currentStep > s.num

            return (
              <div
                key={s.num}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition ${
                  isActive
                    ? "bg-[#0A0A0A] text-[#C8F55A]"
                    : isCompleted
                    ? "text-[#15803D] bg-[#F0FDF4]"
                    : "text-[#94A3B8] bg-transparent"
                }`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] ${
                    isActive
                      ? "bg-[#C8F55A] text-[#0A0A0A] font-bold"
                      : isCompleted
                      ? "bg-[#15803D] text-white"
                      : "bg-[#E2E8F0] text-[#64748B]"
                  }`}
                >
                  {isCompleted ? "✓" : s.num}
                </div>
                <span>{s.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-xs text-[#991B1B] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ========================================================================= */}
        {/* STEP 1: PERSONAL INFORMATION                                              */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#0A0A0A]">
                Section 1: Personal Details
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                We only collect contact details necessary to review your application.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Amani Kibet"
                  className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +254 712 345 678"
                  className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Current City &amp; Country
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Nairobi, Kenya"
                  className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: BACKGROUND & EXPERIENCE                                           */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#0A0A0A]">
                Section 2: Background &amp; Experience
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Share an overview of your practical experience and competencies.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Education &amp; Training (Optional)
                </label>
                <textarea
                  rows={3}
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="Degree, university, certifications, or self-directed learning..."
                  className="w-full rounded-xl border border-[#D1D5DB] p-3 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Work / Project Experience (Optional)
                </label>
                <textarea
                  rows={4}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Recent roles, key contributions, or projects you took pride in..."
                  className="w-full rounded-xl border border-[#D1D5DB] p-3 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Primary Skills (Comma-separated)
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. React, Node.js, System Architecture, Customer Support"
                  className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Portfolio / GitHub / LinkedIn Links
                </label>
                <input
                  type="text"
                  value={portfolioLinks}
                  onChange={(e) => setPortfolioLinks(e.target.value)}
                  placeholder="https://github.com/yourhandle, https://linkedin.com/in/yourprofile"
                  className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: VACANCY-SPECIFIC QUESTIONS                                        */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#0A0A0A]">
                Section 3: Questions for this Position
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                These questions help our hiring team understand how you approach specific role challenges.
              </p>
            </div>

            <div className="space-y-5 pt-2">
              {vacancy.questions.length > 0 ? (
                vacancy.questions.map((q, idx) => {
                  const val = answers[q.id] || ""

                  return (
                    <div key={q.id || idx} className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#0A0A0A]">
                        {q.label} {q.required && <span className="text-[#DC2626]">*</span>}
                      </label>
                      {q.helpText && (
                        <p className="text-[0.7rem] text-[#64748B]">{q.helpText}</p>
                      )}

                      {q.type === "SHORT_TEXT" && (
                        <input
                          type="text"
                          required={q.required}
                          value={val}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          placeholder={q.placeholder || "Your answer..."}
                          className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                        />
                      )}

                      {q.type === "LONG_TEXT" && (
                        <textarea
                          rows={4}
                          required={q.required}
                          value={val}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          placeholder={q.placeholder || "Provide your detailed response..."}
                          className="w-full rounded-xl border border-[#D1D5DB] p-3 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                        />
                      )}

                      {q.type === "URL" && (
                        <input
                          type="url"
                          required={q.required}
                          value={val}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                        />
                      )}

                      {q.type === "YES_NO" && (
                        <div className="flex gap-4 pt-1">
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#374151] cursor-pointer">
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              checked={val === "Yes"}
                              onChange={() => handleAnswerChange(q.id, "Yes")}
                              className="text-[#15803D] focus:ring-[#15803D]"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#374151] cursor-pointer">
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              checked={val === "No"}
                              onChange={() => handleAnswerChange(q.id, "No")}
                              className="text-[#15803D] focus:ring-[#15803D]"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      )}

                      {q.type === "SINGLE_CHOICE" && (
                        <select
                          required={q.required}
                          value={val}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                        >
                          <option value="">Select an option...</option>
                          {q.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {q.type === "MULTIPLE_CHOICE" && (
                        <div className="space-y-1.5 pt-1">
                          {q.options?.map((opt) => {
                            const selected = Array.isArray(val) && val.includes(opt)
                            return (
                              <label
                                key={opt}
                                className="inline-flex items-center gap-2 text-xs font-medium text-[#374151] mr-4 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(e) => {
                                    const current = Array.isArray(val) ? val : []
                                    if (e.target.checked) {
                                      handleAnswerChange(q.id, [...current, opt])
                                    } else {
                                      handleAnswerChange(
                                        q.id,
                                        current.filter((item: string) => item !== opt)
                                      )
                                    }
                                  }}
                                  className="rounded text-[#15803D] focus:ring-[#15803D]"
                                />
                                <span>{opt}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="text-xs text-[#64748B] py-6 text-center border border-dashed border-[#CBD5E1] rounded-xl">
                  No additional questions required for this position.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: SUPPORTING DOCUMENTS                                              */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-[#0A0A0A]">
                Section 4: Supporting Documents
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Upload your CV or résumé. Documents are kept strictly confidential and stored in private storage.
              </p>
            </div>

            <div className="space-y-6 pt-2">
              {/* CV / Resume Upload */}
              <div className="rounded-xl border border-dashed border-[#CBD5E1] p-5 bg-[#F8FAFC] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#0A0A0A]">
                    CV or Résumé *
                  </label>
                  <span className="text-[0.7rem] text-[#64748B]">
                    Max 10 MB (PDF, DOCX)
                  </span>
                </div>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-[#475569] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#0A0A0A] file:text-[#C8F55A] hover:file:bg-[#1A1A1A] cursor-pointer"
                />

                {resumeFile && (
                  <div className="mt-2 text-xs font-semibold text-[#15803D] flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Selected: {resumeFile.name} ({(resumeFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                )}
              </div>

              {/* Portfolio / Samples Upload (Optional) */}
              <div className="rounded-xl border border-dashed border-[#CBD5E1] p-5 bg-[#F8FAFC] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#0A0A0A]">
                    Portfolio or Work Samples (Optional)
                  </label>
                  <span className="text-[0.7rem] text-[#64748B]">Max 10 MB</span>
                </div>

                <input
                  type="file"
                  accept=".pdf,.zip,.png,.jpg,.jpeg"
                  onChange={(e) => setPortfolioFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-[#475569] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white file:border file:border-[#D1D5DB] file:text-[#374151] hover:file:bg-[#F1F5F9] cursor-pointer"
                />

                {portfolioFile && (
                  <div className="mt-2 text-xs font-semibold text-[#15803D] flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Selected: {portfolioFile.name}</span>
                  </div>
                )}
              </div>

              {/* Cover Letter (Optional) */}
              <div className="rounded-xl border border-dashed border-[#CBD5E1] p-5 bg-[#F8FAFC] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#0A0A0A]">
                    Cover Letter (Optional)
                  </label>
                  <span className="text-[0.7rem] text-[#64748B]">Max 10 MB</span>
                </div>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => setCoverLetterFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-[#475569] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white file:border file:border-[#D1D5DB] file:text-[#374151] hover:file:bg-[#F1F5F9] cursor-pointer"
                />

                {coverLetterFile && (
                  <div className="mt-2 text-xs font-semibold text-[#15803D] flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Selected: {coverLetterFile.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5: REVIEW & FINAL SUBMISSION                                         */}
        {/* ========================================================================= */}
        {currentStep === 5 && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-[#0A0A0A]">
                Section 5: Review &amp; Submit Application
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Review your application details. You will receive a unique reference code to track your status.
              </p>
            </div>

            {/* Summary Review Card */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 text-xs space-y-3">
              <div className="grid grid-cols-2 gap-2 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <span className="text-[#94A3B8] block">Candidate Name:</span>
                  <strong className="text-[#0A0A0A]">{fullName}</strong>
                </div>
                <div>
                  <span className="text-[#94A3B8] block">Email:</span>
                  <strong className="text-[#0A0A0A]">{email}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <span className="text-[#94A3B8] block">Position:</span>
                  <strong className="text-[#0A0A0A]">{vacancy.title}</strong>
                </div>
                <div>
                  <span className="text-[#94A3B8] block">Department:</span>
                  <strong className="text-[#0A0A0A]">{vacancy.department}</strong>
                </div>
              </div>

              <div>
                <span className="text-[#94A3B8] block mb-1">Attached Documents:</span>
                <div className="flex flex-wrap gap-2 text-[0.7rem]">
                  {resumeFile ? (
                    <span className="rounded bg-white border border-[#CBD5E1] px-2 py-0.5 font-medium text-[#15803D]">
                      ✓ CV: {resumeFile.name}
                    </span>
                  ) : (
                    <span className="text-[#DC2626]">No CV attached</span>
                  )}
                  {portfolioFile && (
                    <span className="rounded bg-white border border-[#CBD5E1] px-2 py-0.5 font-medium text-[#475569]">
                      ✓ Portfolio: {portfolioFile.name}
                    </span>
                  )}
                  {coverLetterFile && (
                    <span className="rounded bg-white border border-[#CBD5E1] px-2 py-0.5 font-medium text-[#475569]">
                      ✓ Cover Letter: {coverLetterFile.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Privacy Agreement Checkbox */}
            <div className="rounded-xl border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.12)] p-4 text-xs text-[#374151]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-0.5 rounded text-[#15803D] focus:ring-[#15803D]"
                />
                <span className="leading-relaxed">
                  I confirm that the information provided is accurate, and I agree to the processing and private storage of my personal data for the purpose of recruitment in accordance with the EventSlot Privacy Policy.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D1D5DB] bg-white px-5 py-2.5 text-xs font-semibold text-[#374151] hover:border-[#15803D] transition shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Previous Section</span>
            </button>
          ) : (
            <Link
              href={`/careers/${vacancy.slug}`}
              className="text-xs font-semibold text-[#64748B] hover:text-[#0A0A0A]"
            >
              Cancel
            </Link>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] px-6 py-2.5 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-md"
            >
              <span>Continue to Step {currentStep + 1}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || !privacyAgreed}
              className="inline-flex items-center gap-2 rounded-full bg-[#C8F55A] px-8 py-3 text-sm font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-lg disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              <span>{isSubmitting ? "Submitting Application..." : "Submit Application"}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
