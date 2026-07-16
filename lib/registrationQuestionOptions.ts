type EventQuestionOption = {
  label: string
  limit?: number | null
}

type EventQuestion = {
  id: string
  type: string
  options?: string[]
  optionLimits?: Record<string, number | null | undefined>
}

type RegistrationAnswer = {
  questionId: string
  value: string
}

type RegistrationRecord = {
  answers: RegistrationAnswer[]
}

function parseCheckboxValue(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return raw.split("|").map((value) => value.trim()).filter(Boolean)
  }
  return []
}

export function normalizeQuestionOptions(question: EventQuestion): EventQuestionOption[] {
  return (question.options ?? [])
    .map((label) => {
      const rawLimit = question.optionLimits?.[label]
      const normalizedLimit =
        typeof rawLimit === "number" && Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.floor(rawLimit)
          : null
      return { label, limit: normalizedLimit }
    })
}

export function getOptionLimitMap(question: EventQuestion): Record<string, number> {
  return normalizeQuestionOptions(question).reduce<Record<string, number>>((acc, option) => {
    if (typeof option.limit === "number" && option.limit > 0) {
      acc[option.label] = option.limit
    }
    return acc
  }, {})
}

export function getOptionUsageCounts(question: EventQuestion, registrations: RegistrationRecord[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const registration of registrations) {
    const answer = registration.answers.find((item) => item.questionId === question.id)?.value
    if (!answer) continue

    const selectedValues =
      question.type === "checkbox"
        ? parseCheckboxValue(answer)
        : [answer]

    for (const value of selectedValues) {
      if (!value) continue
      counts[value] = (counts[value] ?? 0) + 1
    }
  }
  return counts
}

export function getFullOptions(question: EventQuestion, registrations: RegistrationRecord[]): string[] {
  const limits = getOptionLimitMap(question)
  if (Object.keys(limits).length === 0) return []

  const usage = getOptionUsageCounts(question, registrations)
  return Object.entries(limits)
    .filter(([label, limit]) => (usage[label] ?? 0) >= limit)
    .map(([label]) => label)
}
