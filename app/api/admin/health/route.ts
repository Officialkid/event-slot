import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"

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

type EmailProviderStatus = {
  configured: boolean
  healthy: boolean
  message: string
}

type ResendDomainRow = {
  name?: string
  status?: string
}

function extractDomain(email: string) {
  const atIndex = email.lastIndexOf("@")
  return atIndex >= 0 ? email.slice(atIndex + 1).trim().toLowerCase() : ""
}

async function getEmailProviderStatus(): Promise<EmailProviderStatus> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!EMAIL_FROM || !apiKey) {
    return {
      configured: false,
      healthy: false,
      message: "RESEND_API_KEY or RESEND_FROM missing",
    }
  }

  try {
    const senderEmail = extractSenderEmail(EMAIL_FROM)
    const senderDomain = extractDomain(senderEmail)
    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    })

    if (response.ok) {
      const payload = await response.json() as { data?: unknown }
      const domains = Array.isArray(payload.data) ? payload.data as ResendDomainRow[] : []
      const matchingDomain = domains.find((row) => {
        const domainName = row.name?.trim().toLowerCase()
        if (!domainName) return false
        return domainName === senderDomain || senderDomain.endsWith(`.${domainName}`)
      })
      const domainVerified = matchingDomain?.status?.toLowerCase() === "verified"

      if (senderDomain === "resend.dev") {
        return {
          configured: true,
          healthy: false,
          message: "Testing sender only: verify a Resend domain to email real attendees.",
        }
      }

      if (!matchingDomain) {
        return {
          configured: true,
          healthy: false,
          message: `Sender domain ${senderDomain || "unknown"} is not added in Resend.`,
        }
      }

      if (!domainVerified) {
        return {
          configured: true,
          healthy: false,
          message: `Sender domain ${senderDomain} is not verified in Resend yet.`,
        }
      }

      return {
        configured: true,
        healthy: true,
        message: `Provider reachable with verified sender ${senderEmail}`,
      }
    }

    const message = await response.text()
    return {
      configured: true,
      healthy: false,
      message: message || `Provider check failed (${response.status})`,
    }
  } catch (error) {
    return {
      configured: true,
      healthy: false,
      message: error instanceof Error ? error.message : "Provider check failed",
    }
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    // DB ping
    let dbOk = false
    try {
      await prisma.$queryRaw`SELECT 1`
      dbOk = true
    } catch { /* fail silently */ }

    const [recentErrors, emailsAcceptedThisMonth, emailProviderStatus] = await Promise.all([
      prisma.errorLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      getProviderAcceptedCountSince(startOfMonth).catch((err) => {
        console.error("[admin/health] Resend list error:", err)
        return null
      }),
      getEmailProviderStatus(),
    ])

    return NextResponse.json({
      dbOk,
      recentErrors,
      emailsAcceptedThisMonth,
      emailProviderConfigured: emailProviderStatus.configured,
      emailProviderHealthy: emailProviderStatus.healthy,
      emailProviderMessage: emailProviderStatus.message,
    })
  } catch (err) {
    console.error("[admin/health] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
