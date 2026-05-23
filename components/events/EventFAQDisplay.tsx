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
        <h3 className="text-[#F0EDE6] font-semibold text-sm">Frequently Asked Questions</h3>
      </div>

      {faqs.map((faq) => (
        <div
          key={faq.id}
          className="border border-[rgba(240,237,230,0.08)] rounded-[8px] overflow-hidden"
        >
          <button
            onClick={() => setOpen(open === faq.id ? null : faq.id)}
            className="w-full flex items-center justify-between px-4 py-3
                       text-left hover:bg-[rgba(240,237,230,0.03)] transition-colors"
          >
            <span className="text-[#F0EDE6] text-sm font-medium pr-4">{faq.question}</span>
            {open === faq.id ? (
              <ChevronUp className="w-4 h-4 text-[#C8F55A] shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[rgba(240,237,230,0.35)] shrink-0" />
            )}
          </button>

          {open === faq.id && (
            <div className="px-4 pb-4 border-t border-[rgba(240,237,230,0.08)]">
              <p className="text-[rgba(240,237,230,0.6)] text-sm leading-relaxed pt-3">
                {faq.answer}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
