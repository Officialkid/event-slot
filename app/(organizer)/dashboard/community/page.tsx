"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"

type BadgeKey =
  | "PIONEER"
  | "GROWTH_BUILDER"
  | "COMMUNITY_CHAMPION"
  | "HALL_OF_FAME"
  | "STARRED_ORGANIZER"
  | "COMMUNITY_BUILDER"

type PeriodKey = "week" | "month" | "all-time"
type TypeKey = "overall" | "referral" | "organiser"
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

interface LeaderboardEntry {
  rank: number
  userId: string
  name: string | null
  avatar: string | null
  badges: BadgeKey[]
  referralPts: number
  organiserPts: number
  totalPts: number
}

interface LeaderboardResponse {
  period: string
  type: string
  entries: LeaderboardEntry[]
}

const EMPTY_REFERRAL_RESPONSE: ReferralResponse = {
  referralUrl: "",
  stats: {
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalTokensEarned: 0,
    currentBalance: 0,
  },
  referrals: [],
}

const EMPTY_LEADERBOARD_RESPONSE: LeaderboardResponse = {
  period: "all-time",
  type: "overall",
  entries: [],
}

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all-time", label: "All Time" },
]

const TYPE_TABS: { key: TypeKey; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "referral", label: "Top Referrers" },
  { key: "organiser", label: "Top Organisers" },
]

const MEDALS = ["🥇", "🥈", "🥉"]
const PODIUM_BORDER = [
  "border-[#FFD700]/40 bg-[#FFD700]/5",
  "border-[#C0C0C0]/40 bg-[#C0C0C0]/5",
  "border-[#CD7F32]/40 bg-[#CD7F32]/5",
]
const PODIUM_TEXT = ["text-[#FFD700]", "text-[#C0C0C0]", "text-[#CD7F32]"]

const communitySurface = "var(--surface)"
const communitySurfaceAlt = "var(--surface-2)"
const communityBorder = "var(--border)"
const communityBorderSoft = "var(--border-subtle)"
const communityTextPrimary = "var(--text-primary)"
const communityTextSecondary = "var(--text-secondary)"
const communityTextMuted = "var(--text-muted)"
const communityAccent = "var(--accent)"
const communityAccentContrast = "var(--accent-contrast, #0A0A0A)"

const BADGE_META: Record<BadgeKey, { icon: string; label: string; description: string }> = {
  PIONEER: {
    icon: "🏆",
    label: "EventSlot Pioneer",
    description: "One of EventSlot's earliest supporters",
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
  STARRED_ORGANIZER: {
    icon: "⭐",
    label: "Starred Organiser",
    description: "Recognised as a top event organiser",
  },
  COMMUNITY_BUILDER: {
    icon: "🌱",
    label: "Community Builder",
    description: "Actively growing the EventSlot community",
  },
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: communityTextMuted }}
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  )
}

