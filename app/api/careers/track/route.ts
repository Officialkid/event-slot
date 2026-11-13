import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { careerTrackRatelimit } from "@/lib/ratelimit"
import {
  APPLICATION_STATUSES,
  type PublicTrackingResponse,
  type ApplicationStatusValue,
} from "@/lib/recruitment/types"

function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    const single = parts[0]
    return single.length > 2 ? `${single.slice(0, 2)}***` : `${single[0]}***`
  }
  const firstName = parts[0]
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || ""
  return `${firstName} ${lastInitial}.`
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1"

    const { success } = await careerTrackRatelimit.limit(ip)
    if (!success) {
      return NextResponse.json(
        { error: "Too many status lookups. Please wait a minute before trying again." },
        { status: 429 }
      )
    }

    const body = await req.json()
    const rawRef = body.referenceCode
    const rawEmail = body.email

    if (!rawRef || typeof rawRef !== "string" || !rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json(
        { error: "Please enter both your reference code and email address." },
        { status: 400 }
      )
    }

    const cleanRef = rawRef.trim().toUpperCase()
    const cleanEmail = rawEmail.trim().toLowerCase()

    if (!cleanRef.startsWith("ES-CARE-") || cleanRef.length < 12) {
      return NextResponse.json(
        { error: "Invalid reference code format. Reference codes start with 'ES-CARE-' followed by 8 characters." },
        { status: 400 }
      )
    }

    const application = await prisma.jobApplication.findFirst({
      where: {
        referenceCode: cleanRef,
        email: cleanEmail,
      },
      include: {
        vacancy: {
          select: {
            title: true,
            type: true,
            department: true,
          },
        },
      },
    })

    if (!application) {
      // Generic mismatch message prevents email enumeration & code guessing
      return NextResponse.json(
        {
          error:
            "No application found matching the provided reference code and email address. Please check your details and try again.",
        },
        { status: 404 }
      )
    }

    const statusMeta = APPLICATION_STATUSES.find((s) => s.value === application.status)

    const response: PublicTrackingResponse = {
      referenceCode: application.referenceCode,
      candidateDisplayName: maskName(application.fullName),
      positionTitle: application.vacancy.title,
      opportunityType: application.vacancy.type,
      submittedAt: application.submittedAt.toISOString(),
      status: application.status as ApplicationStatusValue,
      statusLabel: statusMeta?.label || application.status,
      statusDescription:
        statusMeta?.description || "Your application is being actively processed by our team.",
      lastStatusUpdateAt: application.updatedAt.toISOString(),
    }

    return NextResponse.json(response)
  } catch (err: any) {
    console.error("[CAREERS_TRACK_API_ERROR]", err)
    return NextResponse.json(
      { error: "Unable to retrieve application status at this time. Please try again shortly." },
      { status: 500 }
    )
  }
}
