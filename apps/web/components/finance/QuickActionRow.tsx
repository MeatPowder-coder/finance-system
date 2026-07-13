"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * QuickActionRow — fila de acciones rápidas con icono + label.
 * Reemplaza los botones sueltos dispersos.
 *
 * Uso:
 *   <QuickActionRow>
 *     <QuickAction icon={Plus} label="Nueva" onClick={...} />
 *     <QuickAction icon={Download} label="Exportar" onClick={...} />
 *   </QuickActionRow>
 */
export interface QuickActionRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const QuickActionRow = React.forwardRef<HTMLDivElement, QuickActionRowProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-wrap items-center gap-2 md:gap-2.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
QuickActionRow.displayName = "QuickActionRow";

export interface QuickActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  label: React.ReactNode;
  variant?: "primary" | "ghost";
}

const QuickAction = React.forwardRef<HTMLButtonElement, QuickActionProps>(
  ({ icon, label, variant = "ghost", className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-soft",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-bg)]",
        variant === "primary"
          ? "border-[color-mix(in_srgb,var(--ui-accent)_48%,transparent)] bg-[color-mix(in_srgb,var(--ui-accent)_18%,transparent)] text-[color-mix(in_srgb,var(--ui-accent)_92%,white)] hover:bg-[color-mix(in_srgb,var(--ui-accent)_28%,transparent)]"
          : "border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-panel-soft)_78%,transparent)] text-fg hover:border-[color-mix(in_srgb,var(--ui-accent)_40%,transparent)] hover:text-[var(--ui-accent)]",
        className
      )}
      {...props}
    >
      {icon}
      <span>{label}</span>
      {children}
    </button>
  )
);
QuickAction.displayName = "QuickAction";

export { QuickActionRow, QuickAction };
