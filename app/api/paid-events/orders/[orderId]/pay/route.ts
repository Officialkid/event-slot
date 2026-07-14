import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Paid-event checkout is temporarily under maintenance. Please try again after the payment service returns.",
    },
    { status: 503 }
  )
}
