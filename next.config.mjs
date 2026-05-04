import withPWA, { runtimeCaching as defaultRuntimeCaching } from '@ducanh2912/next-pwa'

const r2PublicUrl = process.env.R2_PUBLIC_URL
let r2PublicHostname = null

try {
  if (r2PublicUrl) {
    r2PublicHostname = new URL(r2PublicUrl).hostname
  }
} catch {
  r2PublicHostname = null
}

const imageRemotePatterns = [
  { protocol: 'https', hostname: '*.r2.dev', pathname: '/**' },
  { protocol: 'https', hostname: 'pub-08713a93a7a2437c89ead762d4588859.r2.dev', pathname: '/**' },
  { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
]

if (r2PublicHostname) {
  imageRemotePatterns.push({ protocol: 'https', hostname: r2PublicHostname, pathname: '/**' })
}

const imgSrcList = [
  "'self'",
  'data:',
  'blob:',
  'https://*.r2.dev',
  'https://lh3.googleusercontent.com',
]

const connectSrcList = [
  "'self'",
  'https://*.r2.dev',
  'https://www.googleapis.com',
  'https://oauth2.googleapis.com',
  'https://accounts.google.com',
]

if (r2PublicHostname) {
  imgSrcList.push(`https://${r2PublicHostname}`)
  connectSrcList.push(`https://${r2PublicHostname}`)
}

const runtimeCaching = defaultRuntimeCaching.filter((entry) => {
  const cacheName = entry?.options?.cacheName
  // Prevent noisy navigation/cross-origin no-response errors in production.
  return !['start-url', 'pages', 'pages-rsc', 'pages-rsc-prefetch', 'cross-origin'].includes(cacheName)
})

const withPWAConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/app-build-manifest\.json$/],
  fallbacks: {
    document: '/offline.html',
  },
  workboxOptions: {
    runtimeCaching,
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: imageRemotePatterns,
  },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://www.eventsslot.com',
    NEXTAUTH_URL_INTERNAL:
      process.env.NEXTAUTH_URL_INTERNAL || process.env.NEXTAUTH_URL || 'https://www.eventsslot.com',
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'eventsslot.com' }],
        destination: 'https://www.eventsslot.com/:path*',
        permanent: true,
      },
    ]
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
              `img-src ${imgSrcList.join(' ')}`,
                     // App APIs are same-origin, with external fetches to R2 and selected Google endpoints
                `connect-src ${connectSrcList.join(' ')}`,
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
