import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Nav from "../components/Nav";
import Providers from "../components/Providers";
import { Toast } from "../components/Toast";
import { DevToolsDetector } from "../components/DevToolsDetector";
import { seedPrivilegedAccounts } from "@/lib/seedAdmins";

const dmSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-dm-sans",
  weight: "100 900",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#a3e635",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.eventsslot.com"),
  title: {
    default: "EventSlot | Event Registration and Waitlist Platform",
    template: "EventSlot | %s",
  },
  description:
    "EventSlot is an event registration platform built for organizers who run events with limited slots. Also searched as Event Slot, it helps you create events, share one link, and handle registrations, waitlists, and automatic confirmations — free.",
  keywords: [
    "eventslot",
    "event slot",
    "events slot",
    "event registration platform",
    "event waitlist system",
    "event management tool",
    "RSVP system",
    "event booking system",
    "online event registration",
    "free event registration platform",
    "event registration app",
    "event registration Kenya",
    "event management Nairobi",
    "free event registration",
    "event slot management",
  ],
  authors: [{ name: "EventSlot", url: "https://www.eventsslot.com" }],
  creator: "EventSlot",
  publisher: "EventSlot",
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: "https://www.eventsslot.com",
    siteName: "EventSlot",
    title: "EventSlot — Smart Event Registration & Waitlist Platform",
    description:
      "EventSlot is an event registration platform built for organizers who run events with limited slots. Manage registrations, waitlists, and automatic confirmations — free.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "EventSlot — Smart Event Registration Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@eventsslot",
    creator: "@eventsslot",
    title: "EventSlot — Smart Event Registration & Waitlist Platform",
    description:
      "Create events, share one link, fill slots automatically. EventSlot handles registrations and waitlists — no spreadsheets needed.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.eventsslot.com",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EventSlot",
    startupImage: [
      // iPad Pro 12.9"
      {
        url: "/splash/splash-2048x2732.png",
        media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPad Pro 11"
      {
        url: "/splash/splash-1668x2388.png",
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPhone 14 Pro Max
      {
        url: "/splash/splash-1290x2796.png",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone 14 Pro
      {
        url: "/splash/splash-1179x2556.png",
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone 14 / 13 / 12
      {
        url: "/splash/splash-1170x2532.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      // Generic / older iPhones
      {
        url: "/splash/splash-1080x1920.png",
        media: "(device-width: 360px) and (device-height: 640px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone SE / 8
      {
        url: "/splash/splash-750x1334.png",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/favicon.ico",            sizes: "any" },
      { url: "/favicon.svg",            type: "image/svg+xml" },
      { url: "/icons/icon-16x16.png",   sizes: "16x16",   type: "image/png" },
      { url: "/icons/icon-32x32.png",   sizes: "32x32",   type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png",   sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/favicon.svg", color: "#a3e635" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#0a0a0a",
    "msapplication-TileImage": "/icons/icon-144x144.png",
    "format-detection": "telephone=no",
  },
};

const themeInitScript = `
  (() => {
    try {
      const storedTheme = window.localStorage.getItem("eventslot-theme");
      const systemPrefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      const nextTheme = storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : systemPrefersLight
          ? "light"
          : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);
      document.documentElement.style.background = nextTheme === "light" ? "#F7F7F2" : "#0A0A0A";
      document.documentElement.style.color = nextTheme === "light" ? "#171717" : "#F0EDE6";
    } catch {}
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shouldSeedPrivilegedAccounts =
    process.env.CI !== "true" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.SKIP_PRIVILEGED_SEED !== "true";

  if (shouldSeedPrivilegedAccounts) {
    try {
      await seedPrivilegedAccounts();
    } catch {
      /* non-critical */
    }
  }

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      style={{
        background: "#0A0A0A",
        color: "#F0EDE6",
        fontFamily: "var(--font-dm-sans)",
      }}
      className={dmSans.variable}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Microsoft tile meta */}
        <meta name="msapplication-config" content="/browserconfig.xml" />
        {/* PWA theme color for Android Chrome address bar */}
        <meta name="theme-color" content="#a3e635" />
        {/* Prevent iOS phone-number auto-detection */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="antialiased">
        <Providers>
          <Nav />
          {children}
          <Toast />
          <DevToolsDetector />
        </Providers>
      </body>
    </html>
  );
}
