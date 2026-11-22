"use client";

import { haptic } from "@helper";
import { Button } from "@widget";
import { DownloadIcon, ShareIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/** Chrome/Edge/Android's install event (not in TS's DOM types). */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED = "canibuy.installDismissed";

/**
 * "Install the app" note on the month page, until it runs installed or is dismissed. Chrome, Edge and Android get
 * a button (their install prompt); iPhone/iPad Safari has none, so it tells how to add it from the Share menu.
 * Browsers with neither (desktop Safari, Firefox) show nothing.
 */
export function InstallPrompt() {
  const t = useTranslations("install");
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const installed =
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED) === "1";
    } catch {}
    if (installed || dismissed) return;
    setHidden(false);
    setIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
    );
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our button
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setHidden(true);
    addEventListener("beforeinstallprompt", onPrompt);
    addEventListener("appinstalled", onInstalled);
    return () => {
      removeEventListener("beforeinstallprompt", onPrompt);
      removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || (!event && !ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
    setHidden(true);
  };
  const install = async () => {
    if (!event) return;
    haptic();
    await event.prompt();
    if ((await event.userChoice).outcome === "accepted") setHidden(true);
    setEvent(null); // a prompt can be shown once
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/8 p-3 text-sm">
      <DownloadIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-semibold">{t("title")}</p>
        <p className="text-muted-foreground">
          {event ? (
            t("text")
          ) : (
            <>
              {t("ios.before")}
              <ShareIcon className="mx-1 inline size-4 align-text-bottom" aria-label={t("ios.share")} />
              {t("ios.after")}
            </>
          )}
        </p>
        {event && (
          <Button size="sm" className="self-start" onClick={install}>
            <DownloadIcon data-icon="inline-start" />
            {t("action")}
          </Button>
        )}
      </div>
      <Button size="icon" variant="ghost" className="-mt-1 -mr-1" aria-label={t("dismiss")} onClick={dismiss}>
        <XIcon />
      </Button>
    </div>
  );
}
