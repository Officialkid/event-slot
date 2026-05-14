'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

/**
 * DevToolsDetector
 *
 * Client-side deterrent only — NOT a security control.
 * Detects when browser DevTools are likely open and shows a one-time
 * warning banner. This does not restrict any functionality.
 *
 * Detection methods:
 *  1. Viewport-size delta: DevTools panel causes window inner dimensions to
 *     shrink noticeably relative to screen dimensions.
 *  2. Debugger timing: A no-op `debugger` statement inside a profiled block
 *     causes measurable time dilation when DevTools are paused on breakpoints.
 */
export function DevToolsDetector() {
  const { status } = useSession()
  const [visible, setVisible] = useState(false)
  const firedRef = useRef(false)

  if (status === 'authenticated') return null

  useEffect(() => {
    if (typeof window === 'undefined') return

    function detect(): boolean {
      // Method 1: viewport size shrinks when DevTools dock to the side/bottom
      const threshold = 160
      const widthDelta = window.screen.width - window.innerWidth
      const heightDelta = window.screen.height - window.innerHeight
      if (widthDelta > threshold || heightDelta > threshold) return true

      // Method 2: debugger timing — takes >10 ms only when paused in DevTools
      const start = performance.now()
      // eslint-disable-next-line no-debugger
      debugger
      const elapsed = performance.now() - start
      if (elapsed > 10) return true

      return false
    }

    function check() {
      if (firedRef.current) return
      if (detect()) {
        firedRef.current = true
        setVisible(true)
      }
    }

    // Poll every 2 seconds — infrequent enough to not impact performance
    const interval = setInterval(check, 2000)
    check()

    return () => clearInterval(interval)
  }, [])

  if (!visible) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        zIndex: 9999,
        maxWidth: '360px',
        background: '#1a1a1a',
        border: '1px solid #f59e0b',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        color: '#f0ede6',
        fontSize: '0.8rem',
        lineHeight: 1.5,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '0.25rem' }}>
        Developer tools detected
      </strong>
      This application is monitored. Unauthorized inspection or modification is
      prohibited.
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        style={{
          display: 'block',
          marginTop: '0.5rem',
          background: 'transparent',
          border: '1px solid #555',
          color: '#aaa',
          borderRadius: '0.25rem',
          padding: '0.2rem 0.6rem',
          cursor: 'pointer',
          fontSize: '0.75rem',
        }}
      >
        Dismiss
      </button>
    </div>
  )
}
