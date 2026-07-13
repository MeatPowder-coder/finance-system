"use client";

import * as React from "react";
import { Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, KpiCard, DataView, type DataViewColumn, EmptyState } from "@/components/finance";
import type { Investment, Summary } from "@/lib/types";
import { formatMoney, toNumber } from "@/lib/format";

export interface InvestmentsViewProps {
  investments: Investment[];
  summary: Summary | null;
}

export function InvestmentsView({ investments, summary }: InvestmentsViewProps) {
  const columns: DataViewColumn<Investment>[] = [
    {
      key: "asset",
      header: "Activo",
      render: (inv) => (
        <div className="leading-tight">
          <div className="font-medium">{inv.symbol}</div>
          <div className="text-xs text-fg-subtle">{inv.name}</div>
        </div>
      ),
      cardTitle: true,
    },
    {
      key: "asset_type",
      header: "Tipo",
      render: (inv) => <span className="text-fg-secondary">{inv.asset_type}</span>,
      hideOnCard: true,
    },
    {
      key: "quantity",
      header: "Cantidad",
      align: "right",
      render: (inv) => <span className="font-mono text-xs">{toNumber(inv.quantity).toLocaleString("es-CO")}</span>,
      hideOnCard: true,
    },
    {
      key: "avg_cost",
      header: "Costo prom.",
      align: "right",
      render: (inv) => <span className="text-fg-secondary">{formatMoney(toNumber(inv.avg_cost), inv.currency)}</span>,
      hideOnCard: true,
    },
    {
      key: "capital",
      header: "Capital",
      align: "right",
      render: (inv) => <span className="font-semibold">{formatMoney(toNumber(inv.invested_amount), inv.currency)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      render: (inv) => (
        <span
          className={
            inv.is_active
              ? "inline-flex items-center rounded-full border border-positive/40 bg-positive-soft px-2.5 py-0.5 text-xs font-medium text-positive"
              : "inline-flex items-center rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-fg-subtle"
          }
        >
          {inv.is_active ? "Activa" : "Inactiva"}
        </span>
      ),
    },
  ];

  return (
    <div className="section-enter space-y-5">
      <PageHeader
        title="Inversiones"
        subtitle="Capital comprometido y posiciones registradas."
        icon={<Briefcase className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard label="Posiciones activas" value={String(summary?.activePositions || 0)} tone="accent" />
        <KpiCard label="Capital invertido" value={formatMoney(summary?.investedTotal || 0, "USD")} tone="positive" />
        <KpiCard label="Instrumentos" value={String(investments.length)} tone="neutral" />
      </div>

      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          {investments.length === 0 ? (
            <EmptyState icon={<Briefcase className="h-7 w-7" />} title="No hay inversiones registradas">
              Cuando registres tu primera posición aparecerá acá con su capital y estado.
            </EmptyState>
          ) : (
            <DataView columns={columns} rows={investments} rowKey={(inv) => inv.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default InvestmentsView;
