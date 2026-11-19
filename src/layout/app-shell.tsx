"use client";

import { cn } from "@helper";
import { Brand, Button } from "@widget";
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

/** Bottom bar: the four daily pages, split around the quick-add button. */
const TABS = [
  [
    { href: "/", label: "Month", icon: CalendarDaysIcon },
    { href: "/orders", label: "Orders", icon: ShoppingBagIcon },
  ],
  [
    { href: "/savings", label: "Savings", icon: PiggyBankIcon },
    { href: "/projects", label: "Projects", icon: HammerIcon },
  ],
] as const;

/** Header icons: pages visited less often. */
const HEADER_LINKS = [
  { href: "/income", label: "Income", icon: WalletIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/setup", label: "Setup", icon: SettingsIcon },
] as const;

const NO_NAV = ["/connect"];

type Props = { children: ReactNode; quickAdd: ReactNode };

export function AppShell({ children, quickAdd }: Props) {
  const pathname = usePathname();
  const showNav = !NO_NAV.includes(pathname);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const tab = ({ href, label, icon: Icon }: (typeof TABS)[number][number]) => {
    const active = isActive(href);
    return (
      <li key={href} className="flex-1">
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors",
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
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col pb-24">
      {showNav && (
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
          <Link href="/" className="flex h-14 items-center">
            <Brand />
          </Link>
          <nav aria-label="More">
            <ul className="flex items-center gap-1">
              {HEADER_LINKS.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={label}
                      title={label}
                      aria-current={active ? "page" : undefined}
                      className={cn("rounded-full", active && "bg-primary/12 text-primary hover:text-primary")}
                      nativeButton={false}
                      render={<Link href={href} />}
                    >
                      <Icon />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </header>
      )}
      <main className="flex flex-1 flex-col gap-4 px-4 pt-2">{children}</main>
      {showNav && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
        >
          <ul className="mx-auto flex max-w-2xl items-center px-2">
            {TABS[0].map(tab)}
            <li className="flex flex-1 justify-center">{quickAdd}</li>
            {TABS[1].map(tab)}
          </ul>
        </nav>
      )}
    </div>
  );
}
