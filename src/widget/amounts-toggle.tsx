"use client";

import { cn } from "@helper";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";

/** Masked form of an amount: keeps the currency symbol, hides the digits and their count. */
export const maskedMoney = (currency: string) => `${currency} ••••`;

type Props = { hidden: boolean; onToggle: () => void; className?: string };

/** Eye button that shows / hides money amounts (`aria-pressed` = amounts shown). */
export function AmountsToggle({ hidden, onToggle, className }: Props) {
  const t = useTranslations("common");
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={hidden ? t("showAmounts") : t("hideAmounts")}
      aria-pressed={!hidden}
      onClick={onToggle}
      className={cn("rounded-full", className)}
    >
      {hidden ? <EyeIcon /> : <EyeOffIcon />}
    </Button>
  );
}
