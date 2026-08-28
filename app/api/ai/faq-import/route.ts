// app/api/ai/faq-import/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function parseFaqsFromRawText(text: string): Array<{ question: string; answer: string }> {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const results: Array<{ question: string; answer: string }> = []

  let currentQ = ''
  let currentA: string[] = []

  for (const line of lines) {
    // Match patterns like "Q: ...", "1. ...?", "Question: ...", or lines ending with '?'
    const isQ = /^(Q\d*[:.]|Question\d*[:.]|\d+[.)])\s*/i.test(line) || (line.endsWith('?') && line.length < 150)
    const isA = /^(A\d*[:.]|Answer\d*[:.]|Ans[:.])\s*/i.test(line)

    if (isQ && !isA) {
      if (currentQ) {
        results.push({
          question: currentQ.replace(/^(Q\d*[:.]|Question\d*[:.]|\d+[.)])\s*/i, '').trim(),
          answer: currentA.join(' ').replace(/^(A\d*[:.]|Answer\d*[:.]|Ans[:.])\s*/i, '').trim() || 'Please contact organizer for details.'
        })
        currentA = []
      }
      currentQ = line
    } else if (isA) {
      currentA.push(line.replace(/^(A\d*[:.]|Answer\d*[:.]|Ans[:.])\s*/i, '').trim())
    } else if (currentQ) {
      currentA.push(line)
    }
  }

  if (currentQ) {
    results.push({
      question: currentQ.replace(/^(Q\d*[:.]|Question\d*[:.]|\d+[.)])\s*/i, '').trim(),
      answer: currentA.join(' ').replace(/^(A\d*[:.]|Answer\d*[:.]|Ans[:.])\s*/i, '').trim() || 'Please contact organizer for details.'
    })
  }

  return results
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const rawText = String(body.text || '').trim()

    if (!rawText) {
      return NextResponse.json({ error: 'Please provide document text or questions to import.' }, { status: 400 })
    }

    const groqKey = process.env.GROQ_API_KEY
    if (groqKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: 'You are an event FAQ parser. Extract questions and concise answers from the provided text. Return ONLY a JSON array with schema: [{"question": "string", "answer": "string"}]. No extra explanation.',
              },
              { role: 'user', content: rawText },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        })

        if (groqRes.ok) {
          const data = await groqRes.json()
          const content = data.choices?.[0]?.message?.content
          if (content) {
            const parsed = JSON.parse(content)
            const faqs = Array.isArray(parsed) ? parsed : parsed.faqs || parsed.questions || []
            if (Array.isArray(faqs) && faqs.length > 0) {
              return NextResponse.json({
                success: true,
                faqs: faqs.map((f: { question?: string; answer?: string }) => ({
                  question: String(f.question || '').trim(),
                  answer: String(f.answer || '').trim(),
                })).filter(f => f.question && f.answer),
              })
            }
          }
        }
      } catch (err) {
        console.warn('[faq-import] Groq API fallback to heuristic parser:', err)
      }
    }

    // Fallback heuristic parser
    const fallbackFaqs = parseFaqsFromRawText(rawText)
    return NextResponse.json({
      success: true,
      faqs: fallbackFaqs.length > 0 ? fallbackFaqs : [{ question: 'General Inquiry', answer: rawText.slice(0, 300) }],
    })
  } catch (error) {
    console.error('[faq-import] Error:', error)
    return NextResponse.json({ error: 'Failed to parse FAQ document.' }, { status: 500 })
  }
}
