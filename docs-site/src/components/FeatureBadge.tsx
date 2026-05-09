type Tier = 'free' | 'pro' | 'business' | 'coming-soon'

const colors: Record<Tier, string> = {
  'free':         'bg-green-900/30 text-green-400 border-green-800',
  'pro':          'bg-blue-900/30 text-blue-400 border-blue-800',
  'business':     'bg-purple-900/30 text-purple-400 border-purple-800',
  'coming-soon':  'bg-yellow-900/30 text-yellow-400 border-yellow-800',
}

const labels: Record<Tier, string> = {
  'free':         'Free',
  'pro':          'Pro',
  'business':     'Business',
  'coming-soon':  'Coming Soon',
}

export function FeatureBadge({ tier }: { tier: Tier }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[tier]}`}>
      {labels[tier]}
    </span>
  )
}
