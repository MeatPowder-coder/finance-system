"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * KpiCard — tarjeta de métrica con icono, etiqueta, valor y tendencia.
 * Reemplaza las tarjetas `ui-kpi` repetidas sin diferenciación.
 *
 * Uso:
 *   <KpiCard label="Cuentas activas" value={5} icon={Wallet} />
 *   <KpiCard label="Neto del mes" value={monthNet} tone="positive" delta="+12%" />
 */
const kpiTone = cva(
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
  {
    variants: {
      tone: {
        neutral:
          "border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-panel-soft)_72%,transparent)] text-fg",
        accent:
          "border-[color-mix(in_srgb,var(--ui-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] text-[var(--ui-accent)]",
        positive:
          "border-[color-mix(in_srgb,var(--ui-positive)_28%,transparent)] bg-[color-mix(in_srgb,var(--ui-positive)_12%,transparent)] text-[var(--ui-positive)]",
        warning:
          "border-[color-mix(in_srgb,var(--ui-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--ui-warning)_12%,transparent)] text-[var(--ui-warning)]",
        danger:
          "border-[color-mix(in_srgb,var(--ui-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--ui-danger)_12%,transparent)] text-[var(--ui-danger)]",
      },
    },
    defaultVariants: { tone: "accent" },
  }
);

const valueTone: Record<string, string> = {
  accent: "text-[color-mix(in_srgb,var(--ui-accent)_82%,white)]",
  positive: "text-[color-mix(in_srgb,var(--ui-positive)_82%,white)]",
  warning: "text-[color-mix(in_srgb,var(--ui-warning)_82%,white)]",
  danger: "text-[color-mix(in_srgb,var(--ui-danger)_82%,white)]",
  neutral: "text-fg",
};

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: VariantProps<typeof kpiTone>["tone"];
  /** Variación porcentual opcional, ej. "+12%" o "-3%" */
  delta?: string;
  /** Si true, el delta positivo se muestra verde y negativo rojo */
  deltaTone?: boolean;
  caption?: React.ReactNode;
}

const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  (
    {
      label,
      value,
      icon,
      tone = "accent",
      delta,
      deltaTone = true,
      caption,
      className,
      ...props
    },
    ref
  ) => {
    const isPositive = delta?.trim().startsWith("+");
    return (
      <div
        ref={ref}
        className={cn(
          "ui-kpi flex items-start gap-3 rounded-[22px] p-4 md:p-5",
          className
        )}
        {...props}
      >
        {icon && <div className={cn(kpiTone({ tone }))}>{icon}</div>}
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-wide text-fg-secondary">
            {label}
          </p>
          <p
            className={cn(
              "text-xl font-semibold tracking-tight md:text-2xl",
              tone && tone !== "neutral" ? valueTone[tone as string] : "text-fg"
            )}
          >
            {value}
          </p>
          {(delta || caption) && (
            <div className="flex items-center gap-2 text-xs text-fg-subtle">
              {delta && (
                <span
                  className={
                    deltaTone
                      ? isPositive
                        ? "text-[color-mix(in_srgb,var(--ui-positive)_82%,white)]"
                        : delta.trim().startsWith("-")
                          ? "text-[color-mix(in_srgb,var(--ui-danger)_82%,white)]"
                          : "text-fg-secondary"
                      : "text-fg-secondary"
                  }
                >
                  {delta}
                </span>
              )}
              {caption && <span className="truncate">{caption}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }
);
KpiCard.displayName = "KpiCard";

export { KpiCard };
