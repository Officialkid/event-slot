"use client"

import { useEffect, useMemo, useState } from "react"

type BadgeKey = "PIONEER" | "GROWTH_BUILDER" | "COMMUNITY_CHAMPION" | "HALL_OF_FAME"
type LeaderboardPeriod = "weekly" | "monthly" | "alltime"
type ReferralStatus = "SIGNED_UP" | "EVENT_CREATED"

interface ReferralStats {
  totalReferrals: number
  completedReferrals: number
  pendingReferrals: number
  totalTokensEarned: number
  currentBalance: number
}

interface ReferralItem {
  id: string
  label: string
  status: ReferralStatus
  earned: number
  signedUpAt: string
  eventCreatedAt: string | null
}

interface ReferralResponse {
  referralUrl: string
  stats: ReferralStats
  referrals: ReferralItem[]
}

interface BadgesResponse {
  badges: BadgeKey[]
  hasPioneer: boolean
}

interface LeaderboardItem {
  rank: number
  name: string
  avatar: string | null
  score: number
  isPioneer: boolean
  badges: BadgeKey[]
}

interface LeaderboardResponse {
  period: LeaderboardPeriod
  top10: LeaderboardItem[]
  ownRank: number | null
  ownScore: number | null
}

const BADGE_META: Record<BadgeKey, { icon: string; label: string; description: string }> = {
  PIONEER: {
    icon: "🏆",
    label: "EventSlot Pioneer",
    description: "One of EventSlot's first 150 supporters",
  },
  GROWTH_BUILDER: {
    icon: "🚀",
    label: "Growth Builder",
    description: "5 successful referrals who created events",
  },
  COMMUNITY_CHAMPION: {
    icon: "🔥",
    label: "Community Champion",
    description: "Appeared in the weekly top 10",
  },
  HALL_OF_FAME: {
    icon: "👑",
    label: "Hall of Fame",
    description: "Finished in the top 3 on the weekly leaderboard",
  },
}

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  weekly: "This Week",
  monthly: "This Month",
  alltime: "All Time",
}

