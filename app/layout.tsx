import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import Nav from "../components/Nav";
import Providers from "../components/Providers";
import { Toast } from "../components/Toast";
import { seedPrivilegedAccounts } from "@/lib/seedAdmins";
import { Analytics } from "@vercel/analytics/next";
import { defaultSEO } from "@/lib/seo.config";

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
  title: { default: defaultSEO.title, template: `%s | EventSlot` },
  description: defaultSEO.description,
  keywords: defaultSEO.keywords,
  metadataBase: new URL(defaultSEO.siteUrl),
  openGraph: {
    type: "website",
    locale: defaultSEO.locale,
    url: defaultSEO.siteUrl,
    siteName: defaultSEO.siteName,
    title: defaultSEO.title,
    description: defaultSEO.description,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EventSlot – Event Registration & Waitlist Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultSEO.title,
    description: defaultSEO.description,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: defaultSEO.siteUrl },
  manifest: "/manifest.json",
  themeColor: "#0A0A0A",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EventSlot",
  },
  icons: {
    apple: "/assets/logo-unfiltered.png",
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
  try { await seedPrivilegedAccounts() } catch { /* non-critical */ }

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
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
