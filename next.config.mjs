import path from 'node:path'
import { fileURLToPath } from 'node:url'
import withPWA, { runtimeCaching as defaultRuntimeCaching } from '@ducanh2912/next-pwa'

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url))

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
  poweredByHeader: false,
  outputFileTracingRoot: workspaceRoot,

  // @react-pdf/renderer uses native Node.js modules that webpack cannot bundle.
  // Marking it as external causes Next.js to require() it at runtime instead.
  serverExternalPackages: ['@react-pdf/renderer'],

  // Ensure @react-pdf/renderer and its dependencies are included in the
  // standalone output so they are available in the Cloud Run Docker image.
  outputFileTracingIncludes: {
    '/api/tickets/[confirmationCode]': [
      './node_modules/@react-pdf/**/*',
      './node_modules/yoga-layout/**/*',
      './node_modules/fontkit/**/*',
      './node_modules/qrcode/**/*',
    ],
    '/api/events/[slug]/export/pdf': [
      './node_modules/@react-pdf/**/*',
      './node_modules/yoga-layout/**/*',
      './node_modules/fontkit/**/*',
    ],
  },

  // Explicitly disable source maps in production to prevent exposing readable
  // source code in browser DevTools.
  productionBrowserSourceMaps: false,

  // Strip console.log / console.warn / console.debug in production builds.
  // console.error is kept so server-side error logging still works.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
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
      // PWA icons — versioned by filename, safe to cache aggressively
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // PWA manifest — should revalidate regularly so icon updates propagate
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, must-revalidate" },
        ],
      },
      // Favicon files
      {
        source: "/favicon.ico",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/favicon.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      // Apple touch icon & splash screens
      {
        source: "/apple-touch-icon.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/splash/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      // Allow Android Digital Asset Links to be fetched cleanly
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type",              value: "application/json" },
          { key: "Cache-Control",             value: "public, max-age=3600" },
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
                     // App APIs are same-origin, with external fetches to R2 and selected Google endpoints
                     "connect-src 'self' https://*.r2.dev https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com",
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
