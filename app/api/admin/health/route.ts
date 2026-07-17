import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import nodemailer from "nodemailer"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"
import { env } from "@/lib/env"
import {
  extractEmailAddress,
  getConfiguredEmailFrom,
  shouldUseSmtpFromEnv,
  smtpIsConfiguredFromEnv,
} from "@/lib/emailProvider"

const EMAIL_FROM = getConfiguredEmailFrom(env, "")
const extractSenderEmail = (sender: string) => extractEmailAddress(sender).toLowerCase()

async function getProviderAcceptedCountSince(startDate: Date): Promise<number | null> {
  if (shouldUseSmtp()) return null
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
  provider: "smtp" | "resend"
  configured: boolean
  healthy: boolean
  message: string
}

type ResendDomainRow = {
  name?: string
  status?: string
}

function smtpIsConfigured() {
  return smtpIsConfiguredFromEnv(env)
}

function shouldUseSmtp() {
  return shouldUseSmtpFromEnv(env)
}

async function getSmtpProviderStatus(): Promise<EmailProviderStatus> {
  if (!smtpIsConfigured()) {
    return {
      provider: "smtp",
      configured: false,
      healthy: false,
      message: "SMTP_HOST, SMTP_PORT, SMTP_USER, or SMTP_PASSWORD missing",
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: env.SMTP_SECURE === "true" || Number(env.SMTP_PORT) === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    })
    await transporter.verify()
    return {
      provider: "smtp",
      configured: true,
      healthy: true,
      message: `SMTP provider reachable with sender ${extractSenderEmail(EMAIL_FROM) || env.SMTP_USER}`,
    }
  } catch (error) {
    return {
      provider: "smtp",
      configured: true,
      healthy: false,
      message: error instanceof Error ? error.message : "SMTP provider check failed",
    }
  }
}

function extractDomain(email: string) {
  const atIndex = email.lastIndexOf("@")
  return atIndex >= 0 ? email.slice(atIndex + 1).trim().toLowerCase() : ""
}

async function getEmailProviderStatus(): Promise<EmailProviderStatus> {
  if (shouldUseSmtp()) {
    return getSmtpProviderStatus()
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!EMAIL_FROM || !apiKey) {
    return {
      provider: "resend",
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
          provider: "resend",
          configured: true,
          healthy: false,
          message: "Testing sender only: verify a Resend domain to email real attendees.",
        }
      }

      if (!matchingDomain) {
        return {
          provider: "resend",
          configured: true,
          healthy: false,
          message: `Sender domain ${senderDomain || "unknown"} is not added in Resend.`,
        }
      }

      if (!domainVerified) {
        return {
          provider: "resend",
          configured: true,
          healthy: false,
          message: `Sender domain ${senderDomain} is not verified in Resend yet.`,
        }
      }

      return {
        provider: "resend",
        configured: true,
        healthy: true,
        message: `Provider reachable with verified sender ${senderEmail}`,
      }
    }

    const message = await response.text()
    return {
      provider: "resend",
      configured: true,
      healthy: false,
      message: message || `Provider check failed (${response.status})`,
    }
  } catch (error) {
    return {
      provider: "resend",
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
      emailProviderName: emailProviderStatus.provider,
      emailProviderMessage: emailProviderStatus.message,
    })
  } catch (err) {
    console.error("[admin/health] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
