import { NextRequest, NextResponse } from 'next/server'

// Resolve the user's country from standard geo-IP headers.
// Vercel injects x-vercel-ip-country; Cloudflare injects cf-ipcountry.
// On Cloud Run without a CDN the header won't be present, so we fall back to 'US'.
export async function GET(req: NextRequest) {
  const countryCode = (
    req.headers.get('x-vercel-ip-country') ??
    req.headers.get('cf-ipcountry') ??
    req.headers.get('x-country-code') ??
    'US'
  ).toUpperCase()

  return NextResponse.json({ countryCode })
}
