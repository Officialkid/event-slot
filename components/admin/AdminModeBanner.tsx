'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, LogOut, User } from 'lucide-react'

interface AdminModeState {
  active: boolean
  eventTitle: string | null
  eventSlug: string | null
  organiserId: string | null
  activatedAt: string | null
}

export function AdminModeBanner() {
  const [state, setState] = useState<AdminModeState | null>(null)
  const [exiting, setExiting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/admin/event-mode')
      .then(r => r.json())
      .then(data => {
        if (data.active) {
          setState(data)
          document.body.classList.add('admin-mode-active')
        }
      })
      .catch(() => {})

    return () => {
      document.body.classList.remove('admin-mode-active')
    }
  }, [])

  if (!state?.active) return null

  const exitAdminMode = async () => {
    setExiting(true)
    try {
      const res = await fetch('/api/admin/event-mode', { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        document.body.classList.remove('admin-mode-active')
        setState(null)
        router.push(data.redirectTo ?? '/admin/events')
      }
    } catch {
      alert('Failed to exit Admin Mode. Please refresh the page.')
    } finally {
      setExiting(false)
    }
  }

  const activatedAt = state.activatedAt ? new Date(state.activatedAt) : null
  const minutesActive = activatedAt
    ? Math.round((Date.now() - activatedAt.getTime()) / 60_000)
    : 0

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#EF4444] shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-4">

        {/* Left — mode indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-white shrink-0" />
            <span className="text-white font-bold text-sm">ADMIN MODE ACTIVE</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-white/20 rounded-lg px-2.5 py-1">
            <User className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-medium truncate max-w-[200px]">
              {state.eventTitle}
            </span>
          </div>
        </div>

        {/* Centre — context */}
        <p className="hidden md:block text-white/80 text-xs text-center">
          You have full organiser access. All actions are logged.
          {minutesActive > 0 && ` Active for ${minutesActive}m.`}
        </p>

        {/* Right — exit button */}
        <button
          onClick={exitAdminMode}
          disabled={exiting}
          className="flex items-center gap-1.5 bg-white text-[#EF4444] font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          {exiting ? 'Exiting...' : 'Exit Admin Mode'}
        </button>
      </div>

      {/* Warning strip */}
      <div className="bg-[#dc2626] px-4 py-0.5 text-center">
        <p className="text-white/60 text-xs">
          ⚠ You are acting as the organiser of this event.
          Attendees and the organiser cannot see this banner.
          Admin Mode expires in 4 hours.
        </p>
      </div>
    </div>
  )
}
