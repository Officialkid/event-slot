import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EVENTSLOT_SYSTEM_PROMPT, SESSION_MAX_MESSAGES, DAILY_SESSION_LIMIT, OFF_TOPIC_MAX_ATTEMPTS } from '@/lib/assistant-context'
import { groq, ASSISTANT_MODEL } from '@/lib/groq'
import { SessionChannel, SessionStatus, MessageRole } from '@prisma/client'
import crypto from 'crypto'

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.IP_HASH_SALT ?? 'eventslot-salt')).digest('hex')
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// POST /api/assistant/chat — send a message
export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Assistant not configured' }, { status: 503 })
  }

  let body: { sessionId?: string; message?: string; channel?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { message, channel = 'text' } = body
  let { sessionId } = body

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  if (message.length > 1000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  const ipHash = hashIp(getClientIp(req))

  // Enforce daily session limit per IP
  if (!sessionId) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = await prisma.assistantSession.count({
      where: { ipHash, startedAt: { gte: today } },
    })
    if (todayCount >= DAILY_SESSION_LIMIT) {
      return NextResponse.json(
        { error: 'Daily session limit reached. Please try again tomorrow.' },
        { status: 429 }
      )
    }
  }

  // Create or load session
  let session
  if (sessionId) {
    session = await prisma.assistantSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!session || session.status === SessionStatus.ENDED) {
      return NextResponse.json({ error: 'Session not found or ended' }, { status: 404 })
    }
  } else {
    const ua = req.headers.get('user-agent') ?? undefined
    session = await prisma.assistantSession.create({
      data: {
        ipHash,
        userAgent: ua,
        channel: channel === 'voice' ? SessionChannel.VOICE : SessionChannel.TEXT,
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    sessionId = session.id
  }

  // Enforce per-session message limit
  if (session.messageCount >= SESSION_MAX_MESSAGES) {
    await prisma.assistantSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ENDED, endedAt: new Date() },
    })
    return NextResponse.json({
      sessionId,
      reply: "We've reached the message limit for this session. Thank you for contacting EventSlot. This session has ended. Have a wonderful day! 🌟",
      sessionEnded: true,
    })
  }

  // Save user message
  await prisma.assistantMessage.create({
    data: {
      sessionId: sessionId!,
      role: MessageRole.USER,
      content: message.trim(),
      isVoice: channel === 'voice',
    },
  })

  // Build conversation history for Groq (last 20 messages = 10 pairs)
  const historyMessages = session.messages.slice(-20).map(m => ({
    role: m.role === MessageRole.USER ? 'user' as const : 'assistant' as const,
    content: m.content,
  }))

  // Count off-topic redirects in history
  const offTopicCount = session.messages.filter(
    m => m.role === MessageRole.ASSISTANT && m.content.includes("I'm here to help with EventSlot questions")
  ).length

  let reply: string
  try {
    const completion = await groq.chat.completions.create({
      model: ASSISTANT_MODEL,
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: 'system', content: EVENTSLOT_SYSTEM_PROMPT },
        ...historyMessages,
        { role: 'user', content: message.trim() },
      ],
    })
    reply = completion.choices?.[0]?.message?.content ?? ''
    if (!reply) throw new Error('Empty response')
  } catch (err) {
    console.error('[assistant/chat] Groq error:', err)
    return NextResponse.json({ error: 'AI service unavailable, please try again' }, { status: 503 })
  }

  // Save assistant reply
  await prisma.assistantMessage.create({
    data: { sessionId: sessionId!, role: MessageRole.ASSISTANT, content: reply },
  })

  // Update message count
  await prisma.assistantSession.update({
    where: { id: sessionId },
    data: { messageCount: session.messageCount + 2 },
  })

  // Detect farewell → end session
  const farewellKeywords = ["goodbye", "bye", "thank you", "thanks", "that's all", "thats all", "done", "no more questions"]
  const isFarewell = farewellKeywords.some(kw => message.toLowerCase().includes(kw))
  let sessionEnded = false

  if (isFarewell) {
    await prisma.assistantSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ENDED, endedAt: new Date() },
    })
    sessionEnded = true
    reply = "Thank you for contacting EventSlot. This session has ended. Have a wonderful day! 🌟"
  }

  // Flag if off-topic limit exceeded or reply signals human follow-up needed
  const isUnresolved = reply.toLowerCase().includes("flagged this conversation") || reply.toLowerCase().includes("info@eventsslot.com")
  const shouldFlag = offTopicCount >= OFF_TOPIC_MAX_ATTEMPTS || isUnresolved
  const newOffTopicCount = session.offTopicCount + (reply.includes("I'm here to help with EventSlot questions") ? 1 : 0)

  if (shouldFlag && !session.flagged) {
    const flagReason = isUnresolved ? 'unresolved' : 'off-topic-limit'
    await prisma.assistantSession.update({
      where: { id: sessionId },
      data: { flagged: true, status: SessionStatus.FLAGGED, flagReason, offTopicCount: newOffTopicCount },
    })
  } else if (newOffTopicCount > session.offTopicCount) {
    await prisma.assistantSession.update({
      where: { id: sessionId },
      data: { offTopicCount: newOffTopicCount },
    })
  }

  return NextResponse.json({ sessionId, reply, sessionEnded, flagged: shouldFlag })
}
