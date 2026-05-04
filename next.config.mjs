import withPWA from '@ducanh2912/next-pwa'

const withPWAConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/app-build-manifest\.json$/],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://www.eventsslot.com',
    NEXTAUTH_URL_INTERNAL:
      process.env.NEXTAUTH_URL_INTERNAL || process.env.NEXTAUTH_URL || 'https://www.eventsslot.com',
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      // Allow Android Digital Asset Links to be fetched cleanly
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline for hydration scripts; unsafe-eval for some builds
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Inline styles used throughout; no external style CDN (next/font/google self-hosts)
              "style-src 'self' 'unsafe-inline'",
              // Fonts are self-hosted via next/font/google in /_next/static/media/
              "font-src 'self'",
              // R2 images, Google OAuth profile photos, data/blob URIs for upload previews
              "img-src 'self' data: blob: https://*.r2.dev https://lh3.googleusercontent.com",
              // All API calls are relative; no external client-side fetches
              "connect-src 'self'",
              // No iframes loaded by this app
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              // Paystack checkout is a server-side URL redirect, no form POST needed
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ]
  },
};

export default withPWAConfig(nextConfig);
