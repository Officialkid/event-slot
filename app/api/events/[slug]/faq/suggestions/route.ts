import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSuggestionsForCategory } from '@/lib/faqSuggestions'

// GET /api/events/[slug]/faq/suggestions — organiser editor, returns category-based suggestions
export async function GET(
  _: NextRequest,
  { params }: { params: { slug: string } }
) {
  const event = await prisma.event.findUnique({
    where: { slug: params.slug },
    select: { category: true },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const suggestions = getSuggestionsForCategory(event.category ?? 'DEFAULT')
  return NextResponse.json({ suggestions })
}
