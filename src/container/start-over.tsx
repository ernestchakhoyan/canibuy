"use client";

import { haptic } from "@helper";
import { budgetActions } from "@store";
import { Button, Card } from "@widget";
import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

const HOLD_MS = 15_000;

/**
 * Danger zone: wipes the sheet and this device to start from scratch. The gate is a 15-second press-and-hold
 * (pointer, or Space / Enter): letting go or sliding off cancels, so it can't happen by accident.
 */
export function StartOver() {
  const t = useTranslations("setup.startOver");
  const [progress, setProgress] = useState(0); // 0 … 1
  const [status, setStatus] = useState<"idle" | "holding" | "working" | "failed">("idle");
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };
  // Leaving the page mid-hold must not keep counting.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    },
    []
  );

  const run = async () => {
    setStatus("working");
    haptic();
    if (!(await budgetActions.startOver())) {
      setStatus("failed");
      setProgress(0);
    }
    // success: the page reloads
  };

  const press = () => {
    if (timer.current !== null || status === "working") return;
    haptic();
    setStatus("holding");
    const began = performance.now();
    timer.current = window.setInterval(() => {
      const done = Math.min(1, (performance.now() - began) / HOLD_MS);
      setProgress(done);
      if (done === 1) {
        clear();
        run();
      }
    }, 100);
  };

  const release = () => {
    if (timer.current === null) return; // already finished (or never started)
    clear();
    setProgress(0);
    setStatus("idle");
  };

  const key = (event: KeyboardEvent, down: boolean) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (down && !event.repeat) press();
    if (!down) release();
  };

  const secondsLeft = Math.ceil(((1 - progress) * HOLD_MS) / 1000);

  return (
    <Card title={t("title")} className="ring-destructive/30">
      <p id="start-over-explain" className="text-sm text-muted-foreground">
        {t("explain")}
      </p>
      <Button
        variant="destructive"
        className="relative h-auto min-h-11 touch-none overflow-hidden py-2 select-none [-webkit-touch-callout:none]"
        aria-describedby="start-over-explain"
        disabled={status === "working"}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={(e) => key(e, true)}
        onKeyUp={(e) => key(e, false)}
        onContextMenu={(e) => e.preventDefault()} // long press opens the menu on phones
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-destructive/25 transition-[width] duration-100 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
        <RotateCcwIcon data-icon="inline-start" className="relative" />
        <span className="relative">
          {status === "working"
            ? t("working")
            : status === "holding"
              ? t("holding", { seconds: secondsLeft })
              : t("action")}
        </span>
      </Button>
      {status === "failed" && <p className="text-sm text-destructive">{t("failed")}</p>}
    </Card>
  );
}
