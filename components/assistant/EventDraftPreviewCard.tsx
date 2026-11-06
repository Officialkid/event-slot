"use client"

import type {
  DraftFieldSource,
  EventDraftPreview,
} from "@/lib/assistant/draft-preparation"

export interface EventDraftPreviewCardProps {
  preview: EventDraftPreview
  proposalId?: string | null
  idempotencyKey?: string | null
  onSuggestCorrection?: (promptText: string) => void
  onConfirmCreation?: (proposalId: string, idempotencyKey: string) => void | Promise<void>
  onCancelProposal?: (proposalId: string) => void | Promise<void>
  isConfirming?: boolean
  confirmedEventResult?: {
    id: string
    title: string
    slug: string
    sideEffectsDeliveryStatus?: "ALL_DISPATCHED" | "PARTIALLY_DISPATCHED" | "FAILED" | "NONE"
  } | null
  errorMessage?: string | null
  proposalStatus?: "PENDING" | "EXECUTING" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "FAILED" | null
}

function formatProvenanceBadge(provenance: DraftFieldSource | undefined): {
  label: string
  className: string
} {
  if (provenance === "poster_vision") {
    return {
      label: "Poster",
      className: "border-[#C8F55A]/40 bg-[#C8F55A]/10 text-[#C8F55A]",
    }
  }
  if (provenance === "user_text" || provenance === "previous_draft") {
    return {
      label: "Extracted",
      className: "border-[#C8F55A]/40 bg-[#C8F55A]/10 text-[#C8F55A]",
    }
  }
  return {
    label: "Default",
    className: "border-[#3A3A3A] bg-[#1A1A1A] text-[#A3A3A3]",
  }
}

function formatEventDate(iso: string | null): string {
  if (!iso) return "Not specified"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  })
}

