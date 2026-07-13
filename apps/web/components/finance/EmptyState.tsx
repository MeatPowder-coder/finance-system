"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — estado vacío didáctico con ilustración + texto + CTA opcional.
 * Reemplaza: <td colSpan={N} className="py-5 text-center text-zinc-500">Sin datos…</td>
 *
 * Uso:
 *   <EmptyState icon={Wallet} title="No hay cuentas" action={<Button>Crear cuenta</Button>}>
 *     Crea tu primera cuenta para empezar a registrar movimientos.
 *   </EmptyState>
 */
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, children, action, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "ui-empty flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center",
          className
        )}
        {...props}
      >
        {icon && (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-panel-soft)_68%,transparent)] text-fg-subtle">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <p className="text-base font-medium text-fg-secondary">{title}</p>
          {children && (
            <p className="mx-auto max-w-sm text-sm text-fg-subtle">{children}</p>
          )}
        </div>
        {action && <div className="mt-1">{action}</div>}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
