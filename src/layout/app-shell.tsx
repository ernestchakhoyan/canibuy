"use client";

import { applyAppMode, cn, haptic } from "@helper";
import { Link, usePathname } from "@i18n";
import { useBudget } from "@store";
import { Button, Logo } from "@widget";
import {
  CalendarDaysIcon,
  HammerIcon,
  HistoryIcon,
  PiggyBankIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TelescopeIcon,
  WalletIcon,
} from "lucide-react";
import { MotionConfig } from "motion/react";
import { useTranslations } from "next-intl";
import { type ReactNode, Suspense, useEffect } from "react";

/** Bottom bar: the four daily pages, split around the quick-add button. */
const TABS = [
  [
    { href: "/", label: "month", icon: CalendarDaysIcon },
    { href: "/orders", label: "orders", icon: ShoppingBagIcon },
  ],
  [
    { href: "/savings", label: "savings", icon: PiggyBankIcon },
    { href: "/projects", label: "projects", icon: HammerIcon },
  ],
] as const;

/** Header icons: pages visited less often. */
const HEADER_LINKS = [
  { href: "/outlook", label: "outlook", icon: TelescopeIcon },
  { href: "/income", label: "income", icon: WalletIcon },
  { href: "/history", label: "history", icon: HistoryIcon },
  { href: "/setup", label: "setup", icon: SettingsIcon },
] as const;

const NO_NAV = ["/connect"];

type Props = { children: ReactNode; quickAdd: ReactNode };

/** `null` while the path isn't known yet (Suspense fallback): nothing is highlighted. */
const isActive = (pathname: string | null, href: string) =>
  pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

/**
 * Reads the path for its children. `usePathname` suspends while prerendering a route with dynamic params
 * (/projects/[id]), so each bar renders inside its own <Suspense> with an un-highlighted copy as the fallback:
 * the page itself (`children`) never waits on it.
 */
function WithPathname({ children }: { children: (pathname: string) => ReactNode }) {
  return children(usePathname());
}

function Header({ pathname }: { pathname: string | null }) {
  const t = useTranslations("nav");
  if (pathname !== null && NO_NAV.includes(pathname)) return null;
  return (
    // view-transition-name: its own layer above the page cross-fade (globals.css), so pages never cover it.
    <header className="sticky top-0 z-10 flex [view-transition-name:app-header] items-center justify-between gap-2 bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
      <Link href="/" onClick={haptic} className="flex h-14 items-center">
        <Logo />
      </Link>
      <nav aria-label={t("more")}>
        <ul className="flex items-center gap-1">
          {HEADER_LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t(label)}
                  title={t(label)}
                  aria-current={active ? "page" : undefined}
                  className={cn("rounded-full", active && "bg-primary/12 text-primary hover:text-primary")}
                  nativeButton={false}
                  render={<Link href={href} onClick={haptic} />}
                >
                  <Icon />
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

function BottomNav({ pathname, quickAdd }: { pathname: string | null; quickAdd: ReactNode }) {
  const t = useTranslations("nav");
  if (pathname !== null && NO_NAV.includes(pathname)) return null;

  const tab = ({ href, label, icon: Icon }: (typeof TABS)[number][number]) => {
    const active = isActive(pathname, href);
    return (
      <li key={href} className="flex-1">
        {/* Icon only: the name is the link's accessible name (and a tooltip), not shown. */}
        <Link
          href={href}
          onClick={haptic}
          aria-label={t(label)}
          title={t(label)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-16 items-center justify-center px-1 transition-colors",
            active ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span
            className={cn(
              "flex h-11 w-16 items-center justify-center rounded-xl transition-colors",
              active && "bg-primary/12"
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
          </span>
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-10 border-t [view-transition-name:app-nav] bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
    >
      <ul className="mx-auto flex max-w-2xl items-center px-2">
        {TABS[0].map(tab)}
        <li className="flex flex-1 justify-center">{quickAdd}</li>
        {TABS[1].map(tab)}
      </ul>
    </nav>
  );
}

export function AppShell({ children, quickAdd }: Props) {
  const appMode = useBudget()?.personal.appMode;

  // The <head> script applied the saved mode before paint; this follows later changes and, on System, the OS.
  useEffect(() => {
    if (!appMode) return; // still hydrating: keep what the script set
    applyAppMode(appMode);
    if (appMode !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyAppMode("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [appMode]);

  // Service worker (public/sw.js): makes the app installable, shows an offline page.
  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-24">
        <Suspense fallback={<Header pathname={null} />}>
          <WithPathname>{(pathname) => <Header pathname={pathname} />}</WithPathname>
        </Suspense>
        <main className="flex flex-1 flex-col gap-4 px-4 pt-2">{children}</main>
        <Suspense fallback={<BottomNav pathname={null} quickAdd={quickAdd} />}>
          <WithPathname>{(pathname) => <BottomNav pathname={pathname} quickAdd={quickAdd} />}</WithPathname>
        </Suspense>
      </div>
    </MotionConfig>
  );
}
