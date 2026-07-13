"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PageHeader — cabecera estándar de cada tab.
 * Reemplaza las cabeceras dispersas con título + subtítulo + acciones.
 *
 * Uso:
 *   <PageHeader title="Cuentas" subtitle="Donde vive tu liquidez hoy">
 *     <Button>Nueva cuenta</Button>
 *   </PageHeader>
 */
export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, subtitle, icon, actions, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] text-[var(--ui-accent)]">
              {icon}
            </div>
          )}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-fg-secondary">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    );
  }
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
