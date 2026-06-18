import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isAdminEmail } from "@/lib/isAdmin"
import AdminSidebar from "./AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/signin?callbackUrl=/admin&reason=admin')
  }

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.isAdmin || isAdminEmail(session?.user?.email)
  if (!isAdmin) {
    redirect('/unauthorized')
  }

  return (
    <>
      <style>{`
        .admin-layout-wrapper {
          display: flex;
          min-height: 100vh;
          background: #080808;
        }
        .admin-layout-main {
          flex: 1;
          overflow-y: auto;
          padding: 2.5rem 2rem;
        }
        @media (max-width: 767px) {
          .admin-layout-main {
            padding: 1.25rem 1rem;
            padding-top: calc(56px + 1.25rem);
          }
        }
      `}</style>
      <div className="admin-layout-wrapper">
        <AdminSidebar />
        <main className="admin-layout-main">
          {children}
        </main>
      </div>
    </>
  )
}
