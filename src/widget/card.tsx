import type { ReactNode } from "react";

type Props = { title?: string; action?: ReactNode; children: ReactNode };

export function Card({ title, action, children }: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      {(title || action) && (
        <header className="flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
