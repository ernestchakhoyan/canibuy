"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Month" },
  { href: "/income", label: "Income" },
  { href: "/savings", label: "Savings" },
  { href: "/orders", label: "Orders" },
  { href: "/projects", label: "Projects" },
  { href: "/history", label: "History" },
  { href: "/setup", label: "Setup" },
] as const;

const NO_NAV = ["/connect"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showNav = !NO_NAV.includes(pathname);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col pb-24">
      <main className="flex flex-1 flex-col gap-4 px-4 pt-6">{children}</main>
      {showNav && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto flex max-w-2xl overflow-x-auto">
            {NAV.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-14 items-center justify-center px-1 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
