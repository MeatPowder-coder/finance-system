"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type AmountDirection = "inflow" | "outflow" | "neutral";

/**
 * AmountText — monto con signo y color semántico por dirección.
 * Reemplaza: <span class="text-emerald-300">+$1.200</span> disperso.
 *
 * Uso:
 *   <AmountText value={1200} direction="inflow" currency="COP" />
 */
export interface AmountTextProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> {
  value: number;
  currency?: string;
  direction?: AmountDirection;
  /** Mostrar signo + / - (default true) */
  signed?: boolean;
  /** Tamaño relativo */
  size?: "sm" | "md" | "lg" | "xl";
  bold?: boolean;
}

const sizeClass: Record<NonNullable<AmountTextProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-2xl",
};

const toneClass: Record<AmountDirection, string> = {
  inflow: "text-[color-mix(in_srgb,var(--ui-positive)_82%,white)]",
  outflow: "text-[color-mix(in_srgb,var(--ui-danger)_82%,white)]",
  neutral: "text-fg",
};

const AmountText = React.forwardRef<HTMLSpanElement, AmountTextProps>(
  (
    {
      value,
      currency = "COP",
      direction = "neutral",
      signed = true,
      size = "md",
      bold = false,
      className,
      ...props
    },
    ref
  ) => {
    const sign =
      signed && direction !== "neutral"
        ? direction === "inflow"
          ? "+"
          : "−"
        : "";
    return (
      <span
        ref={ref}
        className={cn(
          "tabular-nums tracking-tight",
          sizeClass[size],
          toneClass[direction],
          bold && "font-semibold",
          className
        )}
        {...props}
      >
        {sign} {formatMoney(value, currency)}
      </span>
    );
  }
);
AmountText.displayName = "AmountText";

// Helper local de formato (se unificará en lib/format.ts en el split).
function formatMoney(value: number, currency = "COP"): string {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${value} ${currency}`;
  }
}

export { AmountText };
