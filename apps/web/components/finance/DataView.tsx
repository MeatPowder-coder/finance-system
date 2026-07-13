"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DataView — tabla responsive que se vuelve tarjetas en móvil.
 * Reemplaza las tablas crudas `min-w-[780px]` que fuerzan scroll horizontal.
 *
 * API abstracta: recibe columnas (key, header, render) y filas genéricas.
 * En >= md: <table> real. En < md: cada fila es una tarjeta con los campos.
 *
 * Uso:
 *   <DataView
 *     columns={[
 *       { key: "name", header: "Nombre" },
 *       { key: "balance", header: "Saldo", align: "right", render: (r) => formatMoney(r.balance) },
 *     ]}
 *     rows={accounts}
 *     empty={<EmptyState .../>}
 *   />
 */
export interface DataViewColumn<T> {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right" | "center";
  /** Render custom de la celda; default uses row[key] */
  render?: (row: T) => React.ReactNode;
  /** Ocultar esta columna en la vista de tarjeta (móvil) */
  hideOnCard?: boolean;
  /** Destacar como título de la tarjeta (móvil) — se muestra en grande */
  cardTitle?: boolean;
}

export interface DataViewProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  columns: DataViewColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => React.Key;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

function DataViewInner<T extends Record<string, unknown>>(
  {
    columns,
    rows,
    rowKey,
    empty,
    onRowClick,
    dense = false,
    className,
    ...props
  }: DataViewProps<T>,
  ref: React.Ref<HTMLDivElement>
) {
  if (rows.length === 0 && empty) {
    return <div ref={ref} className={className} {...props}>{empty}</div>;
  }

  const cellPad = dense ? "py-2 px-3" : "py-2.5 pr-3";

  return (
    <div
      ref={ref}
      className={cn("finance-scrollbar min-w-0 max-w-full overflow-x-auto", className)}
      {...props}
    >
      {/* Desktop / tablet: tabla real */}
      <table className="hidden min-w-[900px] w-full text-sm md:table">
        <thead className="sticky top-0 z-10 bg-[color-mix(in_srgb,var(--ui-panel-strong)_94%,transparent)] backdrop-blur">
          <tr className="border-b border-[var(--ui-border)] text-fg-secondary">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  cellPad,
                  "font-medium text-xs uppercase tracking-wide",
                  alignClass[col.align ?? "left"]
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={rowKey(row, idx)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-[color-mix(in_srgb,var(--ui-border)_60%,transparent)] text-fg transition-colors",
                onRowClick && "cursor-pointer hover:bg-[color-mix(in_srgb,var(--ui-accent)_6%,transparent)]"
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(cellPad, alignClass[col.align ?? "left"])}
                >
                  {col.render
                    ? col.render(row)
                    : (row[col.key] as React.ReactNode) ?? null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Móvil: tarjetas por fila */}
      <div className="space-y-2.5 md:hidden">
        {rows.map((row, idx) => (
          <button
            key={rowKey(row, idx)}
            type="button"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "ds-list-row w-full text-left",
              !onRowClick && "cursor-default"
            )}
          >
            <dl className="space-y-1.5">
              {columns
                .filter((c) => !c.hideOnCard)
                .map((col) => {
                  const isTitle = col.cardTitle;
                  return (
                    <div
                      key={col.key}
                      className={cn(
                        "flex gap-2",
                        col.align === "right" ? "justify-between" : "justify-between"
                      )}
                    >
                      <dt
                        className={cn(
                          "text-xs text-fg-subtle",
                          isTitle && "sr-only"
                        )}
                      >
                        {!isTitle && col.header}
                      </dt>
                      <dd
                        className={cn(
                          "text-sm",
                          isTitle
                            ? "w-full text-base font-semibold text-fg"
                            : "text-right font-medium text-fg",
                          col.align === "right" && !isTitle && "text-right"
                        )}
                      >
                        {col.render
                          ? col.render(row)
                          : (row[col.key] as React.ReactNode) ?? null}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          </button>
        ))}
      </div>
    </div>
  );
}

// forwardRef con genéricos requiere un casteo; patrón conocido.
export const DataView = React.forwardRef(DataViewInner) as <T extends Record<string, unknown>>(
  props: DataViewProps<T> & { ref?: React.Ref<HTMLDivElement> }
) => ReturnType<typeof DataViewInner>;
