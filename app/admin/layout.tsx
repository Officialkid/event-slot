import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { notFound } from "next/navigation"
import { isAdminEmail } from "@/lib/isAdmin"
import AdminSidebar from "./AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!isAdminEmail(session?.user?.email)) {
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
