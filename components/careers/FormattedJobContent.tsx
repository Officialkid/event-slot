import React from "react"

interface FormattedJobContentProps {
  content?: string | null
  className?: string
}

/**
 * FormattedJobContent
 * Renders job descriptions, responsibilities, and qualifications cleanly without
 * exposing raw AI/markdown artifacts such as `###`, `**`, or raw bullet asterisks.
 */
export function FormattedJobContent({ content, className = "" }: FormattedJobContentProps) {
  if (!content || !content.trim()) return null

  // Split content into paragraphs or list blocks
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []

  let currentList: { ordered: boolean; items: string[] } | null = null

  const flushList = (key: string | number) => {
    if (!currentList || currentList.items.length === 0) return
    if (currentList.ordered) {
      elements.push(
        <ol key={`ol-${key}`} className="space-y-2.5 my-3 pl-1">
          {currentList.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#374151]">
              <span className="font-semibold text-[#15803D] shrink-0 text-xs mt-0.5 min-w-[1.25rem]">
                {i + 1}.
              </span>
              <span className="flex-1">{renderInlineStyles(item)}</span>
            </li>
          ))}
        </ol>
      )
    } else {
      elements.push(
        <ul key={`ul-${key}`} className="space-y-2.5 my-3 pl-1">
          {currentList.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#374151]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#15803D] mt-2 shrink-0" />
              <span className="flex-1">{renderInlineStyles(item)}</span>
            </li>
          ))}
        </ul>
      )
    }
    currentList = null
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()

    if (!line) {
      flushList(idx)
      return
    }

    // Heading: ### Heading or ## Heading or # Heading
    if (/^#{1,6}\s+/.test(line)) {
      flushList(idx)
      const headingText = line.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "")
      elements.push(
        <h4
          key={`h-${idx}`}
          className="text-base font-bold text-[#0A0A0A] mt-6 mb-2 tracking-tight first:mt-0"
        >
          {headingText}
        </h4>
      )
      return
    }

    // Numbered list item: e.g. "1. **Record-keeping:** Maintain..." or "1. Record..."
    const orderedMatch = line.match(/^\d+[\.\)]\s+(.*)/)
    if (orderedMatch) {
      if (!currentList || !currentList.ordered) {
        flushList(idx)
        currentList = { ordered: true, items: [] }
      }
      currentList.items.push(orderedMatch[1])
      return
    }

    // Bullet list item: e.g. "- Item" or "* Item"
    const bulletMatch = line.match(/^[-*•]\s+(.*)/)
    if (bulletMatch) {
      if (!currentList || currentList.ordered) {
        flushList(idx)
        currentList = { ordered: false, items: [] }
      }
      currentList.items.push(bulletMatch[1])
      return
    }

    // Regular paragraph
    flushList(idx)
    elements.push(
      <p key={`p-${idx}`} className="text-sm leading-relaxed text-[#374151] my-2.5">
        {renderInlineStyles(line)}
      </p>
    )
  })

  flushList("final")

  return <div className={`space-y-1 ${className}`}>{elements}</div>
}

/**
 * Parses inline bold markdown `**text**` and renders clean `<strong>` tags
 * while removing any unclosed or dangling asterisks.
 */
function renderInlineStyles(text: string): React.ReactNode {
  // Replace raw markdown bold **word** with styled bold elements
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.*?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleanText(text.substring(lastIndex, match.index)))
    }
    parts.push(
      <strong key={match.index} className="font-semibold text-[#0A0A0A]">
        {cleanText(match[1])}
      </strong>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(cleanText(text.substring(lastIndex)))
  }

  return parts.length > 0 ? parts : cleanText(text)
}

function cleanText(raw: string): string {
  // Clean up any stray markdown syntax characters like double asterisks or leading hash symbols
  return raw.replace(/[*#]/g, "")
}
