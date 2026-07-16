'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'

interface FAQ {
  id: string
  question: string
  answer: string
}

interface Props {
  faqs: FAQ[]
}

export function EventFAQDisplay({ faqs }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  if (!faqs?.length) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-4 h-4 text-[#C8F55A]" />
        <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Frequently Asked Questions</h3>
      </div>

      {faqs.map((faq) => (
        <div
          key={faq.id}
          className="border rounded-[8px] overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
        >
          <button
            onClick={() => setOpen(open === faq.id ? null : faq.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
            style={{ background: open === faq.id ? "var(--surface)" : "transparent" }}
          >
            <span className="text-sm font-medium pr-4" style={{ color: "var(--text-primary)" }}>{faq.question}</span>
            {open === faq.id ? (
              <ChevronUp className="w-4 h-4 text-[#C8F55A] shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            )}
          </button>

          {open === faq.id && (
            <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm leading-relaxed pt-3" style={{ color: "var(--text-secondary)" }}>
                {faq.answer}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
