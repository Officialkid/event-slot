const BADGE_CONFIG = {
  PIONEER: {
    emoji: '🏆',
    label: 'Pioneer',
    description: "One of EventSlot's earliest supporters",
    bg: 'bg-[#C8F55A]/10',
    border: 'border-[#C8F55A]/30',
    text: 'text-[#C8F55A]',
  },
  STARRED_ORGANIZER: {
    emoji: '⭐',
    label: 'Starred Organiser',
    description: 'Top organiser — consistently great events',
    bg: 'bg-[#FFD700]/10',
    border: 'border-[#FFD700]/30',
    text: 'text-[#FFD700]',
  },
  COMMUNITY_BUILDER: {
    emoji: '🌍',
    label: 'Community Builder',
    description: 'Referred 10+ active organisers',
    bg: 'bg-[#3B82F6]/10',
    border: 'border-[#3B82F6]/30',
    text: 'text-[#3B82F6]',
  },
  GROWTH_BUILDER: {
    emoji: '🚀',
    label: 'Growth Builder',
    description: '5 successful referrals who created events',
    bg: 'bg-[#A855F7]/10',
    border: 'border-[#A855F7]/30',
    text: 'text-[#A855F7]',
  },
  COMMUNITY_CHAMPION: {
    emoji: '🔥',
    label: 'Community Champion',
    description: 'Appeared in the weekly top 10',
    bg: 'bg-[#F97316]/10',
    border: 'border-[#F97316]/30',
    text: 'text-[#F97316]',
  },
  HALL_OF_FAME: {
    emoji: '👑',
    label: 'Hall of Fame',
    description: 'Finished in the top 3 on the weekly leaderboard',
    bg: 'bg-[#FFD700]/10',
    border: 'border-[#FFD700]/30',
    text: 'text-[#FFD700]',
  },
} as const

export function BadgeDisplay({ badges }: { badges: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map(badge => {
        const cfg = BADGE_CONFIG[badge as keyof typeof BADGE_CONFIG]
        if (!cfg) return null
        return (
          <div
            key={badge}
            title={cfg.description}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}
          >
            <span>{cfg.emoji}</span>
            <span>{cfg.label}</span>
          </div>
        )
      })}
    </div>
  )
}
