"use client"

import { useEffect, useState } from "react"

type FeedbackData = {
  totalFeedback: number
  averageRating: number
  ratingDistribution: { stars: number; count: number }[]
  recentComments: { rating: number; comment: string; createdAt: string }[]
}

export default function FeedbackPage() {
  const [data, setData] = useState<FeedbackData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/feedback")
      .then((r) => r.json())
      .then((d) => {
        const source = d?.assistantFeedback ?? d
        setData({
          totalFeedback: Number(source?.totalFeedback ?? 0),
          averageRating: Number(source?.averageRating ?? 0),
          ratingDistribution: Array.isArray(source?.ratingDistribution)
            ? source.ratingDistribution
            : [],
          recentComments: Array.isArray(source?.recentComments)
            ? source.recentComments.filter(
                (c: { comment?: string | null }) => typeof c.comment === "string" && c.comment.trim().length > 0,
              )
            : [],
        })
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const STARS = ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"]

  if (loading) return <div className="p-8 text-[#525252]">Loading...</div>
  if (!data) return <div className="p-8 text-red-400">Failed to load.</div>

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-white font-bold text-2xl mb-2">Assistant Feedback</h1>
      <p className="text-[#525252] text-sm mb-8">User ratings from session limit prompts</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="border border-[#2A2A2A] rounded-xl p-5 bg-[#141414]">
          <p className="text-[#525252] text-xs uppercase tracking-wider mb-3">Average Rating</p>
          <p className="text-[#C8F55A] text-4xl font-bold">{data.averageRating}</p>
          <p className="text-[#525252] text-xs mt-1">out of 5</p>
        </div>
        <div className="border border-[#2A2A2A] rounded-xl p-5 bg-[#141414]">
          <p className="text-[#525252] text-xs uppercase tracking-wider mb-3">Total Ratings</p>
          <p className="text-white text-4xl font-bold">{data.totalFeedback}</p>
        </div>
        <div className="border border-[#2A2A2A] rounded-xl p-5 bg-[#141414]">
          <p className="text-[#525252] text-xs uppercase tracking-wider mb-3">Distribution</p>
          {data.ratingDistribution.map((r) => (
            <div key={r.stars} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[#525252] w-7">{r.stars}★</span>
              <div className="flex-1 bg-[#0A0A0A] rounded h-1.5">
                <div
                  className="bg-[#C8F55A] h-1.5 rounded"
                  style={{
                    width:
                      data.totalFeedback > 0
                        ? `${(r.count / data.totalFeedback) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <span className="text-xs text-[#525252] w-4">{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-white font-semibold mb-4">Recent Comments</h2>
      {data.recentComments.length === 0 ? (
        <p className="text-[#525252] text-sm">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {data.recentComments.map((c, i) => (
            <div key={i} className="border border-[#2A2A2A] rounded-xl p-4 bg-[#141414]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{STARS[c.rating - 1] ?? "⭐"}</span>
                <span className="text-[#525252] text-xs">
                  {new Date(c.createdAt).toLocaleDateString("en-KE")}
                </span>
              </div>
              <p className="text-[#A3A3A3] text-sm">{c.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
