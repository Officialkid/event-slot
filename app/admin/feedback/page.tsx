"use client"

import { useEffect, useState } from "react"

type OrganizerFeedbackItem = {
  id: string
  type: string
  subject: string
  message: string
  rating: number | null
  status: string
  createdAt: string
  organizer: {
    id: string
    name: string | null
    email: string | null
  }
}

type FeedbackData = {
  items: OrganizerFeedbackItem[]
  total: number
  unreadCount: number
  totalFeedback: number
  averageRating: number
  ratingDistribution: { stars: number; count: number }[]
  recentComments: { rating: number; comment: string; createdAt: string }[]
}

const STARS = ["*", "**", "***", "****", "*****"]

export default function FeedbackPage() {
  const [data, setData] = useState<FeedbackData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/feedback", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const assistantFeedback = d?.assistantFeedback ?? {}
        setData({
          items: Array.isArray(d?.items) ? d.items : [],
          total: Number(d?.total ?? 0),
          unreadCount: Number(d?.unreadCount ?? 0),
          totalFeedback: Number(assistantFeedback?.totalFeedback ?? 0),
          averageRating: Number(assistantFeedback?.averageRating ?? 0),
          ratingDistribution: Array.isArray(assistantFeedback?.ratingDistribution)
            ? assistantFeedback.ratingDistribution
            : [],
          recentComments: Array.isArray(assistantFeedback?.recentComments)
            ? assistantFeedback.recentComments.filter(
                (comment: { comment?: string | null }) =>
                  typeof comment.comment === "string" && comment.comment.trim().length > 0,
              )
            : [],
        })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl animate-pulse space-y-4">
        <div className="h-6 w-56 rounded bg-[var(--bg-elevated)]" />
        <div className="h-4 w-72 rounded bg-[var(--bg-elevated)]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)] space-y-3">
              <div className="h-3 w-24 rounded bg-[var(--bg-elevated)]" />
              <div className="h-8 w-24 rounded bg-[var(--bg-elevated)]" />
              <div className="h-3 w-20 rounded bg-[var(--bg-elevated)]" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="p-8 text-red-400">Failed to load.</div>
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-white font-bold text-2xl mb-2">Org Feedback</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">Organizer feedback inbox plus assistant rating signals.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)]">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Organizer Feedback</p>
          <p className="text-white text-4xl font-bold">{data.total}</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">total submissions</p>
        </div>
        <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)]">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Unread</p>
          <p className="text-[#C8F55A] text-4xl font-bold">{data.unreadCount}</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">need review</p>
        </div>
        <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)]">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Assistant Ratings</p>
          <p className="text-white text-4xl font-bold">{data.totalFeedback}</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">total responses</p>
        </div>
      </div>

      <h2 className="text-white font-semibold mb-4">Organizer Inbox</h2>
      {data.items.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm mb-8">No organizer feedback yet.</p>
      ) : (
        <div className="space-y-3 mb-8">
          {data.items.map((item) => (
            <div key={item.id} className="border border-[var(--border)] rounded-xl p-4 bg-[var(--surface)]">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1 text-[var(--accent)] uppercase">
                  {item.type}
                </span>
                <span className="text-xs rounded-full border border-[var(--border)] px-2 py-1 text-[var(--text-secondary)] uppercase">
                  {item.status}
                </span>
                {typeof item.rating === "number" && (
                  <span className="text-xs text-[var(--text-secondary)]">{item.rating}/5</span>
                )}
                <span className="ml-auto text-xs text-[var(--text-muted)]">
                  {new Date(item.createdAt).toLocaleDateString("en-KE")}
                </span>
              </div>
              <h3 className="text-white font-medium mb-1">{item.subject}</h3>
              <p className="text-[var(--text-secondary)] text-sm mb-2 whitespace-pre-wrap">{item.message}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {item.organizer.name ?? "Anonymous organizer"}
                {item.organizer.email ? ` - ${item.organizer.email}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-white font-semibold mb-4">Assistant Feedback</h2>
      <p className="text-[var(--text-muted)] text-sm mb-6">User ratings from session limit prompts</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)]">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Average Rating</p>
          <p className="text-[#C8F55A] text-4xl font-bold">{data.averageRating}</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">out of 5</p>
        </div>
        <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)]">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Total Ratings</p>
          <p className="text-white text-4xl font-bold">{data.totalFeedback}</p>
        </div>
        <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)]">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Distribution</p>
          {data.ratingDistribution.map((rating) => (
            <div key={rating.stars} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[var(--text-muted)] w-10">{rating.stars}/5</span>
              <div className="flex-1 bg-[var(--bg-input)] rounded h-1.5">
                <div
                  className="bg-[#C8F55A] h-1.5 rounded"
                  style={{
                    width: data.totalFeedback > 0 ? `${(rating.count / data.totalFeedback) * 100}%` : "0%",
                  }}
                />
              </div>
              <span className="text-xs text-[var(--text-muted)] w-4">{rating.count}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-white font-semibold mb-4">Recent Assistant Comments</h2>
      {data.recentComments.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {data.recentComments.map((comment, index) => (
            <div key={index} className="border border-[var(--border)] rounded-xl p-4 bg-[var(--surface)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{STARS[comment.rating - 1] ?? "*"}</span>
                <span className="text-xs text-[var(--text-secondary)]">{comment.rating}/5</span>
                <span className="text-[var(--text-muted)] text-xs">
                  {new Date(comment.createdAt).toLocaleDateString("en-KE")}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] text-sm">{comment.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
