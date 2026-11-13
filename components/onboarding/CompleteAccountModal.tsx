"use client"

import React, { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Check, X, ArrowRight, ArrowLeft, Phone, MessageCircle, Mail, Building, AtSign } from "lucide-react"

export function CompleteAccountModal() {
  const { data: session, update: updateSession } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 fields
  const [organizationName, setOrganizationName] = useState("")
  const [username, setUsername] = useState("")
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  // Step 2 fields
  const [contactPhone, setContactPhone] = useState("")
  const [contactWhatsapp, setContactWhatsapp] = useState("")
  const [contactEmail, setContactEmail] = useState("")

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Check if modal should open
  useEffect(() => {
    if (!session?.user) return

    // If user has not completed onboarding and has not skipped
    const needsCompletion =
      (!session.user.onboardingCompleted && !session.user.onboardingSkipped) ||
      !session.user.username

    if (needsCompletion) {
      // Fetch user profile to see if already filled
      fetch("/api/profile")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            if (data.username) {
              setUsername(data.username)
              setUsernameAvailable(true)
            } else if (session.user.name || session.user.email) {
              const base = (session.user.name || session.user.email?.split("@")[0] || "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "-")
                .replace(/-+/g, "-")
                .slice(0, 18)
              if (base.length >= 3) {
                setUsername(base)
                checkUsernameAvailability(base)
              }
            }

            if (data.organizationName) setOrganizationName(data.organizationName)
            if (data.contactPhone) setContactPhone(data.contactPhone)
            if (data.contactWhatsapp) setContactWhatsapp(data.contactWhatsapp)
            if (data.contactEmail) setContactEmail(data.contactEmail)
            else if (session.user.email) setContactEmail(session.user.email)

            // If user has no username and hasn't skipped, show modal
            if (!data.username && !session.user.onboardingSkipped) {
              setIsOpen(true)
            }
          }
        })
        .catch(() => {})
    }
  }, [session])

  const checkUsernameAvailability = async (val: string) => {
    const clean = val.toLowerCase().trim()
    if (clean.length < 3) {
      setUsernameAvailable(null)
      setUsernameError("Username must be at least 3 characters")
      return
    }
    if (!/^[a-z0-9-]+$/.test(clean)) {
      setUsernameAvailable(null)
      setUsernameError("Only lowercase letters, numbers, and hyphens allowed")
      return
    }

    setUsernameChecking(true)
    setUsernameError(null)
    try {
      const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(clean)}`)
      const data = await res.json()
      if (data.available) {
        setUsernameAvailable(true)
        setUsernameError(null)
      } else {
        setUsernameAvailable(false)
        setUsernameError(data.error || "Username is already taken")
      }
    } catch {
      setUsernameAvailable(null)
    } finally {
      setUsernameChecking(false)
    }
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setUsername(val)
    checkUsernameAvailability(val)
  }

  const handleSkip = async () => {
    setIsOpen(false)
    try {
      await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      })
      await updateSession({ onboardingSkipped: true })
    } catch {
      // ignore
    }
  }

  const handleNext = () => {
    if (username.length > 0 && usernameAvailable === false) {
      return
    }
    setStep(2)
  }

  const handleFinish = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const patchData: Record<string, any> = {
        organizationName: organizationName.trim() || null,
        contactPhone: contactPhone.trim() || null,
        contactWhatsapp: contactWhatsapp.trim() || null,
        contactEmail: contactEmail.trim().toLowerCase() || null,
      }
      if (username.trim().length >= 3 && usernameAvailable) {
        patchData.username = username.trim().toLowerCase()
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update profile")
      }

      // Mark onboarding completed
      await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      })

      await updateSession({
        username: username.trim().toLowerCase() || session?.user?.username,
        organizationName: organizationName.trim() || null,
        onboardingCompleted: true,
      })

      setIsOpen(false)
    } catch (err: any) {
      setSaveError(err.message || "An error occurred while saving. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl transition-all"
        style={{
          background: "var(--surface)",
          border: "1px solid color-mix(in srgb, var(--border) 90%, transparent)",
        }}
      >
        {/* Top bar with Step Indicator & Skip */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 1 ? "bg-[var(--accent)] text-black" : "bg-emerald-500 text-white"
              }`}
            >
              {step === 1 ? "1" : "✓"}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Step {step} of 2: {step === 1 ? "Identity & URL" : "Office Contacts"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium transition"
          >
            Skip for now
          </button>
        </div>

        {/* Modal Title */}
        <div className="mb-6">
          <h2
            className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            {step === 1 ? "Complete Your Account" : "Add Organization Contacts"}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
            {step === 1
              ? "Choose your official organizer name and claim your custom EventSlot URL handle."
              : "Help attendees and partners contact your official team or office line directly."}
          </p>
        </div>

        {saveError && (
          <div className="p-3 mb-5 rounded-xl text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
            {saveError}
          </div>
        )}

        {/* Step 1: Identity & Handle */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Organization or Ministry Name <span className="text-xs font-normal text-[var(--text-muted)]">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <Building className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder={session?.user?.name || "e.g. Dunsin Oyekan Ministries"}
                  className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm bg-[var(--bg-input)] text-[var(--text-primary)] border border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <p className="text-[0.72rem] text-[var(--text-muted)] mt-1">
                Displayed as the official host/organizer name on your event pages.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Organizer Vanity Handle (@username)
              </label>
              <div className="relative flex items-center">
                <AtSign className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="e.g. dunsinoyekan"
                  className="w-full rounded-xl pl-10 pr-10 py-2.5 text-sm bg-[var(--bg-input)] text-[var(--text-primary)] border border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] focus:outline-none focus:border-[var(--accent)]"
                />
                <div className="absolute right-3.5 flex items-center">
                  {usernameChecking && (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin" />
                  )}
                  {!usernameChecking && usernameAvailable === true && (
                    <Check className="w-4 h-4 text-emerald-500" />
                  )}
                  {!usernameChecking && usernameAvailable === false && (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>

              {usernameAvailable === true && (
                <p className="text-[0.72rem] text-emerald-500 mt-1 font-medium">
                  ✓ Available! Your profile page: eventsslot.com/@{username}
                </p>
              )}
              {usernameError && (
                <p className="text-[0.72rem] text-red-500 mt-1 font-medium">
                  {usernameError}
                </p>
              )}
              {!usernameError && usernameAvailable === null && (
                <p className="text-[0.72rem] text-[var(--text-muted)] mt-1">
                  Claim your unique link for all your events: eventsslot.com/@{username || "your-handle"}
                </p>
              )}
            </div>

            <div className="pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSkip}
                className="py-2.5 px-4 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={Boolean(username && usernameAvailable === false)}
                className="py-2.5 px-6 rounded-xl text-xs font-bold bg-[var(--accent)] text-black hover:opacity-90 transition flex items-center gap-2 disabled:opacity-50"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Office Contacts */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Main Office / Reception Phone <span className="text-xs font-normal text-[var(--text-muted)]">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <Phone className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="e.g. +254 712 345 678"
                  className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm bg-[var(--bg-input)] text-[var(--text-primary)] border border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Office WhatsApp Line <span className="text-xs font-normal text-[var(--text-muted)]">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <MessageCircle className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="tel"
                  value={contactWhatsapp}
                  onChange={(e) => setContactWhatsapp(e.target.value)}
                  placeholder="e.g. +254 712 345 678"
                  className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm bg-[var(--bg-input)] text-[var(--text-primary)] border border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Official Inquiry Email <span className="text-xs font-normal text-[var(--text-muted)]">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="e.g. info@ministry.org"
                  className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm bg-[var(--bg-input)] text-[var(--text-primary)] border border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <p className="text-[0.72rem] text-[var(--text-muted)] leading-relaxed pt-1">
              Note: These contacts will appear on your event pages under the &ldquo;Organized by&rdquo; card when attendees click &ldquo;Contact&rdquo;. You can edit them at any time in Profile Settings.
            </p>

            <div className="pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2.5 px-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="py-2.5 px-3 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="py-2.5 px-6 rounded-xl text-xs font-bold bg-[var(--accent)] text-black hover:opacity-90 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <span>Finish Account Setup</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