export default function CommunityPage() {
  const [referralData, setReferralData] = useState<ReferralResponse | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null)
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly")
  const [badges, setBadges] = useState<BadgeKey[]>([])
  const [hasPioneer, setHasPioneer] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadBase() {
      try {
        const [refRes, badgeRes] = await Promise.all([
          fetch("/api/user/referrals"),
          fetch("/api/user/badges"),
        ])

        const [refData, badgeData] = await Promise.all([
          refRes.json() as Promise<ReferralResponse>,
          badgeRes.json() as Promise<BadgesResponse>,
        ])

        if (cancelled) return

        if (refRes.ok) setReferralData(refData)
        if (badgeRes.ok) {
          setBadges(badgeData.badges ?? [])
          setHasPioneer(Boolean(badgeData.hasPioneer))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBase()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadLeaderboard() {
      const res = await fetch(`/api/community/leaderboard?period=${period}`)
      const data = (await res.json()) as LeaderboardResponse
      if (!cancelled && res.ok) {
        setLeaderboard(data)
      }
    }

    loadLeaderboard().catch(() => {
      if (!cancelled) setLeaderboard(null)
    })

    return () => {
      cancelled = true
    }
  }, [period])

  const referralUrl = referralData?.referralUrl ?? ""
  const visibleBadges = useMemo(
    () => badges.map((badge) => ({ key: badge, meta: BADGE_META[badge] })).filter((b) => Boolean(b.meta)),
    [badges]
  )

  async function copyLink() {
    if (!referralUrl) return
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function shareInvite() {
    if (!referralUrl) return
    const shareText = "Join me on EventSlot - the smart event registration platform built for Africa."
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join me on EventSlot",
          text: shareText,
          url: referralUrl,
        })
        return
      }
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore user-cancelled shares and clipboard errors.
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-white">Community</h1>
        <p className="text-sm text-[#525252]">
          Invite others, earn tokens, and build your place in the EventSlot community.
        </p>
      </div>

      {hasPioneer && (
        <div className="flex items-center gap-4 rounded-xl border border-[#C8F55A]/30 bg-gradient-to-r from-[#C8F55A]/10 to-[#C8F55A]/5 p-5">
          <span className="text-4xl">🏆</span>
          <div>
            <p className="text-sm font-bold text-[#C8F55A]">EventSlot Pioneer</p>
            <p className="mt-0.5 text-xs text-[#A3A3A3]">
              You are one of EventSlot&apos;s earliest supporters. This badge belongs to a limited group - and you&apos;re in it.
            </p>
          </div>
        </div>
      )}

      {visibleBadges.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-white">Your Badges</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleBadges.map(({ key, meta }) => (
              <div key={key} className="flex items-start gap-3 rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-white">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-[#525252]">{meta.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#C8F55A]">Invite &amp; Earn</p>
        <p className="mb-4 text-sm text-[#A3A3A3]">
          Earn <span className="font-semibold text-white">5 tokens</span> when someone signs up, and{" "}
          <span className="font-semibold text-white">+5 tokens</span> when they create their first event. Invite 2 people who create
          events - your first AI report is free.
        </p>

        <div className="mb-3 flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-3">
          <span className="flex-1 truncate text-xs text-[#A3A3A3]">{referralUrl || (loading ? "Loading..." : "Unavailable")}</span>
          <button onClick={copyLink} className="ml-3 shrink-0 text-xs font-semibold text-[#C8F55A]" type="button">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <button
          onClick={() => {
            void shareInvite()
          }}
          className="w-full rounded-lg bg-[#C8F55A] py-2.5 text-xs font-bold text-black transition-opacity hover:opacity-90"
          type="button"
        >
          Share invite
        </button>

        {referralData?.stats && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Referred", value: referralData.stats.totalReferrals },
              { label: "Completed", value: referralData.stats.completedReferrals },
              { label: "Tokens Earned", value: referralData.stats.totalTokensEarned },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-[#0A0A0A] p-3 text-center">
                <p className="text-xl font-bold text-[#C8F55A]">{stat.value}</p>
                <p className="mt-0.5 text-xs text-[#525252]">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {referralData?.referrals?.length ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-white">Your referrals</p>
            <div className="space-y-2">
              {referralData.referrals.map((referral) => (
                <div key={referral.id} className="flex items-center justify-between rounded-lg bg-[#0A0A0A] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{referral.status === "EVENT_CREATED" ? "✅" : "⏳"}</span>
                    <span className="text-xs text-white">{referral.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-[#C8F55A]">+{referral.earned} tokens</span>
                    <p className="text-xs text-[#525252]">
                      {referral.status === "EVENT_CREATED" ? "Complete" : "Waiting for first event"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Leaderboard</p>
          <div className="flex gap-1">
            {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map((key) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-lg px-3 py-1 text-xs transition-colors ${
                  period === key ? "bg-[#C8F55A] font-bold text-black" : "text-[#525252] hover:text-[#A3A3A3]"
                }`}
                type="button"
              >
                {PERIOD_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {leaderboard?.ownRank ? (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-[#C8F55A]/20 bg-[#C8F55A]/10 px-4 py-2.5">
            <span className="text-sm font-semibold text-[#C8F55A]">Your rank: #{leaderboard.ownRank}</span>
            <span className="text-xs text-[#A3A3A3]">{leaderboard.ownScore ?? 0} points</span>
          </div>
        ) : null}

        <div className="space-y-2">
          {leaderboard?.top10?.map((entry) => (
            <div key={entry.rank} className="flex items-center gap-3 rounded-lg bg-[#0A0A0A] px-3 py-2.5">
              <span
                className={`w-6 text-center text-sm font-bold ${
                  entry.rank === 1
                    ? "text-[#FFD700]"
                    : entry.rank === 2
                    ? "text-[#C0C0C0]"
                    : entry.rank === 3
                    ? "text-[#CD7F32]"
                    : "text-[#525252]"
                }`}
              >
                {entry.rank === 1 ? "👑" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
              </span>

              <span className="flex flex-1 items-center gap-2 text-sm text-white">
                {entry.name}
                {entry.isPioneer ? <span title="EventSlot Pioneer">🏆</span> : null}
              </span>

              <span className="text-xs text-[#A3A3A3]">{entry.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
