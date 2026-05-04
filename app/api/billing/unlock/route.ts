import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint is deprecated. Core features are now open access.',
      code: 'ENDPOINT_DEPRECATED',
    },
    { status: 410 }
  )
}
