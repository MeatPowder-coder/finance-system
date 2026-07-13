"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * StatusPill — badge semántico para estados (activo, pendiente, etc.).
 * Reemplaza: <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200"> disperso.
 *
 * Uso:
 *   <StatusPill status="active" label="Activa" />
 *   <StatusPill tone="warning" label="Pendiente" />
 */
const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      tone: {
        positive:
          "border-[color-mix(in_srgb,var(--ui-positive)_34%,transparent)] bg-[color-mix(in_srgb,var(--ui-positive)_14%,transparent)] text-[color-mix(in_srgb,var(--ui-positive)_82%,white)]",
        warning:
          "border-[color-mix(in_srgb,var(--ui-warning)_34%,transparent)] bg-[color-mix(in_srgb,var(--ui-warning)_14%,transparent)] text-[color-mix(in_srgb,var(--ui-warning)_82%,white)]",
        danger:
          "border-[color-mix(in_srgb,var(--ui-danger)_34%,transparent)] bg-[color-mix(in_srgb,var(--ui-danger)_14%,transparent)] text-[color-mix(in_srgb,var(--ui-danger)_82%,white)]",
        accent:
          "border-[color-mix(in_srgb,var(--ui-accent)_34%,transparent)] bg-[color-mix(in_srgb,var(--ui-accent)_14%,transparent)] text-[color-mix(in_srgb,var(--ui-accent)_82%,white)]",
        muted:
          "border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-panel-soft)_72%,transparent)] text-fg-secondary",
      },
    },
    defaultVariants: { tone: "muted" },
  }
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  /** Estado conocido del finance system; mapea a tone automáticamente */
  status?: "active" | "pending" | "posted" | "reconciled" | "void" | "inactive";
  label?: React.ReactNode;
  dot?: boolean;
}

const statusTone: Record<
  NonNullable<StatusPillProps["status"]>,
  VariantProps<typeof pillVariants>["tone"]
> = {
  active: "positive",
  posted: "positive",
  reconciled: "accent",
  pending: "warning",
  void: "muted",
  inactive: "muted",
};

const statusLabel: Record<NonNullable<StatusPillProps["status"]>, string> = {
  active: "Activa",
  posted: "Confirmado",
  reconciled: "Reconciliado",
  pending: "Pendiente",
  void: "Anulado",
  inactive: "Inactiva",
};

const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ status, label, tone, dot = true, className, ...props }, ref) => {
    const resolvedTone = tone ?? (status ? statusTone[status] : "muted");
    const resolvedLabel = label ?? (status ? statusLabel[status] : "");
    return (
      <span
        ref={ref}
        className={cn(pillVariants({ tone: resolvedTone }), className)}
        {...props}
      >
        {dot && (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
        )}
        {resolvedLabel}
      </span>
    );
  }
);
StatusPill.displayName = "StatusPill";

export { StatusPill, pillVariants };
