import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getEventInsights } from "@/lib/event-insights"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { eventId } = await params
  const url = new URL(req.url)
  const workspaceOrganizerId = url.searchParams.get("asOrganizationId")

  const insights = await getEventInsights(eventId, session.user.id, {
    userEmail: session.user.email,
    userRole: session.user.role,
    isAdmin: (session.user as { isAdmin?: boolean | null }).isAdmin,
    workspaceOrganizerId,
  })

  if (!insights) {
    return NextResponse.json(
      { error: "Event not found or access denied" },
      { status: 404 }
    )
  }

  return NextResponse.json(insights)
}
