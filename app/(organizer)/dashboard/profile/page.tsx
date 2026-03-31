"use client"

import React, { useState, useEffect, useRef } from "react"
import { signOut } from "next-auth/react"

interface ProfileData {
  name: string | null
  email: string | null
  image: string | null
  hasPassword: boolean
}

// ─── Input component ─────────────────────────────────────────────────────────

function Field({
  label,
  type = "text",
  value,
  onChange,
  disabled,
  note,
}: {
  label: string
  type?: string
  value: string
  onChange?: (v: string) => void
  disabled?: boolean
  note?: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <label
        style={{
          fontSize: "0.75rem",
          color: "rgba(240,237,230,0.45)",
          fontFamily: "var(--font-dm-sans)",
          fontWeight: 500,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        className="prof-input"
        style={{
          background: disabled ? "rgba(240,237,230,0.03)" : "rgba(240,237,230,0.05)",
          border: "0.5px solid rgba(240,237,230,0.12)",
          borderRadius: 8,
          padding: "0.65rem 0.875rem",
          color: disabled ? "rgba(240,237,230,0.35)" : "#F0EDE6",
          fontFamily: "var(--font-dm-sans)",
          fontSize: "0.875rem",
          width: "100%",
          outline: "none",
          cursor: disabled ? "not-allowed" : "text",
          boxSizing: "border-box",
        }}
      />
      {note && (
        <p
          style={{
            margin: 0,
            fontSize: "0.72rem",
            color: "rgba(240,237,230,0.3)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {note}
        </p>
      )}
    </div>
  )
}

// ─── Card component ───────────────────────────────────────────────────────────

function Card({
  children,
  dangerBorder,
}: {
  children: React.ReactNode
  dangerBorder?: boolean
}) {
  return (
    <div
      style={{
        background: "#141414",
        border: dangerBorder
          ? "0.5px solid rgba(255,107,107,0.2)"
          : "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 12,
        padding: "1.5rem",
      }}
    >
      {children}
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({
  children,
  color,
}: {
  children: React.ReactNode
  color?: string
}) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-instrument-serif)",
        fontSize: "1.1rem",
        color: color ?? "#F0EDE6",
        fontWeight: 400,
        margin: "0 0 1.25rem",
      }}
    >
      {children}
    </h2>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({
  onCancel,
  onConfirm,
  deleting,
}: {
  onCancel: () => void
  onConfirm: () => void
  deleting: boolean
}) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 100,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101,
          background: "#1A1A1A",
          border: "0.5px solid rgba(255,107,107,0.25)",
          borderRadius: 14,
          padding: "2rem",
          width: "min(440px, calc(100vw - 2rem))",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.2rem",
            color: "#F0EDE6",
            fontWeight: 400,
            margin: "0 0 0.875rem",
          }}
        >
          Delete account?
        </h3>
        <p
          style={{
            fontSize: "0.875rem",
            color: "rgba(240,237,230,0.55)",
            fontFamily: "var(--font-dm-sans)",
            lineHeight: 1.6,
            margin: "0 0 1.5rem",
          }}
        >
          This will permanently delete your account, all your events, and all
          registration data. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              background: "transparent",
              border: "0.5px solid rgba(240,237,230,0.15)",
              borderRadius: 8,
              padding: "0.55rem 1.25rem",
              fontSize: "0.875rem",
              color: "rgba(240,237,230,0.55)",
              fontFamily: "var(--font-dm-sans)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              background: "#FF6B6B",
              border: "none",
              borderRadius: 8,
              padding: "0.55rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#fff",
              fontFamily: "var(--font-dm-sans)",
              cursor: deleting ? "default" : "pointer",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "Deleting…" : "Delete my account permanently"}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState("")

  // Details form
  const [name, setName] = useState("")
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [detailsSuccess, setDetailsSuccess] = useState(false)
  const [detailsError, setDetailsError] = useState("")

  // Password form
  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState("")

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then((data: ProfileData) => {
        setProfile(data)
        setName(data.name ?? "")
      })
  }, [])

  const currentImage = photoPreview ?? profile?.image ?? null
  const initials = ((profile?.name || profile?.email) ?? "?")
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  // ── Photo handlers ──────────────────────────────────────────────────────────

  function handlePhotoClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError("")

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("Image is too large. Maximum size is 2 MB.")
      e.target.value = ""
      return
    }

    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      setPhotoPreview(dataUrl)
      setPhotoUploading(true)
      try {
        const res = await fetch("/api/profile/photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: dataUrl }),
        })
        if (!res.ok) {
          const err = await res.json()
          setPhotoError(err.error ?? "Upload failed")
          setPhotoPreview(null)
        } else {
          setProfile(prev => (prev ? { ...prev, image: dataUrl } : prev))
        }
      } catch {
        setPhotoError("Upload failed. Please try again.")
        setPhotoPreview(null)
      } finally {
        setPhotoUploading(false)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  // ── Details handler ─────────────────────────────────────────────────────────

  async function handleDetailsSave(e: React.FormEvent) {
    e.preventDefault()
    setDetailsError("")
    setDetailsSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = await res.json()
        setDetailsError(err.error ?? "Failed to save changes")
        return
      }
      setProfile(prev => (prev ? { ...prev, name } : prev))
      setDetailsSuccess(true)
      setTimeout(() => setDetailsSuccess(false), 3000)
    } catch {
      setDetailsError("Failed to save changes")
    } finally {
      setDetailsSaving(false)
    }
  }

  // ── Password handler ────────────────────────────────────────────────────────

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    setPwError("")

    if (newPw !== confirmPw) {
      setPwError("New passwords don't match")
      return
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters")
      return
    }

    setPwSaving(true)
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      if (!res.ok) {
        const err = await res.json()
        setPwError(err.error ?? "Failed to update password")
        return
      }
      setPwSuccess(true)
      setCurrentPw("")
      setNewPw("")
      setConfirmPw("")
      setTimeout(() => setPwSuccess(false), 3000)
    } catch {
      setPwError("Failed to update password")
    } finally {
      setPwSaving(false)
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    setDeleting(true)
    try {
      await fetch("/api/profile", { method: "DELETE" })
      await signOut({ callbackUrl: "/" })
    } catch {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (!profile) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "4rem 0",
        }}
      >
        <style>{`@keyframes prof-spin { to { transform: rotate(360deg); } }`}</style>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "2px solid rgba(200,245,90,0.2)",
            borderTopColor: "#C8F55A",
            animation: "prof-spin 0.8s linear infinite",
          }}
        />
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .prof-input:focus {
          border-color: rgba(200,245,90,0.4) !important;
          box-shadow: 0 0 0 3px rgba(200,245,90,0.06);
        }
        .prof-ghost-btn:hover {
          background: rgba(240,237,230,0.07) !important;
          color: #F0EDE6 !important;
        }
        .prof-primary-btn:hover:not(:disabled) {
          background: #d8ff6a !important;
        }
        .prof-danger-btn:hover:not(:disabled) {
          background: rgba(255,107,107,0.12) !important;
        }
      `}</style>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Page heading */}
        <h1
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.6rem",
            color: "#F0EDE6",
            fontWeight: 400,
            margin: "0 0 2rem",
          }}
        >
          Your profile
        </h1>

        {/* ── Photo section ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.875rem",
            marginBottom: "2rem",
          }}
        >
          {/* Avatar */}
          <div style={{ position: "relative" }}>
            {currentImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImage}
                alt="Profile photo"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "0.5px solid rgba(240,237,230,0.12)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "rgba(200,245,90,0.12)",
                  border: "0.5px solid rgba(200,245,90,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  color: "#C8F55A",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                {initials}
              </div>
            )}
            {photoUploading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(10,10,10,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <style>{`@keyframes prof-spin { to { transform: rotate(360deg); } }`}</style>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "2px solid rgba(200,245,90,0.3)",
                    borderTopColor: "#C8F55A",
                    animation: "prof-spin 0.8s linear infinite",
                  }}
                />
              </div>
            )}
          </div>

          {/* Change photo button */}
          <button
            onClick={handlePhotoClick}
            disabled={photoUploading}
            className="prof-ghost-btn"
            style={{
              background: "transparent",
              border: "0.5px solid rgba(240,237,230,0.15)",
              borderRadius: 8,
              padding: "0.4rem 1rem",
              fontSize: "0.8rem",
              color: "rgba(240,237,230,0.5)",
              fontFamily: "var(--font-dm-sans)",
              cursor: photoUploading ? "default" : "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {photoUploading ? "Uploading…" : "Change photo"}
          </button>

          {photoError && (
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                color: "#FF6B6B",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {photoError}
            </p>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>

        {/* ── Personal details card ── */}
        <div style={{ marginBottom: "1.25rem" }}>
          <Card>
            <SectionHeading>Personal details</SectionHeading>
            <form onSubmit={handleDetailsSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Field
                label="Display name"
                value={name}
                onChange={setName}
              />
              <Field
                label="Email"
                type="email"
                value={profile.email ?? ""}
                disabled
                note={
                  !profile.hasPassword
                    ? "Email is managed by your Google account."
                    : undefined
                }
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                  paddingTop: "0.25rem",
                }}
              >
                <button
                  type="submit"
                  disabled={detailsSaving}
                  className="prof-primary-btn"
                  style={{
                    background: "#C8F55A",
                    color: "#0A0A0A",
                    border: "none",
                    borderRadius: 8,
                    padding: "0.6rem 1.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-dm-sans)",
                    cursor: detailsSaving ? "default" : "pointer",
                    opacity: detailsSaving ? 0.7 : 1,
                    transition: "background 0.15s",
                  }}
                >
                  {detailsSaving ? "Saving…" : "Save changes"}
                </button>

                {detailsSuccess && (
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "#C8F55A",
                      fontFamily: "var(--font-dm-sans)",
                    }}
                  >
                    Profile updated
                  </span>
                )}

                {detailsError && (
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "#FF6B6B",
                      fontFamily: "var(--font-dm-sans)",
                    }}
                  >
                    {detailsError}
                  </span>
                )}
              </div>
            </form>
          </Card>
        </div>

        {/* ── Change password card (credentials users only) ── */}
        {profile.hasPassword && (
          <div style={{ marginBottom: "1.25rem" }}>
            <Card>
              <SectionHeading>Change password</SectionHeading>
              <form onSubmit={handlePasswordSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <Field
                  label="Current password"
                  type="password"
                  value={currentPw}
                  onChange={setCurrentPw}
                />
                <Field
                  label="New password"
                  type="password"
                  value={newPw}
                  onChange={setNewPw}
                />
                <Field
                  label="Confirm new password"
                  type="password"
                  value={confirmPw}
                  onChange={setConfirmPw}
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                    paddingTop: "0.25rem",
                  }}
                >
                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="prof-primary-btn"
                    style={{
                      background: "#C8F55A",
                      color: "#0A0A0A",
                      border: "none",
                      borderRadius: 8,
                      padding: "0.6rem 1.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-dm-sans)",
                      cursor: pwSaving ? "default" : "pointer",
                      opacity: pwSaving ? 0.7 : 1,
                      transition: "background 0.15s",
                    }}
                  >
                    {pwSaving ? "Saving…" : "Save password"}
                  </button>

                  {pwSuccess && (
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#C8F55A",
                        fontFamily: "var(--font-dm-sans)",
                      }}
                    >
                      Password updated
                    </span>
                  )}

                  {pwError && (
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#FF6B6B",
                        fontFamily: "var(--font-dm-sans)",
                      }}
                    >
                      {pwError}
                    </span>
                  )}
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* ── Danger zone card ── */}
        <Card dangerBorder>
          <SectionHeading color="#FF6B6B">Danger zone</SectionHeading>
          <p
            style={{
              margin: "0 0 1.25rem",
              fontSize: "0.875rem",
              color: "rgba(240,237,230,0.45)",
              fontFamily: "var(--font-dm-sans)",
              lineHeight: 1.6,
            }}
          >
            Permanently delete your account and all associated data.
          </p>
          <button
            onClick={() => setDeleteOpen(true)}
            className="prof-danger-btn"
            style={{
              background: "rgba(255,107,107,0.08)",
              border: "0.5px solid rgba(255,107,107,0.3)",
              borderRadius: 8,
              padding: "0.6rem 1.25rem",
              fontSize: "0.875rem",
              color: "#FF6B6B",
              fontFamily: "var(--font-dm-sans)",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            Delete my account
          </button>
        </Card>
      </div>

      {/* ── Delete modal ── */}
      {deleteOpen && (
        <DeleteModal
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          deleting={deleting}
        />
      )}
    </>
  )
}
