"use client"

import { getBillingNoticeCopy, type BillingNoticeContext } from "@/lib/billingNotice"

type BillingPausedNoticeProps = {
  context: BillingNoticeContext
  compact?: boolean
}

export function BillingPausedNotice({ context, compact = false }: BillingPausedNoticeProps) {
  const copy = getBillingNoticeCopy(context)

  return (
    <div
      className={compact ? "rounded-[16px] px-4 py-3.5" : "rounded-[22px] px-5 py-5"}
      style={{
        border: "1px solid color-mix(in srgb, var(--warning) 28%, transparent)",
        background: "color-mix(in srgb, var(--warning) 10%, var(--surface) 90%)",
      }}
    >
      <p
        className={compact ? "text-[0.68rem] font-semibold uppercase tracking-[0.12em]" : "text-[0.72rem] font-semibold uppercase tracking-[0.12em]"}
        style={{ color: "var(--warning)" }}
      >
        {copy.eyebrow}
      </p>
      <p
        className={compact ? "mt-1.5 text-[0.88rem] font-semibold" : "mt-2 text-[0.96rem] font-semibold"}
        style={{ color: "var(--text-primary)" }}
      >
        {copy.headline}
      </p>
      <p
        className={compact ? "mt-1.5 text-[0.78rem] leading-6" : "mt-2 text-[0.82rem] leading-7"}
        style={{ color: "var(--text-secondary)" }}
      >
        {copy.body}
      </p>
    </div>
  )
}
