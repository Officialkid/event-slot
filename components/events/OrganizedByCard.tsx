"use client"

import React, { useState } from "react"
import { Phone, MessageCircle, Mail, Copy, Check, X } from "lucide-react"
import { FollowButton } from "@/components/following/FollowButton"

export interface OrganizedByCardProps {
  organizerName: string
  organizerUsername?: string | null
  targetType?: 'organizer' | 'organization'
  organizerImage?: string | null
  followerCount?: number
  hostedEventsCount?: number
  showFollowerCountPublicly?: boolean
  contactPhone?: string | null
  contactWhatsapp?: string | null
  contactEmail?: string | null
  className?: string
}

export function OrganizedByCard({
  organizerName,
  organizerUsername,
  targetType = 'organizer',
  organizerImage,
  followerCount = 0,
  hostedEventsCount = 1,
  showFollowerCountPublicly = true,
  contactPhone,
  contactWhatsapp,
  contactEmail,
  className = "",
}: OrganizedByCardProps) {
  const [showContactModal, setShowContactModal] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const hasAnyContact = Boolean(
    (contactWhatsapp && contactWhatsapp.trim().length > 0) ||
    (contactPhone && contactPhone.trim().length > 0) ||
    (contactEmail && contactEmail.trim().length > 0)
  )

  const initials = (organizerName || "Organizer")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    }
  }

  const cleanPhoneForWhatsapp = (phone: string) => {
    return phone.replace(/[^\d]/g, "")
  }

  return (
    <section className={`w-full my-8 ${className}`} aria-labelledby="organized-by-heading">
      <h2
        id="organized-by-heading"
        className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] mb-3"
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        Organized by
      </h2>

      <div
        className="rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center transition-all shadow-sm"
        style={{
          background: "var(--surface)",
          border: "1px solid color-mix(in srgb, var(--border) 85%, transparent)",
        }}
      >
        {/* Profile Avatar / Photo */}
        <div className="relative mb-3.5">
          {organizerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organizerImage}
              alt={organizerName}
              className="w-20 h-20 sm:w-22 sm:h-22 rounded-full object-cover shadow-sm"
              style={{
                border: "2px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
              }}
            />
          ) : (
            <div
              className="w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center font-bold text-xl sm:text-2xl tracking-wider select-none shadow-sm"
              style={{
                background: "color-mix(in srgb, var(--accent) 18%, var(--surface))",
                color: "var(--accent)",
                border: "1.5px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Organizer Display Name */}
        <h3
          className="text-lg sm:text-xl font-bold text-[var(--text-primary)] mb-4 max-w-md line-clamp-2"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          {organizerName}
        </h3>

        {/* Stats Row */}
        <div
          className="flex items-center justify-center gap-6 sm:gap-10 py-3 px-6 mb-6 rounded-xl"
          style={{
            background: "color-mix(in srgb, var(--surface-muted) 60%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--border) 60%, transparent)",
          }}
        >
          {/* Followers Column */}
          <div className="text-center min-w-[70px]">
            <p className="text-[0.72rem] sm:text-[0.76rem] font-medium uppercase tracking-wider text-[var(--text-muted)] m-0">
              Followers
            </p>
            <p className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5 mb-0" style={{ fontFamily: "var(--font-dm-sans)" }}>
              {showFollowerCountPublicly ? followerCount.toLocaleString() : "—"}
            </p>
          </div>

          {/* Divider */}
          <div
            className="w-px h-8"
            style={{ background: "color-mix(in srgb, var(--border) 80%, transparent)" }}
          />

          {/* Events Column */}
          <div className="text-center min-w-[70px]">
            <p className="text-[0.72rem] sm:text-[0.76rem] font-medium uppercase tracking-wider text-[var(--text-muted)] m-0">
              Events
            </p>
            <p className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5 mb-0" style={{ fontFamily: "var(--font-dm-sans)" }}>
              {hostedEventsCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-xs">
          {/* Contact Button (Shown only when organizer configured office contact channels) */}
          {hasAnyContact && (
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-sm font-semibold transition active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
              style={{
                background: "color-mix(in srgb, var(--surface-muted) 90%, transparent)",
                color: "var(--text-primary)",
                border: "1px solid color-mix(in srgb, var(--border) 90%, transparent)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              <Mail className="w-4 h-4 text-[var(--text-secondary)]" />
              <span>Contact</span>
            </button>
          )}

          {/* Follow Button */}
          {organizerUsername && (
            <div className={hasAnyContact ? "flex-1 min-w-[120px]" : "w-full flex justify-center"}>
              <FollowButton
                size="md"
                className="w-full justify-center"
                targetType={targetType}
                organiserUsername={organizerUsername}
                organiserName={organizerName}
                initialFollowerCount={followerCount}
                showFollowerCountPublicly={showFollowerCountPublicly}
              />
            </div>
          )}
        </div>
      </div>

      {/* Contact Modal / Bottom Sheet */}
      {showContactModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          style={{ background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 sm:p-7 shadow-2xl transition-all"
            style={{
              background: "var(--surface)",
              border: "1px solid color-mix(in srgb, var(--border) 90%, transparent)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3
                  id="contact-modal-title"
                  className="text-lg font-bold text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  Contact {organizerName}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  Official office contact details for direct inquiries
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contact Channels List */}
            <div className="space-y-3 my-5">
              {/* WhatsApp */}
              {contactWhatsapp && (
                <div
                  className="flex items-center justify-between p-3.5 rounded-xl border transition"
                  style={{
                    background: "color-mix(in srgb, var(--surface-muted) 50%, transparent)",
                    borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#25D366]/15 text-[#25D366]">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] m-0">WhatsApp</p>
                      <p className="text-xs text-[var(--text-secondary)] truncate m-0">{contactWhatsapp}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(contactWhatsapp, "whatsapp")}
                      title="Copy WhatsApp Number"
                      className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition"
                    >
                      {copiedKey === "whatsapp" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={`https://wa.me/${cleanPhoneForWhatsapp(contactWhatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#25D366] text-white hover:bg-[#20ba59] transition"
                    >
                      Chat
                    </a>
                  </div>
                </div>
              )}

              {/* Phone Line */}
              {contactPhone && (
                <div
                  className="flex items-center justify-between p-3.5 rounded-xl border transition"
                  style={{
                    background: "color-mix(in srgb, var(--surface-muted) 50%, transparent)",
                    borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-blue-500/15 text-blue-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] m-0">Office Line</p>
                      <p className="text-xs text-[var(--text-secondary)] truncate m-0">{contactPhone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(contactPhone, "phone")}
                      title="Copy Phone Number"
                      className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition"
                    >
                      {copiedKey === "phone" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={`tel:${contactPhone.replace(/\s+/g, "")}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      Call
                    </a>
                  </div>
                </div>
              )}

              {/* Email */}
              {contactEmail && (
                <div
                  className="flex items-center justify-between p-3.5 rounded-xl border transition"
                  style={{
                    background: "color-mix(in srgb, var(--surface-muted) 50%, transparent)",
                    borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-purple-500/15 text-purple-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] m-0">Inquiry Email</p>
                      <p className="text-xs text-[var(--text-secondary)] truncate m-0">{contactEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(contactEmail, "email")}
                      title="Copy Email"
                      className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition"
                    >
                      {copiedKey === "email" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={`mailto:${contactEmail}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition"
                    >
                      Email
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowContactModal(false)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)]/80 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
