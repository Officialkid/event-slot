import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Paid-event checkout is temporarily under maintenance. Please use the free plan while we finish the live payment setup.",
    },
    { status: 503 }
  )
}
