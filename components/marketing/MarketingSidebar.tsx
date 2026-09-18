"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Megaphone,
  FileText,
  Calendar,
  Send,
  BarChart3,
  Link2,
  FileSpreadsheet,
  Plug,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  ExternalLink,
} from "lucide-react"
import { signOut } from "next-auth/react"

interface MarketingSidebarProps {
  userRole?: string
  userName?: string
  userEmail?: string
  isSuperAdmin?: boolean
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/marketing", icon: LayoutDashboard },
  { label: "Campaigns", href: "/marketing/campaigns", icon: Megaphone },
  { label: "Content", href: "/marketing/content", icon: FileText },
  { label: "Calendar", href: "/marketing/calendar", icon: Calendar },
  { label: "Broadcasts", href: "/marketing/broadcasts", icon: Send },
  { label: "Analytics", href: "/marketing/analytics", icon: BarChart3 },
  { label: "Tracking Links", href: "/marketing/tracking", icon: Link2 },
  { label: "Reports", href: "/marketing/reports", icon: FileSpreadsheet },
  { label: "Integrations", href: "/marketing/integrations", icon: Plug },
  { label: "Team", href: "/marketing/team", icon: Users },
  { label: "Settings", href: "/marketing/settings", icon: Settings },
]

export function MarketingSidebar({
  userRole = "MARKETING_MEMBER",
  userName = "Marketer",
  userEmail = "",
  isSuperAdmin = false,
}: MarketingSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isMarketingAdmin = userRole === "MARKETING_ADMIN" || isSuperAdmin

  return (
    <aside
      className={`relative flex flex-col border-r border-[#262626] bg-[#0A0A0A] transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
      style={{ minHeight: "100vh" }}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#262626]">
        {!collapsed ? (
          <div>
            <Link href="/marketing" className="flex items-center gap-1.5 font-bold tracking-tight">
              <span className="text-xl text-white">Event</span>
              <span className="text-xl text-[#C8F55A]">Slot</span>
              <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold tracking-widest bg-[#1F1F1F] text-[#C8F55A] border border-[#2A2A2A]">
                Marketing
              </span>
            </Link>
          </div>
        ) : (
          <Link href="/marketing" className="mx-auto font-black text-lg">
            <span className="text-white">E</span>
            <span className="text-[#C8F55A]">S</span>
          </Link>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-[#737373] hover:text-white hover:bg-[#1A1A1A] transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          // If item is Team, only Marketing Admin or Super Admin can access
          if (item.href === "/marketing/team" && !isMarketingAdmin) {
            return null
          }

          const Icon = item.icon
          const isActive =
            item.href === "/marketing"
              ? pathname === "/marketing"
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-[#C8F55A] text-[#0A0A0A] font-semibold shadow-sm"
                  : "text-[#A3A3A3] hover:text-white hover:bg-[#141414]"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#0A0A0A]" : "text-[#737373]"}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}

        {/* Super Admin Switcher Link */}
        {isSuperAdmin && !collapsed && (
          <div className="pt-4 mt-4 border-t border-[#1F1F1F]">
            <Link
              href="/admin"
              className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#737373] hover:text-white hover:bg-[#141414] rounded-xl transition"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-[#C8F55A]" />
                Super Admin Panel
              </span>
              <span className="text-[10px] text-[#C8F55A] font-mono">ROOT</span>
            </Link>
          </div>
        )}
      </nav>

      {/* User Profile & Role Footer */}
      <div className="p-3 border-t border-[#262626] bg-[#0E0E0E]">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#333] flex items-center justify-center font-bold text-xs text-[#C8F55A]">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{userName}</p>
                <p className="text-[11px] text-[#737373] truncate">{userEmail}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#1F1F1F]">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#1A1A1A] text-[#C8F55A] border border-[#2A2A2A]">
                {userRole.replace("_", " ")}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="text-xs text-[#737373] hover:text-rose-400 flex items-center gap-1 transition"
                title="Sign Out"
              >
                <LogOut className="w-3 h-3" />
                <span>Exit</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="w-full flex items-center justify-center py-2 text-[#737373] hover:text-rose-400"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  )
}
