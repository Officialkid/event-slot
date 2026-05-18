import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")

  const signupUrl = new URL("/signup", req.nextUrl.origin)

  const response = NextResponse.redirect(signupUrl)

  if (ref) {
    response.cookies.set("eventslot_ref", ref, {
      maxAge: 7 * 24 * 60 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })
  }

  return response
}
