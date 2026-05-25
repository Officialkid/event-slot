'use client'
import { useState, useEffect } from 'react'
import { Plus, Trash2, Lightbulb } from 'lucide-react'

interface FAQItem {
  id?: string
  question: string
  answer: string
  order: number
}

interface Props {
  eventSlug: string
}

export function EventFAQEditor({ eventSlug }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [faqs, setFaqs] = useState<FAQItem[]>([])
  const [suggestions, setSuggestions] = useState<{ question: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/events/${eventSlug}/faq?includeAll=1`).then((r) => r.json()),
      fetch(`/api/events/${eventSlug}/faq/suggestions`).then((r) => r.json()),
    ]).then(([faqData, suggestData]) => {
      setEnabled(faqData.enabled ?? false)
      setFaqs(faqData.faqs ?? [])
      const existing = new Set((faqData.faqs ?? []).map((f: FAQItem) => f.question))
      setSuggestions(
        (suggestData.suggestions ?? []).filter((s: { question: string }) => !existing.has(s.question))
      )
    })
  }, [eventSlug])

  const addSuggestion = (q: string) => {
    setFaqs((prev) => [...prev, { question: q, answer: '', order: prev.length }])
    setSuggestions((prev) => prev.filter((s) => s.question !== q))
  }

  const addBlank = () => {
    setFaqs((prev) => [...prev, { question: '', answer: '', order: prev.length }])
  }

  const update = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqs((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)))
  }

  const remove = (index: number) => {
    setFaqs((prev) => prev.filter((_, i) => i !== index))
  }

  const save = async () => {
    setSaving(true)
    await fetch(`/api/events/${eventSlug}/faq`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, faqs }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="border border-[#2A2A2A] rounded-xl p-6 bg-[#141414] space-y-5">
      {/* Toggle header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#F0EDE6] font-semibold text-sm">Frequently Asked Questions</p>
          <p className="text-[rgba(240,237,230,0.35)] text-xs mt-0.5">
            Help attendees get answers before contacting you
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            enabled ? 'bg-[#C8F55A]' : 'bg-[rgba(240,237,230,0.12)]'
          }`}
          aria-label={enabled ? 'Disable FAQ' : 'Enable FAQ'}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#A3A3A3] shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Suggested questions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-[#C8F55A]" />
                <p className="text-xs text-[#C8F55A] font-semibold uppercase tracking-wider">
                  Suggested Questions
                </p>
              </div>
              <p className="text-[rgba(240,237,230,0.35)] text-xs">
                Click to add — just fill in the answer
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.question}
                    type="button"
                    onClick={() => addSuggestion(s.question)}
                    className="text-xs px-3 py-1.5 rounded-full border border-[rgba(240,237,230,0.12)]
                               text-[rgba(240,237,230,0.55)] hover:border-[rgba(200,245,90,0.4)] hover:text-[#F0EDE6]
                               transition-colors text-left"
                  >
                    + {s.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FAQ items */}
          {faqs.length > 0 && (
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-[rgba(240,237,230,0.08)] rounded-[8px] p-4 space-y-3 bg-[#0A0A0A]"
                >
                  <div className="flex items-start gap-2">
                    <input
                      value={faq.question}
                      onChange={(e) => update(i, 'question', e.target.value)}
                      placeholder="Question"
                      className="flex-1 bg-transparent text-[#F0EDE6] text-sm font-medium
                                 placeholder:text-[rgba(240,237,230,0.25)] outline-none border-b
                                 border-[rgba(240,237,230,0.12)] pb-1 focus:border-[rgba(200,245,90,0.5)] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="text-[rgba(240,237,230,0.35)] hover:text-[#FF6B6B] transition-colors shrink-0 mt-0.5"
                      aria-label="Remove question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={faq.answer}
                    onChange={(e) => update(i, 'answer', e.target.value)}
                    placeholder="Answer"
                    rows={2}
                    className="w-full bg-transparent text-[rgba(240,237,230,0.6)] text-sm
                               placeholder:text-[rgba(240,237,230,0.25)] outline-none resize-none
                               focus:text-[#F0EDE6] transition-colors"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Add custom question */}
          <button
            type="button"
            onClick={addBlank}
            className="w-full flex items-center justify-center gap-2 py-2.5
                       border border-dashed border-[rgba(240,237,230,0.12)] rounded-[8px]
                       text-[rgba(240,237,230,0.35)] text-sm hover:border-[rgba(200,245,90,0.3)]
                       hover:text-[rgba(240,237,230,0.6)] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add custom question
          </button>

          {/* Save */}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full bg-[#C8F55A] text-black font-bold py-2.5 rounded-[8px]
                       hover:bg-[#b8e040] transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save FAQ'}
          </button>
        </>
      )}
    </div>
  )
}
