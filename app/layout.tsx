import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import Nav from "../components/Nav";
import Providers from "../components/Providers";
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
  title: "EventSlot — Smart Event Registration",
  description: "Share a link. Fill your event. Waitlist runs itself.",
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
        </Providers>
      </body>
    </html>
  );
}
