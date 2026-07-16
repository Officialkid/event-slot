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
    <div className="space-y-5 rounded-xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Frequently Asked Questions</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Help attendees get answers before contacting you
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-[#C8F55A]' : ''}`}
          style={enabled ? undefined : { background: 'var(--border)' }}
          aria-label={enabled ? 'Disable FAQ' : 'Enable FAQ'}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
            style={{ background: 'var(--text-secondary)' }}
          />
        </button>
      </div>

      {enabled && (
        <>
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-[#C8F55A]" />
                <p className="text-xs font-semibold uppercase tracking-wider text-[#C8F55A]">
                  Suggested Questions
                </p>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Click to add - just fill in the answer
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.question}
                    type="button"
                    onClick={() => addSuggestion(s.question)}
                    className="rounded-full border px-3 py-1.5 text-left text-xs transition-colors hover:border-[rgba(200,245,90,0.4)] hover:text-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    + {s.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {faqs.length > 0 && (
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-[8px] border p-4"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}
                >
                  <div className="flex items-start gap-2">
                    <input
                      value={faq.question}
                      onChange={(e) => update(i, 'question', e.target.value)}
                      placeholder="Question"
                      className="flex-1 border-b bg-transparent pb-1 text-sm font-medium outline-none placeholder:text-[var(--text-muted)] transition-colors focus:border-[rgba(200,245,90,0.5)]"
                      style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                    />
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="mt-0.5 shrink-0 transition-colors hover:text-[#FF6B6B]"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label="Remove question"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={faq.answer}
                    onChange={(e) => update(i, 'answer', e.target.value)}
                    placeholder="Answer"
                    rows={2}
                    className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addBlank}
            className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-dashed py-2.5 text-sm transition-colors hover:border-[rgba(200,245,90,0.3)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <Plus className="h-4 w-4" /> Add custom question
          </button>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full rounded-[8px] bg-[#C8F55A] py-2.5 text-sm font-bold text-black transition-colors hover:bg-[#b8e040] disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save FAQ'}
          </button>
        </>
      )}
    </div>
  )
}