export function EventDraftPreviewCard({
  preview,
  proposalId,
  idempotencyKey,
  onSuggestCorrection,
  onConfirmCreation,
  onCancelProposal,
  isConfirming = false,
  confirmedEventResult = null,
  errorMessage = null,
  proposalStatus = null,
}: EventDraftPreviewCardProps) {
  const { fields, fieldProvenance, missingFields, uncertainFields, validationIssues } =
    preview

  const rows: Array<{
    key: keyof typeof fields
    label: string
    value: string
  }> = [
    {
      key: "title",
      label: "Title",
      value: fields.title || "Not specified",
    },
    {
      key: "organizerName",
      label: "Organiser",
      value: fields.organizerName || "Not specified",
    },
    {
      key: "eventType",
      label: "Format",
      value: `${fields.eventType} (${fields.accessType === "WALK_IN" ? "Walk-in" : "Registration"})`,
    },
    {
      key: "eventDate",
      label: "Start Date",
      value: formatEventDate(fields.eventDate),
    },
    {
      key: "location",
      label: fields.eventType === "VIRTUAL" ? "Virtual Link" : "Venue / Location",
      value:
        fields.eventType === "VIRTUAL"
          ? fields.virtualLink || "Not specified"
          : fields.location || "Not specified",
    },
    {
      key: "capacity",
      label: "Capacity",
      value:
        fields.capacity !== null && fields.capacity !== undefined
          ? `${fields.capacity} attendees`
          : "Unlimited / Not set",
    },
    {
      key: "isPaid",
      label: "Pricing",
      value: fields.isPaid
        ? fields.ticketPrice
          ? `Paid — ${fields.currency} ${fields.ticketPrice.toLocaleString()}`
          : "Paid — Price needed"
        : "Free Event",
    },
    {
      key: "visibility",
      label: "Visibility",
      value: fields.visibility,
    },
  ]

  return (
    <div
      data-testid="event-draft-preview-card"
      className="mt-2.5 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-3.5 text-xs text-[#0F172A] dark:text-[#F0EDE6] shadow-lg"
    >
      {/* Header & non-published status banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2A2A] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#C8F55A]" />
          <span className="font-semibold tracking-wide text-[#0F172A] dark:text-[#F0EDE6] uppercase">
            Event Draft Preview
          </span>
          {preview.draftVersion && (
            <span
              data-testid="draft-version-badge"
              className="rounded border border-[#3A3A3A] bg-[#141414] px-1.5 py-0.5 font-mono text-[9px] text-[#A3A3A3]"
            >
              {preview.draftVersion}
            </span>
          )}
        </div>
        <span
          data-testid="draft-preview-badge"
          className="rounded-full border border-[#15803D]/30 bg-[#15803D]/10 text-[#15803D] dark:border-[#C8F55A]/50 dark:bg-[#C8F55A]/10 dark:text-[#C8F55A] px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase"
        >
          Preview Only · Not Published
        </span>
      </div>

      <p
        data-testid="draft-status-banner"
        className="mt-2 rounded-lg border border-[#E2E8F0] dark:border-[#2A2A2A] bg-[#F8FAFC] dark:bg-[#141414] px-2.5 py-1.5 text-[11px] text-[#475569] dark:text-[#A3A3A3]"
      >
        {preview.statusBanner}
      </p>

      {/* Extracted & defaulted fields */}
      <div className="mt-3 space-y-1.5">
        {rows.map((row) => {
          const badge = formatProvenanceBadge(fieldProvenance[row.key])
          return (
            <div
              key={row.key}
              className="flex items-start justify-between gap-2 rounded-lg bg-[#F8FAFC] dark:bg-[#141414] px-2.5 py-1.5 border border-[#F1F5F9] dark:border-transparent"
            >
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] tracking-wide text-[#64748B] dark:text-[#8A8A8A] uppercase">
                  {row.label}
                </span>
                <span className="block break-words font-medium text-[#0F172A] dark:text-[#F0EDE6]">
                  {row.value}
                </span>
              </div>
              <span
                className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
          )
        })}

        {fields.description && (
          <div className="rounded-lg bg-[#141414] px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] tracking-wide text-[#64748B] dark:text-[#8A8A8A] uppercase">
                Description
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] ${
                  formatProvenanceBadge(fieldProvenance.description).className
                }`}
              >
                {formatProvenanceBadge(fieldProvenance.description).label}
              </span>
            </div>
            <p className="mt-1 line-clamp-3 text-[11px] text-[#D4D4D4]">
              {fields.description}
            </p>
          </div>
        )}
      </div>

      {/* Missing fields */}
      {missingFields.length > 0 && (
        <div
          data-testid="draft-missing-fields"
          className="mt-3 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-2.5"
        >
          <p className="font-semibold text-[#F59E0B]">
            Missing Details ({missingFields.length})
          </p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-[#0F172A] dark:text-[#F0EDE6]">
            {missingFields.map((mf) => (
              <li key={mf.field}>
                <span className="font-medium text-[#F59E0B]">{mf.label}:</span>{" "}
                {mf.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Uncertain or contradictory fields */}
      {uncertainFields.length > 0 && (
        <div
          data-testid="draft-uncertain-fields"
          className="mt-2.5 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 p-2.5"
        >
          <p className="font-semibold text-[#EF4444]">
            Needs Clarification ({uncertainFields.length})
          </p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-[#0F172A] dark:text-[#F0EDE6]">
            {uncertainFields.map((uf, idx) => (
              <li key={`${uf.field}-${idx}`}>
                <span className="font-medium text-[#EF4444]">{uf.label}:</span>{" "}
                {uf.issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Schema validation issues */}
      {validationIssues.length > 0 && (
        <div
          data-testid="draft-validation-issues"
          className="mt-2.5 rounded-lg border border-[#EF4444]/40 bg-[#141414] p-2.5"
        >
          <p className="font-semibold text-[#EF4444]">
            Validation Checks ({validationIssues.length})
          </p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-[#D4D4D4]">
            {validationIssues.map((issue, idx) => (
              <li key={`${issue.path}-${idx}`}>
                <span className="font-medium text-[#0F172A] dark:text-[#F0EDE6]">{issue.path}:</span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next step / guidance */}
      <div className="mt-3 border-t border-[#2A2A2A] pt-2.5">
        <p className="text-[11px] text-[#A3A3A3]">{preview.nextRecommendedStep}</p>
        {onSuggestCorrection && missingFields.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingFields.slice(0, 3).map((mf) => (
              <button
                key={mf.field}
                type="button"
                onClick={() =>
                  onSuggestCorrection(`Update the draft ${mf.label.toLowerCase()} to: `)
                }
                className="rounded-full border border-[#2A2A2A] bg-[#141414] px-2.5 py-1 text-[10px] text-[#C8F55A] transition-colors hover:border-[#C8F55A]"
              >
                + Set {mf.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Confirmed Created Event Banner */}
      {confirmedEventResult && (
        <div
          data-testid="confirmed-event-banner"
          className="mt-3 rounded-lg border border-[#C8F55A]/50 bg-[#C8F55A]/10 p-3 text-[#0F172A] dark:text-[#F0EDE6]"
        >
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#C8F55A]" />
            <span className="font-semibold text-[#C8F55A]">Event Created Live</span>
          </div>
          <p className="mt-1 text-[11px] text-[#0F172A] dark:text-[#F0EDE6]">
            <strong>{confirmedEventResult.title}</strong> has been created.
          </p>
          {confirmedEventResult.sideEffectsDeliveryStatus &&
            (confirmedEventResult.sideEffectsDeliveryStatus === "PARTIALLY_DISPATCHED" ||
              confirmedEventResult.sideEffectsDeliveryStatus === "FAILED") && (
              <p
                data-testid="side-effects-warning"
                className="mt-1.5 text-[10px] text-[#F59E0B]"
              >
                Note: Some background notifications could not be immediately delivered and may be delayed.
              </p>
            )}
          <a
            href={`/dashboard/events/${confirmedEventResult.slug}`}
            className="mt-2 inline-block rounded-lg bg-[#C8F55A] px-3 py-1.5 font-semibold text-black transition-colors hover:bg-[#b2df48]"
          >
            Manage in Dashboard →
          </a>
        </div>
      )}

      {/* Cancelled Proposal Notice */}
      {!confirmedEventResult && proposalStatus === "CANCELLED" && (
        <div
          data-testid="proposal-cancelled-banner"
          className="mt-3 rounded-lg border border-[#3A3A3A] bg-[#141414] p-2.5 text-center text-[11px] text-[#A3A3A3]"
        >
          This event creation proposal was cancelled. Submit a new message to draft another event.
        </div>
      )}

      {/* Expired Proposal Notice */}
      {!confirmedEventResult && proposalStatus === "EXPIRED" && (
        <div
          data-testid="proposal-expired-banner"
          className="mt-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-2.5 text-center text-[11px] text-[#F59E0B]"
        >
          This confirmation proposal has expired. Please request a fresh preview to confirm.
        </div>
      )}

      {/* Execution Failed Notice */}
      {!confirmedEventResult && proposalStatus === "FAILED" && (
        <div
          data-testid="proposal-failed-banner"
          className="mt-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-2.5 text-center text-[11px] text-[#EF4444]"
        >
          Event creation failed. Please check your workspace permissions or retry with updated details.
        </div>
      )}

      {/* Confirmation & Cancellation Actions */}
      {!confirmedEventResult &&
        proposalStatus !== "CANCELLED" &&
        proposalStatus !== "EXPIRED" &&
        proposalStatus !== "COMPLETED" &&
        proposalId &&
        idempotencyKey &&
        onConfirmCreation && (
        <div
          data-testid="draft-confirmation-actions"
          className="mt-3 border-t border-[#2A2A2A] pt-3"
        >
          {errorMessage && (
            <p className="mb-2 text-[11px] text-[#EF4444]" data-testid="draft-confirmation-error">
              {errorMessage}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isConfirming || !preview.schemaValid}
              onClick={() => void onConfirmCreation(proposalId, idempotencyKey)}
              className="flex-1 rounded-lg bg-[#C8F55A] py-2 text-center text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              data-testid="confirm-event-creation-btn"
            >
              {isConfirming ? "Creating Event..." : "Confirm & Create Event"}
            </button>
            {onCancelProposal && (
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => void onCancelProposal(proposalId)}
                className="rounded-lg border border-[#3A3A3A] bg-[#141414] px-3 py-2 text-xs font-medium text-[#A3A3A3] transition-colors hover:border-[#EF4444] hover:text-[#EF4444] disabled:opacity-40"
                data-testid="cancel-event-proposal-btn"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
