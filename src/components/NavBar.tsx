"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEAGUES } from "@/lib/leagues";
import { LeagueBadge } from "@/components/LeagueBadge";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/replay", label: "Replay" },
  { href: "/value", label: "Value Bets" },
  { href: "/fixtures", label: "Fixtures" },
  { href: "/backtest", label: "Track record" },
];

export function NavBar() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-plane/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span
            className="grid h-8 w-8 place-items-center rounded-md text-good-ink"
            style={{ background: "var(--color-brand)" }}
            aria-hidden
          >
            <BallIcon />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Edge<span className="text-muted"> · football</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-surface-2 text-ink"
                  : "text-ink-2 hover:bg-surface hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-1.5 md:flex">
          {LEAGUES.slice(0, 8).map((l) => (
            <Link
              key={l.code}
              href={`/leagues/${l.code}`}
              title={l.name}
              className={`rounded-md p-0.5 transition-transform hover:scale-105 ${
                path === `/leagues/${l.code}` ? "ring-1 ring-line-2" : ""
              }`}
            >
              <LeagueBadge code={l.code} size="sm" />
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

function BallIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7.5l3.2 2.3-1.2 3.7h-4L8.8 9.8 12 7.5z"
        fill="currentColor"
      />
    </svg>
  );
}
