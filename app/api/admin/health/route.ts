import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isAdminEmail } from "@/lib/isAdmin"

const EMAIL_FROM = process.env.RESEND_FROM?.trim() || ""

function extractSenderEmail(sender: string) {
  const match = sender.match(/<([^>]+)>/)
  return (match?.[1] ?? sender).trim().toLowerCase()
}

async function getProviderAcceptedCountSince(startDate: Date): Promise<number | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!EMAIL_FROM || !apiKey) return null

  const response = await fetch("https://api.resend.com/emails?limit=100", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `HTTP ${response.status}`)
  }

  const payload = await response.json() as { data?: unknown; emails?: unknown }
  const rows = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.emails)
    ? payload.emails
    : []

  const senderEmail = extractSenderEmail(EMAIL_FROM)
  return rows.filter((row) => {
    const typed = row as { created_at?: string; createdAt?: string; from?: string }
    const createdRaw = typed.created_at ?? typed.createdAt
    if (!createdRaw) return false
    const createdDate = new Date(createdRaw)
    if (Number.isNaN(createdDate.getTime()) || createdDate < startDate) return false
    if (!typed.from) return true
    return typed.from.toLowerCase().includes(senderEmail)
  }).length
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    // DB ping
    let dbOk = false
    try {
      await prisma.$queryRaw`SELECT 1`
      dbOk = true
    } catch { /* fail silently */ }

    const [recentErrors, emailsAcceptedThisMonth] = await Promise.all([
      prisma.errorLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      getProviderAcceptedCountSince(startOfMonth).catch(async (err) => {
        await prisma.errorLog.create({
          data: {
            route: "/api/admin/health",
            message: `Resend list error: ${err instanceof Error ? err.message : "unknown error"}`,
          },
        })
        return null
      }),
    ])

    return NextResponse.json({
      dbOk,
      recentErrors,
      emailsAcceptedThisMonth,
      emailProviderConfigured: Boolean(process.env.RESEND_API_KEY && EMAIL_FROM),
    })
  } catch (err) {
    console.error("[admin/health] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
