type StatusType = 'live' | 'beta' | 'planned' | 'deprecated'

const styles: Record<StatusType, { dot: string; text: string; label: string }> = {
  live:       { dot: 'bg-green-400',  text: 'text-green-400',  label: 'Live' },
  beta:       { dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Beta' },
  planned:    { dot: 'bg-gray-500',   text: 'text-gray-400',   label: 'Planned' },
  deprecated: { dot: 'bg-red-400',    text: 'text-red-400',    label: 'Deprecated' },
}

export function Status({ status }: { status: StatusType }) {
  const s = styles[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'live' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  )
}
