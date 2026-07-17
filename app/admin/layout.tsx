import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { hasAdminAccess } from "@/lib/isAdmin"
import AdminSidebar from "./AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/signin?callbackUrl=/admin&reason=admin')
  }

  if (!hasAdminAccess(session)) {
    redirect('/unauthorized')
  }

  return (
    <>
      <style>{`
        .admin-layout-wrapper {
          display: flex;
          min-height: 100vh;
          background: var(--bg-page);
          color: var(--text-primary);
        }
        .admin-layout-main {
          flex: 1;
          overflow-y: auto;
          padding: 2.5rem 2rem;
        }
        .admin-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.75rem;
          border: 0.5px solid var(--border-subtle);
          border-radius: 18px;
          background: color-mix(in srgb, var(--surface) 94%, transparent);
          padding: 0.9rem 1.1rem;
        }
        .admin-topbar-brand {
          font-family: var(--font-instrument-serif);
          font-size: 1.35rem;
          line-height: 1;
          text-decoration: none;
        }
        .admin-topbar-actions {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }
        .admin-topbar-link {
          border: 0.5px solid var(--border);
          border-radius: 999px;
          padding: 0.5rem 0.85rem;
          color: var(--text-secondary);
          font-family: var(--font-dm-sans);
          font-size: 0.78rem;
          font-weight: 600;
          text-decoration: none;
        }
        .admin-topbar-link.primary {
          border-color: rgba(200,245,90,0.26);
          background: #C8F55A;
          color: #0A0A0A;
        }
        @media (max-width: 767px) {
          .admin-layout-main {
            padding: 1.25rem 1rem;
            padding-top: calc(56px + 1.25rem);
          }
          .admin-topbar {
            display: none;
          }
        }
      `}</style>
      <div className="admin-layout-wrapper">
        <AdminSidebar />
        <main className="admin-layout-main">
          <div className="admin-topbar">
            <Link href="/admin" className="admin-topbar-brand">
              <span style={{ color: "var(--text-primary)" }}>Event</span>
              <span style={{ color: "#C8F55A" }}>Slot</span>
            </Link>
            <div className="admin-topbar-actions">
              <Link href="/dashboard" className="admin-topbar-link">Organizer dashboard</Link>
              <Link href="/" className="admin-topbar-link primary">View site</Link>
            </div>
          </div>
          {children}
        </main>
      </div>
    </>
  )
}
