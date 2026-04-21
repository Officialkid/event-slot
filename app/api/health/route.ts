import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const checks: Record<string, string> = {}

  // DB connectivity check
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    checks.database = `error: ${msg.slice(0, 100)}`
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks },
    { status: allOk ? 200 : 503 }
  )
}
