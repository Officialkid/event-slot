"use client"

import React, { useEffect, useState } from "react"
import { Building2, User, ShieldCheck, CheckCircle2, Search, Loader2 } from "lucide-react"

export interface WorkspacePersona {
  id: string
  name: string
  username: string | null
  email: string | null
  image: string | null
}

interface WorkspaceSelectorProps {
  selectedId: string | null
  onChange: (id: string | null, label?: string) => void
}

export function WorkspaceSelector({ selectedId, onChange }: WorkspaceSelectorProps) {
  const [personal, setPersonal] = useState<WorkspacePersona | null>(null)
  const [organizations, setOrganizations] = useState<WorkspacePersona[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [customOrgInput, setCustomOrgInput] = useState("")
  const [assignedClient, setAssignedClient] = useState<WorkspacePersona | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchWorkspaces() {
      try {
        const res = await fetch("/api/me/workspaces")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.success) {
          setPersonal(data.personal)
          setOrganizations(data.organizations || [])
          setIsAdmin(Boolean(data.isAdmin))
        }
      } catch (err) {
        console.error("Failed to load workspaces:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchWorkspaces()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleAssignClient(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const query = customOrgInput.trim()
    if (!query) return

    setSearching(true)
    setSearchError(null)

    try {
      const res = await fetch(`/api/admin/users/lookup?query=${encodeURIComponent(query)}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        setSearchError(data.error || "No client account found. Please verify the email or username.")
        return
      }

      setAssignedClient(data.user)
      onChange(data.user.id, data.user.name || data.user.username || data.user.email)
      setCustomOrgInput("")
    } catch {
      setSearchError("Failed to look up client account. Please try again.")
    } finally {
      setSearching(false)
    }
  }

  if (loading) return null
  // If user has no organization workspaces and is not admin, hide the selector to keep UI clean and simple
  if (organizations.length === 0 && !isAdmin) return null

  return (
    <div
      className="p-4 rounded-xl border mb-6 transition-all"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: "var(--text-secondary)" }}>
          Host Persona / Workspace
        </label>
        {isAdmin && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
              color: "var(--accent)",
            }}
          >
            <ShieldCheck className="w-3 h-3" />
            Admin Concierge
          </span>
        )}
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Choose whether this event is published under your personal profile or an organization workspace. Attendees who follow the event will follow this entity.
      </p>

      {/* Workspace options grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Personal profile option */}
        {personal && (
          <button
            type="button"
            onClick={() => {
              setAssignedClient(null)
              onChange(null, personal.name)
            }}
            className="flex items-center gap-3 p-3 rounded-lg border text-left transition-all"
            style={{
              backgroundColor:
                !selectedId && !assignedClient
                  ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
                  : "var(--surface)",
              borderColor: !selectedId && !assignedClient ? "var(--accent)" : "var(--border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "color-mix(in srgb, var(--text-primary) 10%, transparent)",
                color: "var(--text-primary)",
              }}
            >
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {personal.name}
              </span>
              <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                Personal Profile {personal.username ? `(@${personal.username})` : ""}
              </span>
            </div>
          </button>
        )}

        {/* Organizations */}
        {organizations.map((org) => {
          const isSelected = selectedId === org.id && !assignedClient
          return (
            <button
              key={org.id}
              type="button"
              onClick={() => {
                setAssignedClient(null)
                onChange(org.id, org.name)
              }}
              className="flex items-center gap-3 p-3 rounded-lg border text-left transition-all"
              style={{
                backgroundColor: isSelected
                  ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
                  : "var(--surface)",
                borderColor: isSelected ? "var(--accent)" : "var(--border)",
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
                  color: "var(--accent)",
                }}
              >
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {org.name}
                </span>
                <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                  Organization {org.username ? `(@${org.username})` : ""}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Admin Concierge: Assign by Email, Username, or ID */}
      {isAdmin && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          {assignedClient ? (
            <div
              className="p-3 rounded-lg border flex items-center justify-between gap-3 animate-fadeIn"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
                borderColor: "var(--accent)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
                    color: "var(--accent)",
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      Assigned to Client: {assignedClient.name || assignedClient.username || "Client"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-semibold">
                      Active
                    </span>
                  </div>
                  <span className="block text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                    {assignedClient.email} {assignedClient.username ? `· @${assignedClient.username}` : ""}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignedClient(null)
                  onChange(null)
                }}
                className="text-xs px-2.5 py-1 rounded border hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Change / Remove
              </button>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-secondary)" }}>
                Admin Override: Assign Event to Client Account
              </label>
              <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
                Enter the client&apos;s email address or username. When published, attendees will follow this client and see their profile.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter client's email or username (e.g. client@gmail.com)..."
                  value={customOrgInput}
                  onChange={(e) => {
                    setCustomOrgInput(e.target.value)
                    if (searchError) setSearchError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAssignClient()
                    }
                  }}
                  className="text-xs px-3 py-2 rounded-lg border flex-1 bg-[var(--surface)] text-[var(--text-primary)]"
                  style={{ borderColor: searchError ? "#ef4444" : "var(--border)" }}
                />
                <button
                  type="button"
                  onClick={() => handleAssignClient()}
                  disabled={searching || !customOrgInput.trim()}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
                    borderColor: "var(--accent)",
                    color: "var(--text-primary)",
                  }}
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      Find &amp; Assign
                    </>
                  )}
                </button>
              </div>
              {searchError && (
                <p className="text-[11px] text-red-500 mt-1.5 font-medium flex items-center gap-1">
                  <span>⚠️</span> {searchError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
