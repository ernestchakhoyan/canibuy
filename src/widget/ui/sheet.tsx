"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/widget/ui/button";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn("fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs", className)}
      {...props}
    />
  );
}

/** Off-screen position per side; Motion slides the popup from/to it. */
const OFFSCREEN = {
  top: "translateY(-100%)",
  right: "translateX(100%)",
  bottom: "translateY(100%)",
  left: "translateX(-100%)",
} as const;

/** No overshoot: this is a money app. `transform`/`opacity` run on the compositor, which Base UI also detects. */
const SLIDE = { type: "spring", bounce: 0, visualDuration: 0.35 } as const;
const FADE = { duration: 0.2, ease: "easeOut" } as const;
const LEAVE = { duration: 0.2, ease: "easeIn" } as const;

/**
 * `open` must mirror the `Sheet` root's state: `AnimatePresence` keeps the portal mounted (`keepMounted`)
 * until the exit animation finishes.
 */
function SheetContent({
  className,
  children,
  open,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  open: boolean;
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  const t = useTranslations("sheet");
  return (
    <AnimatePresence>
      {open && (
        <SheetPortal keepMounted>
          <SheetOverlay
            render={
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} />
            }
          />
          <SheetPrimitive.Popup
            data-slot="sheet-content"
            data-side={side}
            render={
              <motion.div
                initial={{ transform: OFFSCREEN[side] }}
                animate={{ transform: "none" }}
                exit={{ transform: OFFSCREEN[side], transition: LEAVE }}
                transition={SLIDE}
              />
            }
            className={cn(
              "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
              className
            )}
            {...props}
          >
            {children}
            {showCloseButton && (
              <SheetPrimitive.Close
                data-slot="sheet-close"
                render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}
              >
                <XIcon />
                <span className="sr-only">{t("close")}</span>
              </SheetPrimitive.Close>
            )}
          </SheetPrimitive.Popup>
        </SheetPortal>
      )}
    </AnimatePresence>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-0.5 p-4", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-base font-medium text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
