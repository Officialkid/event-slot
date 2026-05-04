import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import Nav from "../components/Nav";
import Providers from "../components/Providers";
import { Toast } from "../components/Toast";
import { seedPrivilegedAccounts } from "@/lib/seedAdmins";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-serif",
});

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
  themeColor: "#a3e635",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EventSlot",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  icons: {
    apple: "/icons/icon-192x192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

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
      style={{
        background: "#0A0A0A",
        color: "#F0EDE6",
        fontFamily: "var(--font-dm-sans)",
      }}
      className={`${dmSans.variable} ${instrumentSerif.variable}`}
    >
      <body className="antialiased">
        <Providers>
          <Nav />
          {children}
          <Toast />
        </Providers>
      </body>
    </html>
  );
}
