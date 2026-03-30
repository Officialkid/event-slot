"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { title: "Home", href: "/" },
  { title: "Features", href: "/#how-it-works" },
  { title: "Get started", href: "/#get-started" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 bg-[#0A0A0A] border-b border-[rgba(240,237,230,0.1)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-[1.4rem] font-semibold tracking-tight" style={{ fontFamily: "var(--font-instrument-serif)" }}>
          <span className="text-[#F0EDE6]">Event</span>
          <span className="text-[#C8F55A]">Slot</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 text-sm font-medium ${isActive ? "text-[#C8F55A]" : "text-[rgba(240,237,230,0.65)]"}`}
              >
                {item.title}
                {isActive && <span className="h-2 w-2 rounded-full bg-[#C8F55A]" />}
              </Link>
            );
          })}
        </div>

        <Link
          href="/create"
          className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-[#0A0A0A] ${pathname === "/create" ? "bg-[#B7E86D]" : "bg-[#C8F55A]"}`}
        >
          Create an event
        </Link>
      </div>
    </nav>
  );
}
