'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, ShieldCheck, Mail, ArrowRight, X, Loader2, CheckCircle2 } from 'lucide-react'

interface AccountVerificationBannerProps {
  initialVerified?: boolean
  email?: string | null
}

export function AccountVerificationBanner({ initialVerified = false, email }: AccountVerificationBannerProps) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [isVerified, setIsVerified] = useState(initialVerified)
  const [modalOpen, setModalOpen] = useState(false)

  // Modal OTP state
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  if (isVerified || dismissed || !email) {
    return null
  }

  const handleSendOtp = async () => {
    setStatusError(null)
    setSending(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.waitSeconds) {
          setCooldown(data.waitSeconds)
        }
        setStatusError(data.error || 'Failed to dispatch verification code. Please try again.')
        return
      }
      setOtpSent(true)
      setCooldown(60)
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch {
      setStatusError('Network error while requesting verification code.')
    } finally {
      setSending(false)
    }
  }

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setStatusError('Please enter the full 6-character verification code.')
      return
    }

    setStatusError(null)
    setVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.verified) {
        setStatusError(data.error || 'Invalid or expired verification code. Please try again.')
        return
      }

      setSuccessMessage('Account verified successfully!')
      setIsVerified(true)
      setTimeout(() => {
        setModalOpen(false)
        router.refresh()
      }, 1600)
    } catch {
      setStatusError('Network error verifying code.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <>
      {/* Notice Banner */}
      <aside
        aria-label="Security verification notice"
        className="relative border-b px-4 py-3 transition-colors"
        style={{
          background: 'color-mix(in srgb, var(--accent) 7%, var(--bg-surface))',
          borderColor: 'color-mix(in srgb, var(--accent) 25%, var(--border))',
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-start sm:items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5 sm:mt-0"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </span>
            <div>
              <span className="font-bold mr-1.5" style={{ color: 'var(--text-primary)' }}>
                Upcoming Security Update (1 Jan 2027):
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Mandatory account authentication begins January 1st, 2027 to protect organizer and attendee access. Verify early today to avoid interruptions.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setStatusError(null)
                setSuccessMessage(null)
                setModalOpen(true)
              }}
              className="px-3 py-1.5 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 transition shadow-sm hover:opacity-90 active:scale-95"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              <span>Verify Account Now</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss banner for now"
              className="p-1 rounded-md transition hover:bg-black/10 dark:hover:bg-white/10"
              style={{ color: 'var(--text-muted)' }}
              title="Dismiss for this session"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Verification Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !verifying && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative transition-all"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => !verifying && setModalOpen(false)}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Content */}
            {successMessage ? (
              <div className="py-6 text-center space-y-3">
                <div
                  className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}
                >
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  Authentication Complete!
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Your account has been successfully verified. You are completely set for the 2027 security standards.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>
                      Verify Your Account
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Rollout enforcement date: 1st January 2027
                    </p>
                  </div>
                </div>

                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  We will send a one-time 6-character authentication code to{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> to verify your identity.
                </p>

                {statusError && (
                  <div
                    className="p-3 rounded-xl text-xs font-semibold border"
                    style={{
                      background: 'color-mix(in srgb, var(--error, #ef4444) 10%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--error, #ef4444) 30%, transparent)',
                      color: 'var(--error, #ef4444)',
                    }}
                  >
                    {statusError}
                  </div>
                )}

                {!otpSent ? (
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={sending}
                      onClick={handleSendOtp}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm hover:opacity-90 disabled:opacity-50"
                      style={{
                        background: 'var(--accent)',
                        color: 'var(--accent-contrast)',
                      }}
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Dispatching code...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          <span>Send Verification Code</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                        Enter 6-Character Code
                      </label>
                      <input
                        type="text"
                        maxLength={8}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.toUpperCase())}
                        placeholder="e.g. ZJ5FA0"
                        autoFocus
                        className="w-full px-4 py-2.5 rounded-xl text-center text-lg font-mono tracking-widest font-extrabold border outline-none transition uppercase"
                        style={{
                          background: 'var(--bg-input)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <p className="text-[11px] mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
                        Check your inbox (and spam folder) for the verification code.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={verifying || otpCode.trim().length < 6}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm hover:opacity-90 disabled:opacity-50"
                      style={{
                        background: 'var(--accent)',
                        color: 'var(--accent-contrast)',
                      }}
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Authenticating...</span>
                        </>
                      ) : (
                        <span>Verify &amp; Authenticate</span>
                      )}
                    </button>

                    <div className="text-center pt-1">
                      {cooldown > 0 ? (
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Resend available in {cooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={sending}
                          className="text-xs font-bold underline hover:opacity-80 transition"
                          style={{ color: 'var(--accent)' }}
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
