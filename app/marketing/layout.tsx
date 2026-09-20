"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MarketingSidebar } from "@/components/marketing/MarketingSidebar"
import { ShieldAlert, LogIn, ArrowLeft, Sparkles, Plus, Link2, Megaphone, FileText } from "lucide-react"

interface MarketingUser {
  userId: string
  email: string
  name: string
  role: "MARKETING_ADMIN" | "MARKETING_MEMBER" | "CONTENT_MANAGER" | "ANALYST"
  status: string
  isSuperAdmin: boolean
  permissions: Record<string, boolean>
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<MarketingUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function checkAuth() {
      try {
        const res = await fetch("/api/marketing/auth/me", { cache: "no-store" })
        if (!res.ok) {
          if (isMounted) {
            setUnauthorized(true)
            setLoading(false)
          }
          return
        }
        const data = await res.json()
        if (isMounted) {
          setUser(data.user)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setUnauthorized(true)
          setLoading(false)
        }
      }
    }

    checkAuth()
    return () => {
      isMounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl font-bold tracking-tight">Event</span>
          <span className="text-2xl font-bold text-[#C8F55A] tracking-tight">Slot</span>
        </div>
        <div className="w-8 h-8 border-2 border-[#C8F55A] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-mono uppercase tracking-widest text-[#737373]">
          Loading Marketing Operating System...
        </p>
      </div>
    )
  }

  if (unauthorized || !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#141414] border border-[#262626] rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">Marketing Hub Access Required</h1>
            <p className="text-sm text-[#A3A3A3] mt-2 leading-relaxed">
              Your account is not registered as an active member of the EventSlot Marketing Team.
              This portal is restricted to authorized marketing operators.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1F1F1F] text-xs text-[#737373] text-left">
            💡 If you are an EventSlot employee or agency partner, ask your <strong>Super Admin</strong> to grant you access via the Super Admin Team directory.
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href="/signin"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#b8e84a] transition"
            >
              <LogIn className="w-4 h-4" />
              Sign in with Authorized Account
            </Link>
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-[#A3A3A3] hover:text-white bg-[#1F1F1F] transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="marketing-hub-root min-h-screen flex bg-[#0A0A0A] text-white"
      data-theme="dark"
      style={{ colorScheme: "dark", color: "#FFFFFF", background: "#0A0A0A" }}
    >
      {/* Sidebar */}
      <MarketingSidebar
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
        isSuperAdmin={user.isSuperAdmin}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-[#262626] bg-[#0A0A0A]/95 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C8F55A] animate-pulse"></span>
              <span className="text-xs font-mono uppercase tracking-wider text-[#A3A3A3]">
                Marketing OS v1.0
              </span>
            </div>
          </div>

          {/* Quick Action Bar */}
          <div className="flex items-center gap-2.5">
            {user.permissions.canCreateCampaign && (
              <Link
                href="/marketing/campaigns"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#262626] text-white border border-[#333] transition"
                style={{ color: "#FFFFFF" }}
              >
                <Megaphone className="w-3.5 h-3.5 text-[#C8F55A]" />
                New Campaign
              </Link>
            )}

            {user.permissions.canCreateContent && (
              <Link
                href="/marketing/content"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#C8F55A] hover:bg-[#b8e84a] text-[#0A0A0A] transition shadow-sm"
                style={{ color: "#0A0A0A" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create Content
              </Link>
            )}

            {user.permissions.canGenerateLinks && (
              <Link
                href="/marketing/tracking"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#262626] text-white border border-[#333] transition"
                style={{ color: "#FFFFFF" }}
              >
                <Link2 className="w-3.5 h-3.5 text-[#C8F55A]" />
                Tracking Link
              </Link>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
