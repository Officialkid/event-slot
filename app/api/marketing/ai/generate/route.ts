import { NextRequest, NextResponse } from "next/server"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import { generateMarketingCopy } from "@/lib/marketing/gemini"

export async function POST(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canCreateContent")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await req.json()
    const { channel, campaignName, objective, topicOrIdea, targetAudience, tone, destinationUrl } = body

    if (!channel || !topicOrIdea) {
      return NextResponse.json(
        { error: "Channel and topic/idea are required for AI generation." },
        { status: 400 }
      )
    }

    const copy = await generateMarketingCopy({
      channel,
      campaignName: campaignName || "EventSlot Launch",
      objective: objective || "Brand Awareness & Registration Growth",
      topicOrIdea,
      targetAudience,
      tone,
      destinationUrl,
    })

    return NextResponse.json({ copy })
  } catch (error) {
    console.error("[AI Copy API error]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate AI copy" },
      { status: 500 }
    )
  }
}