function Avatar({ src, name, size = 8 }: { src: string | null; name: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full overflow-hidden shrink-0`

  return (
    <div className={cls} style={{ backgroundColor: communitySurfaceAlt }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-xs font-bold"
          style={{ color: communityTextPrimary }}
        >
          {name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}
    </div>
  )
}

export default function CommunityPage() {
  const { data: session } = useSession()
  const myId = session?.user?.id ?? null

  const [referralData, setReferralData] = useState<ReferralResponse | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null)
  const [badges, setBadges] = useState<BadgeKey[]>([])
  const [hasPioneer, setHasPioneer] = useState(false)
  const [period, setPeriod] = useState<PeriodKey>("week")
  const [type, setType] = useState<TypeKey>("overall")
  const [copied, setCopied] = useState(false)
  const [loadingBase, setLoadingBase] = useState(true)

  async function readJsonSafe<T>(res: Response, fallback: T): Promise<T> {
    try {
      const text = await res.text()
      if (!text) return fallback
      return JSON.parse(text) as T
    } catch {
      return fallback
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [refRes, badgeRes] = await Promise.all([
          fetch("/api/user/referrals"),
          fetch("/api/user/badges"),
        ])
        const [refData, badgeData] = await Promise.all([
          readJsonSafe<ReferralResponse>(refRes, EMPTY_REFERRAL_RESPONSE),
          readJsonSafe<BadgesResponse>(badgeRes, { badges: [], hasPioneer: false }),
        ])

        if (cancelled) return
        setReferralData(refData)

        if (badgeRes.ok) {
          setBadges(badgeData.badges ?? [])
          setHasPioneer(Boolean(badgeData.hasPioneer))
        } else {
          setBadges([])
          setHasPioneer(false)
        }
      } catch {
        if (cancelled) return
        setReferralData(EMPTY_REFERRAL_RESPONSE)
        setBadges([])
        setHasPioneer(false)
      } finally {
        if (!cancelled) setLoadingBase(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/leaderboard?period=${period}&type=${type}`)
        const data = await readJsonSafe<LeaderboardResponse>(res, EMPTY_LEADERBOARD_RESPONSE)
        if (!cancelled) {
          setLeaderboard(res.ok ? data : EMPTY_LEADERBOARD_RESPONSE)
        }
      } catch {
        if (!cancelled) setLeaderboard(EMPTY_LEADERBOARD_RESPONSE)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [period, type])

  const referralUrl = referralData?.referralUrl ?? ""
  const visibleBadges = useMemo(
    () =>
      badges
        .map((badge) => ({ key: badge, meta: BADGE_META[badge] }))
        .filter((badge) => Boolean(badge.meta)),
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

    const message = `Join EventSlot - the smartest way to organise events. Sign up here: ${referralUrl}`

    try {
      if (navigator.share) {
        await navigator.share({ text: message })
      } else {
        await navigator.clipboard.writeText(message)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // User cancelled sharing or clipboard access was unavailable.
    }
  }

  function score(entry: LeaderboardEntry) {
    if (type === "referral") return entry.referralPts
    if (type === "organiser") return entry.organiserPts
    return entry.totalPts
  }

  const top3 = leaderboard?.entries?.slice(0, 3) ?? []
  const rest = leaderboard?.entries?.slice(3) ?? []

  if (loadingBase && !referralData) {
    return (
      <div className="max-w-2xl mx-auto p-5 space-y-3 animate-pulse">
        <div className="h-4 rounded-full w-3/4" style={{ backgroundColor: communitySurfaceAlt }} />
        <div className="h-4 rounded-full w-1/2" style={{ backgroundColor: communitySurfaceAlt }} />
        <div
          className="h-40 border rounded-2xl"
          style={{ backgroundColor: communitySurface, borderColor: communityBorder }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-6">
      {hasPioneer && (
        <div
          className="flex items-center gap-4 flex-wrap rounded-xl border bg-gradient-to-r p-5"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
            backgroundImage:
              "linear-gradient(to right, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))",
          }}
        >
          <span className="text-4xl">🏆</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: communityAccent }}>EventSlot Pioneer</p>
            <p className="mt-0.5 text-xs" style={{ color: communityTextSecondary }}>
              You are one of EventSlot&apos;s earliest supporters. This badge belongs to a limited group and you&apos;re in it.
            </p>
          </div>
        </div>
      )}

      {visibleBadges.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold" style={{ color: communityTextPrimary }}>
            Your Badges
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleBadges.map(({ key, meta }) => (
              <div
                key={key}
                className="flex items-start gap-3 rounded-xl border p-4"
                style={{ borderColor: communityBorderSoft, backgroundColor: communitySurface }}
              >
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: communityTextPrimary }}>
                    {meta.label}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: communityTextMuted }}>
                    {meta.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="border rounded-2xl p-5"
        style={{ borderColor: communityBorder, backgroundColor: communitySurface }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: communityAccent }}>Invite &amp; Earn</p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: communityTextSecondary }}>
          Earn <span className="font-bold" style={{ color: communityTextPrimary }}>5 tokens</span> when someone signs up, and{" "}
          <span className="font-bold" style={{ color: communityTextPrimary }}>+5 tokens</span> when they create their first event.
          Invite 2 people who create events and your first AI report is free.
        </p>

        <div
          className="flex items-center gap-2 flex-wrap border rounded-xl px-4 py-3 mb-3"
          style={{ backgroundColor: communitySurfaceAlt, borderColor: communityBorderSoft }}
        >
          <span className="text-xs flex-1 min-w-0 truncate" style={{ color: communityTextSecondary }}>
            {referralUrl || (loadingBase ? "Loading..." : "Unavailable")}
          </span>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="text-xs font-semibold shrink-0 hover:text-white transition-colors"
            style={{ color: communityAccent }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => void shareInvite()}
          data-tutorial="community-share-invite"
          className="w-full font-bold py-3 rounded-xl hover:bg-[#b8e040] transition-colors flex items-center justify-center gap-2"
          style={{ backgroundColor: communityAccent, color: communityAccentContrast }}
        >
          <ShareIcon /> Share Invite
        </button>

        {referralData?.stats && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Referred", value: referralData.stats.totalReferrals },
              { label: "Completed", value: referralData.stats.completedReferrals },
              { label: "Tokens Earned", value: referralData.stats.totalTokensEarned },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border rounded-xl p-3 text-center"
                style={{ backgroundColor: communitySurfaceAlt, borderColor: communityBorderSoft }}
              >
                <p className="font-bold text-2xl" style={{ color: communityAccent }}>{stat.value}</p>
                <p className="text-xs mt-0.5" style={{ color: communityTextMuted }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {referralData?.referrals?.length ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium" style={{ color: communityTextPrimary }}>
              Your referrals
            </p>
            <div className="space-y-2">
              {referralData.referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ backgroundColor: communitySurfaceAlt }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{referral.status === "EVENT_CREATED" ? "✅" : "⏳"}</span>
                    <span className="text-xs" style={{ color: communityTextPrimary }}>
                      {referral.label}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold" style={{ color: communityAccent }}>+{referral.earned} tokens</span>
                    <p className="text-xs" style={{ color: communityTextMuted }}>
                      {referral.status === "EVENT_CREATED" ? "Complete" : "Waiting for first event"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="border rounded-2xl overflow-hidden"
        style={{ borderColor: communityBorder, backgroundColor: communitySurface }}
      >
        <div className="flex border-b" style={{ borderColor: communityBorder }}>
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setPeriod(tab.key)}
              className="flex-1 py-3 text-sm font-medium transition-colors border-b-2"
              style={
                period === tab.key
                  ? { color: communityAccent, borderColor: communityAccent }
                  : { color: communityTextMuted, borderColor: "transparent" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap p-3 border-b" style={{ borderColor: communityBorder }}>
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setType(tab.key)}
              className="flex-1 min-w-[92px] py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={
                type === tab.key
                  ? { backgroundColor: communityAccent, color: communityAccentContrast }
                  : { backgroundColor: communitySurfaceAlt, color: communityTextMuted }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {top3.length > 0 && (
          <div className="p-4 space-y-2">
            {top3.map((entry, index) => (
              <div
                key={entry.userId}
                className={`flex items-center gap-3 p-3 rounded-xl border ${PODIUM_BORDER[index]}`}
              >
                <span className="text-2xl w-8 text-center">{MEDALS[index]}</span>
                <Avatar src={entry.avatar} name={entry.name} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: communityTextPrimary }}>
                    {entry.name ?? "Unknown"}
                    {entry.userId === myId && <span className="text-xs ml-2" style={{ color: communityAccent }}>(you)</span>}
                  </p>
                  <p className="text-xs" style={{ color: communityTextMuted }}>
                    Ref: {entry.referralPts}pts · Events: {entry.organiserPts}pts
                  </p>
                </div>
                <span className={`font-bold text-sm ${PODIUM_TEXT[index]}`}>{score(entry)} pts</span>
              </div>
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <div className="border-t" style={{ borderColor: communityBorder }}>
            {rest.map((entry, index) => (
              <div
                key={entry.userId}
                className="flex items-center gap-3 px-4 py-3 border-b transition-colors"
                style={{
                  borderColor: communityBorderSoft,
                  backgroundColor:
                    entry.userId === myId
                      ? "color-mix(in srgb, var(--accent) 5%, transparent)"
                      : undefined,
                  borderLeftWidth: entry.userId === myId ? "2px" : undefined,
                  borderLeftColor: entry.userId === myId ? communityAccent : undefined,
                }}
              >
                <span className="text-sm w-6 text-center" style={{ color: communityTextMuted }}>
                  {index + 4}
                </span>
                <Avatar src={entry.avatar} name={entry.name} size={7} />
                <span className="text-sm flex-1 truncate" style={{ color: communityTextSecondary }}>
                  {entry.name ?? "Unknown"}
                  {entry.userId === myId && <span className="text-xs ml-2" style={{ color: communityAccent }}>(you)</span>}
                </span>
                <span className="text-sm font-medium" style={{ color: communityTextPrimary }}>
                  {score(entry)} pts
                </span>
              </div>
            ))}
          </div>
        )}

        {!leaderboard?.entries?.length && (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-2">
              <TrophyIcon />
            </div>
            <p className="text-sm" style={{ color: communityTextMuted }}>
              No entries yet for this period.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
