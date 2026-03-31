import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { notFound } from "next/navigation"
import AdminSidebar from "./AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email || session.user.email !== process.env.SUPER_ADMIN_EMAIL) {
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
