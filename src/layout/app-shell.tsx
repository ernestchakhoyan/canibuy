"use client";

import { cn } from "@helper";
import { Brand } from "@widget";
import {
  CalendarDaysIcon,
  HammerIcon,
  HistoryIcon,
  PiggyBankIcon,
  SettingsIcon,
  ShoppingBagIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Month", icon: CalendarDaysIcon },
  { href: "/income", label: "Income", icon: WalletIcon },
  { href: "/savings", label: "Savings", icon: PiggyBankIcon },
  { href: "/orders", label: "Orders", icon: ShoppingBagIcon },
  { href: "/projects", label: "Projects", icon: HammerIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/setup", label: "Setup", icon: SettingsIcon },
] as const;

const NO_NAV = ["/connect"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showNav = !NO_NAV.includes(pathname);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col pb-24">
      {showNav && (
        <header className="sticky top-0 z-10 bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
          <Link href="/" className="flex h-14 w-fit items-center">
            <Brand />
          </Link>
        </header>
      )}
      <main className="flex flex-1 flex-col gap-4 px-4 pt-2">{children}</main>
      {showNav && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
        >
          <ul className="mx-auto flex max-w-2xl overflow-x-auto px-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors",
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                        active && "bg-primary/12"
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
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
