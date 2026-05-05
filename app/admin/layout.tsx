import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { notFound } from "next/navigation"
import { isAdminEmail } from "@/lib/isAdmin"
import AdminSidebar from "./AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  // Grant access if env-var admin email matches OR if DB flagged isAdmin=true.
  // Belt-and-suspenders: env var check works even if DB seed hasn't run yet;
  // DB check works even if env var is misconfigured on a deployment platform.
  const isAdmin = isAdminEmail(session?.user?.email) || session?.user?.isAdmin === true
  if (!isAdmin) {
    notFound()
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080808" }}>
      <AdminSidebar />
      <main style={{ flex: 1, overflowY: "auto", padding: "2.5rem 2rem" }}>
        {children}
      </main>
    </div>
  )
}
