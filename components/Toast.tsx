'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToastData {
  featureName: string
  creditsUsed: number
  creditsRemaining: number
}

// ─── useToast hook ────────────────────────────────────────────────────────────

let globalShowToast: ((data: ToastData) => void) | null = null

export function useToast() {
  const showToast = useCallback((data: ToastData) => {
    globalShowToast?.(data)
  }, [])
  return { showToast }
}

// ─── Toast component ──────────────────────────────────────────────────────────

export function Toast() {
  const [toast, setToast] = useState<ToastData | null>(null)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    globalShowToast = (data: ToastData) => {
      // Clear any in-flight dismiss timer
      if (timerRef.current) clearTimeout(timerRef.current)

      setToast(data)
      setExiting(false)
      setVisible(true)

      // Begin fade-out after 4 s
      timerRef.current = setTimeout(() => {
        setExiting(true)
        setTimeout(() => setVisible(false), 400) // match animation duration
      }, 4000)
    }

    return () => {
      globalShowToast = null
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!visible || !toast) return null

  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(12px); }
        }
        .toast-enter { animation: toast-in 0.25s ease forwards; }
        .toast-exit  { animation: toast-out 0.4s ease forwards; }
      `}</style>
      <div
        className={exiting ? 'toast-exit' : 'toast-enter'}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          background: '#141414',
          border: '0.5px solid rgba(200,245,90,0.3)',
          borderRadius: 10,
          padding: '0.875rem 1.25rem',
          maxWidth: 280,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Lime checkmark circle */}
        <div
          style={{
            flexShrink: 0,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#C8F55A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="#0A0A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#F0EDE6',
              fontFamily: 'var(--font-dm-sans)',
              lineHeight: 1.3,
            }}
          >
            {toast.featureName} unlocked
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              color: 'rgba(240,237,230,0.45)',
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            {toast.creditsUsed} credits used · {toast.creditsRemaining} remaining
          </span>
        </div>
      </div>
    </>
  )
}
