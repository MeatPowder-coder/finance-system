"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SectionHeader — cabecera de tarjeta/sección con título + caption opcional.
 * Reemplaza <CardHeader> con texto disperso.
 *
 * Uso:
 *   <SectionHeader title="Movimientos" caption="Una lista corta para leer rápido">
 *     {badgeConteo}
 *   </SectionHeader>
 */
export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  caption?: React.ReactNode;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ title, caption, icon, trailing, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-start justify-between gap-3 pb-3", className)}
        {...props}
      >
        <div className="flex items-start gap-2.5">
          {icon && (
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--ui-border)] text-[var(--ui-accent)]">
              {icon}
            </div>
          )}
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold tracking-tight text-fg">
              {title}
            </h2>
            {caption && (
              <p className="text-xs text-fg-secondary">{caption}</p>
            )}
          </div>
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    );
  }
);
SectionHeader.displayName = "SectionHeader";

export { SectionHeader };
