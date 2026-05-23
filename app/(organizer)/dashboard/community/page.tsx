"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Inline SVG icons (no lucide-react in main app)
// ---------------------------------------------------------------------------

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
      className="text-[#2A2A2A]"
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

// ---------------------------------------------------------------------------
// Avatar helper
// ---------------------------------------------------------------------------

function Avatar({ src, name, size = 8 }: { src: string | null; name: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full bg-[#2A2A2A] overflow-hidden shrink-0`
  return (
    <div className={cls}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-white font-bold">
          {name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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

  // Load referral data + badges once
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
    return () => { cancelled = true }
  }, [])

  // Load leaderboard on period / type change
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
    return () => { cancelled = true }
  }, [period, type])

  const referralUrl = referralData?.referralUrl ?? ""

  const visibleBadges = useMemo(
    () =>
      badges
        .map((b) => ({ key: b, meta: BADGE_META[b] }))
        .filter((b) => Boolean(b.meta)),
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
    const url = referralUrl
    if (!url) return
    const msg = `Join EventSlot — the smartest way to organise events. Sign up here: ${url}`
    try {
      if (navigator.share) {
        await navigator.share({ text: msg })
      } else {
        await navigator.clipboard.writeText(msg)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // user cancelled or clipboard unavailable
    }
  }

  function score(e: LeaderboardEntry) {
    if (type === "referral") return e.referralPts
    if (type === "organiser") return e.organiserPts
    return e.totalPts
  }

  const top3 = leaderboard?.entries?.slice(0, 3) ?? []
  const rest = leaderboard?.entries?.slice(3) ?? []

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-6">

      {/* Pioneer banner */}
      {hasPioneer && (
        <div className="flex items-center gap-4 rounded-xl border border-[#C8F55A]/30 bg-gradient-to-r from-[#C8F55A]/10 to-[#C8F55A]/5 p-5">
          <span className="text-4xl">🏆</span>
          <div>
            <p className="text-sm font-bold text-[#C8F55A]">EventSlot Pioneer</p>
            <p className="mt-0.5 text-xs text-[#A3A3A3]">
              You are one of EventSlot&apos;s earliest supporters. This badge belongs to a limited group — and you&apos;re in it.
            </p>
          </div>
        </div>
      )}

      {/* Badges */}
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

      {/* Invite & Earn */}
      <div className="border border-[#2A2A2A] rounded-2xl p-5 bg-[#141414]">
        <p className="text-xs text-[#C8F55A] font-semibold uppercase tracking-wider mb-1">
          ✦ INVITE &amp; EARN
        </p>
        <p className="text-[#A3A3A3] text-sm leading-relaxed mb-4">
          Earn <span className="text-white font-bold">5 tokens</span> when someone signs up, and{" "}
          <span className="text-white font-bold">+5 tokens</span> when they create their first event.
          Invite 2 people who create events — your first AI report is free.
        </p>

        {/* Referral link */}
        <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 mb-3">
          <span className="text-[#A3A3A3] text-xs flex-1 truncate">
            {referralUrl || (loadingBase ? "Loading..." : "Unavailable")}
          </span>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="text-[#C8F55A] text-xs font-semibold shrink-0 hover:text-white transition-colors"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        {/* Share button */}
        <button
          type="button"
          onClick={() => void shareInvite()}
          data-tutorial="community-share-invite"
          className="w-full bg-[#C8F55A] text-black font-bold py-3 rounded-xl hover:bg-[#b8e040] transition-colors flex items-center justify-center gap-2"
        >
          <ShareIcon /> Share Invite
        </button>

        {/* Stats */}
        {referralData?.stats && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Referred", value: referralData.stats.totalReferrals },
              { label: "Completed", value: referralData.stats.completedReferrals },
              { label: "Tokens Earned", value: referralData.stats.totalTokensEarned },
            ].map((s) => (
              <div key={s.label} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-center">
                <p className="text-[#C8F55A] font-bold text-2xl">{s.value}</p>
                <p className="text-[#525252] text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Referral list */}
        {referralData?.referrals?.length ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-white">Your referrals</p>
            <div className="space-y-2">
              {referralData.referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-[#0A0A0A] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{r.status === "EVENT_CREATED" ? "✅" : "⏳"}</span>
                    <span className="text-xs text-white">{r.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-[#C8F55A]">+{r.earned} tokens</span>
                    <p className="text-xs text-[#525252]">
                      {r.status === "EVENT_CREATED" ? "Complete" : "Waiting for first event"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Leaderboard */}
      <div className="border border-[#2A2A2A] rounded-2xl overflow-hidden bg-[#141414]">

        {/* Period tabs */}
        <div className="flex border-b border-[#2A2A2A]">
          {PERIOD_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setPeriod(t.key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors
                ${period === t.key
                  ? "text-[#C8F55A] border-b-2 border-[#C8F55A]"
                  : "text-[#525252] hover:text-[#A3A3A3]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Type sub-tabs */}
        <div className="flex gap-2 p-3 border-b border-[#2A2A2A]">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors
                ${type === t.key
                  ? "bg-[#C8F55A] text-black"
                  : "bg-[#0A0A0A] text-[#525252] hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Top 3 podium */}
        {top3.length > 0 && (
          <div className="p-4 space-y-2">
            {top3.map((e, i) => (
              <div
                key={e.userId}
                className={`flex items-center gap-3 p-3 rounded-xl border ${PODIUM_BORDER[i]}`}
              >
                <span className="text-2xl w-8 text-center">{MEDALS[i]}</span>
                <Avatar src={e.avatar} name={e.name} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {e.name ?? "Unknown"}
                    {e.userId === myId && (
                      <span className="text-[#C8F55A] text-xs ml-2">(you)</span>
                    )}
                  </p>
                  <p className="text-[#525252] text-xs">
                    Ref: {e.referralPts}pts · Events: {e.organiserPts}pts
                  </p>
                </div>
                <span className={`font-bold text-sm ${PODIUM_TEXT[i]}`}>
                  {score(e)} pts
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Positions 4–50 */}
        {rest.length > 0 && (
          <div className="border-t border-[#2A2A2A]">
            {rest.map((e, i) => (
              <div
                key={e.userId}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2A]
                  hover:bg-[#1E1E1E] transition-colors
                  ${e.userId === myId
                    ? "bg-[#C8F55A]/5 border-l-2 border-l-[#C8F55A]"
                    : ""}`}
              >
                <span className="text-[#525252] text-sm w-6 text-center">{i + 4}</span>
                <Avatar src={e.avatar} name={e.name} size={7} />
                <span className="text-[#A3A3A3] text-sm flex-1 truncate">
                  {e.name ?? "Unknown"}
                  {e.userId === myId && (
                    <span className="text-[#C8F55A] text-xs ml-2">(you)</span>
                  )}
                </span>
                <span className="text-white text-sm font-medium">{score(e)} pts</span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!leaderboard?.entries?.length && (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-2">
              <TrophyIcon />
            </div>
            <p className="text-[#525252] text-sm">No entries yet for this period.</p>
          </div>
        )}
      </div>
    </div>
  )
}
