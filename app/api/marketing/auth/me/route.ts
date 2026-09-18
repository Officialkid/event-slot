import { NextRequest, NextResponse } from "next/server"
import { getMarketingContext } from "@/lib/marketing/rbac"

export async function GET(req: NextRequest) {
  const context = await getMarketingContext(req)

  if (!context) {
    return NextResponse.json(
      { error: "Unauthorized. You are not an active member of the EventSlot Marketing Team." },
      { status: 401 }
    )
  }

  return NextResponse.json({
    user: {
      userId: context.userId,
      email: context.email,
      name: context.name,
      role: context.role,
      status: context.status,
      isSuperAdmin: context.isSuperAdmin,
      permissions: context.permissions,
    },
  })
}
