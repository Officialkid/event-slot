import { askGroq } from "@/lib/groq"

interface GenerateMarketingCopyParams {
  channel: "INSTAGRAM" | "LINKEDIN" | "EMAIL" | "WHATSAPP" | "TWITTER_X" | "TIKTOK" | "WEBSITE"
  campaignName: string
  objective: string
  topicOrIdea: string
  targetAudience?: string
  tone?: "professional" | "enthusiastic" | "urgent" | "casual" | "educational"
  destinationUrl?: string
}

const CHANNEL_PROMPTS: Record<string, string> = {
  INSTAGRAM: `You are an expert Instagram growth marketer for EventSlot (event registration, ticketing, and check-in platform).
Write a high-converting Instagram post. Include:
1. An irresistible hook (first line) to stop scrolling
2. Engaging body copy with clean spacing (no wall of text)
3. Clear Call-To-Action (e.g. "Tap link in bio to explore")
4. 5-8 hyper-relevant hashtags (#EventTech #EventOrganizer #KenyaEvents #LiveEvents etc.)
Never use robotic language. Keep it punchy, vibrant, and visually structured.`,

  LINKEDIN: `You are a B2B SaaS brand strategist writing for EventSlot's LinkedIn page.
Write a thought-leadership LinkedIn post. Include:
1. A compelling opening thesis on event coordination, capacity bottlenecks, or audience retention
2. A brief, authentic breakdown of the problem vs. smart modern solution
3. 2-3 key bullet points or actionable takeaways
4. A professional invitation to discuss in the comments or check EventSlot
5. 3 strategic hashtags (#EventManagement #SaaS #TechInnovation)
Do not use fluffy buzzwords. Sound like an experienced founder/operations leader.`,

  WHATSAPP: `You are writing a broadcast message for an EventSlot community WhatsApp group or broadcast list.
Guidelines:
1. Start with a warm, energetic community headline using WhatsApp bold formatting (*Headline*)
2. Keep the body short, friendly, and easy to read on mobile screens (under 120 words)
3. Use WhatsApp formatting (*bold*, _italics_) tastefully
4. Include a direct call to action with a placeholder for the tracking link [TRACKING_LINK]
5. Make it feel personal and conversational, not spammy.`,

  EMAIL: `You are a direct-response email copywriter for EventSlot marketing broadcasts.
Generate:
1. 3 Subject Line options (High Open-Rate, Curiositiy, Benefit-driven)
2. A 1-sentence Preheader Preview Text
3. Email Body (Headline, engaging narrative, 3 benefit bullet points, closing)
4. A prominent CTA Button label
Target clean, modern SaaS email style that avoids promotional spam filters.`,
}

export async function generateMarketingCopy(params: GenerateMarketingCopyParams): Promise<string> {
  const channelPrompt = CHANNEL_PROMPTS[params.channel] || CHANNEL_PROMPTS.INSTAGRAM
  const userPrompt = `
Campaign: ${params.campaignName}
Objective: ${params.objective}
Audience: ${params.targetAudience || "Event organizers, universities, brands, community leaders"}
Topic / Idea: ${params.topicOrIdea}
Tone: ${params.tone || "enthusiastic"}
Destination Link: ${params.destinationUrl || "https://www.eventsslot.com"}

Generate channel-specific copy following your instructions strictly. Do not duplicate formats from other platforms.
`.trim()

  // 1. Check if GEMINI_API_KEY is configured
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (geminiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${channelPrompt}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200,
          },
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) return text
      }
    } catch (geminiError) {
      console.warn("[Gemini API call failed, falling back to Groq]", geminiError)
    }
  }

  // 2. Fallback to Groq / Llama
  try {
    return await askGroq({
      system: channelPrompt,
      prompt: userPrompt,
      taskType: "insights",
      maxTokens: 1200,
    })
  } catch (groqError) {
    console.error("[AI Copy Generation Error]", groqError)
    throw new Error("AI Assistant is temporarily unavailable. Please verify API keys.")
  }
}

export interface MarketingInsightsData {
  trackedVisits: number
  totalClicks: number
  signupsAttributed: number
  eventsCreatedAttributed: number
  topChannels: Array<{ channel: string; visits: number; conversions: number }>
  topCampaigns: Array<{ name: string; clicks: number; signups: number }>
  periodLabel: string
}

export async function generateMarketingInsights(data: MarketingInsightsData): Promise<{
  summary: string
  whatPerformedWell: string[]
  whatUnderperformed: string[]
  recommendations: string[]
}> {
  const prompt = `
Analyze the following marketing performance data for EventSlot over ${data.periodLabel}:
- Tracked Visits: ${data.trackedVisits}
- Link Clicks: ${data.totalClicks}
- Attributed Signups: ${data.signupsAttributed}
- Attributed Events Created: ${data.eventsCreatedAttributed}
- Channel Performance: ${JSON.stringify(data.topChannels)}
- Top Campaigns: ${JSON.stringify(data.topCampaigns)}

Provide an objective marketing intelligence analysis.
Return valid JSON only in this exact format:
{
  "summary": "Executive summary of marketing momentum (2-3 sentences)",
  "whatPerformedWell": ["bullet 1", "bullet 2"],
  "whatUnderperformed": ["bullet 1", "bullet 2"],
  "recommendations": ["experiment recommendation 1", "experiment recommendation 2"]
}
Do not speculate without data. Keep conclusions strictly grounded in the metrics provided.
`.trim()

  const system = "You are an analytical marketing intelligence director. Return only valid raw JSON."

  let rawJson = ""
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (geminiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
      })
      if (res.ok) {
        const json = await res.json()
        rawJson = json.candidates?.[0]?.content?.parts?.[0]?.text || ""
      }
    } catch {}
  }

  if (!rawJson) {
    try {
      rawJson = await askGroq({
        system,
        prompt,
        taskType: "insights",
        maxTokens: 1000,
      })
    } catch {
      return {
        summary: `During ${data.periodLabel}, EventSlot generated ${data.trackedVisits} tracked visits resulting in ${data.signupsAttributed} signups and ${data.eventsCreatedAttributed} events created.`,
        whatPerformedWell: ["Traffic tracking successfully established across active marketing channels."],
        whatUnderperformed: ["More volume is needed to reach statistical significance across all campaigns."],
        recommendations: ["Focus next content sprint on highest converting channel."],
      }
    }
  }

  try {
    const cleaned = rawJson.replace(/```json/g, "").replace(/```/g, "").trim()
    return JSON.parse(cleaned)
  } catch {
    return {
      summary: `During ${data.periodLabel}, EventSlot generated ${data.trackedVisits} tracked visits resulting in ${data.signupsAttributed} signups.`,
      whatPerformedWell: ["Tracking active."],
      whatUnderperformed: ["Data density still growing."],
      recommendations: ["Continue scheduled posting cadence."],
    }
  }
}
