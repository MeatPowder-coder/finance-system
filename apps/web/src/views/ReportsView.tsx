"use client";

import * as React from "react";
import { BarChart3, CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, KpiCard, DataView, type DataViewColumn, EmptyState } from "@/components/finance";
import type { CashflowReportItem, CategoryBreakdownItem } from "@/lib/types";
import { formatMoney, downloadCsv } from "@/lib/format";

export interface ReportsViewProps {
  reportRange: { from: string; to: string };
  setReportRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>;
  onRefresh: () => void;
  reportsLoading: boolean;
  reportTotals: { inflow: number; outflow: number; net: number };
  cashflowReport: CashflowReportItem[];
  categoryBreakdown: CategoryBreakdownItem[];
}

const inputCls = "bg-surface-1 border-surface-2";

export function ReportsView({
  reportRange,
  setReportRange,
  onRefresh,
  reportsLoading,
  reportTotals,
  cashflowReport,
  categoryBreakdown,
}: ReportsViewProps) {
  const maxCategoryTotal = React.useMemo(
    () => Math.max(...categoryBreakdown.map((row) => Math.abs(Number(row.totalAmount || 0))), 1),
    [categoryBreakdown]
  );

  const cashflowColumns: DataViewColumn<CashflowReportItem>[] = [
    { key: "period", header: "Periodo", render: (r) => <span className="font-medium">{r.period}</span>, cardTitle: true },
    {
      key: "inflow",
      header: "Ingresos",
      align: "right",
      render: (r) => <span className="text-positive">{formatMoney(r.inflow, "COP")}</span>,
    },
    {
      key: "outflow",
      header: "Egresos",
      align: "right",
      render: (r) => <span className="text-danger">{formatMoney(r.outflow, "COP")}</span>,
    },
    {
      key: "net",
      header: "Neto",
      align: "right",
      render: (r) => (
        <span className={r.net >= 0 ? "font-semibold text-positive" : "font-semibold text-warning"}>
          {formatMoney(r.net, "COP")}
        </span>
      ),
    },
  ];

  const breakdownColumns: DataViewColumn<CategoryBreakdownItem>[] = [
    {
      key: "categoryName",
      header: "Categoría",
      render: (r) => <span className="font-medium">{r.categoryName}</span>,
      cardTitle: true,
    },
    {
      key: "txCount",
      header: "Tx",
      render: (r) => <span className="text-xs text-fg-subtle">{r.txCount}</span>,
      hideOnCard: true,
    },
    {
      key: "share",
      header: "Peso",
      render: (r) => (
        <div className="h-1.5 w-full min-w-[80px] rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand/80 transition-all duration-500 ease-soft"
            style={{ width: `${Math.min(100, (Math.abs(r.totalAmount) / maxCategoryTotal) * 100)}%` }}
          />
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (r) => <span className="font-semibold">{formatMoney(r.totalAmount, "COP")}</span>,
    },
  ];

  return (
    <div className="section-enter space-y-5">
      <PageHeader
        title="Reportes"
        subtitle="Flujo de caja y desglose por categoría en un rango."
        icon={<BarChart3 className="h-5 w-5" />}
      />

      {/* Selector de rango + export */}
      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs text-fg-subtle">Desde</Label>
              <Input
                className={inputCls}
                type="date"
                value={reportRange.from}
                onChange={(e) => setReportRange((p) => ({ ...p, from: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Hasta</Label>
              <Input
                className={inputCls}
                type="date"
                value={reportRange.to}
                onChange={(e) => setReportRange((p) => ({ ...p, to: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex flex-wrap items-end gap-2">
              <Button onClick={() => onRefresh()} disabled={reportsLoading} className="bg-brand hover:bg-brand/90 text-surface">
                {reportsLoading ? "Cargando..." : "Actualizar"}
              </Button>
              <Button
                variant="outline"
                className="border-surface-2 bg-surface-1 text-fg-secondary"
                onClick={() =>
                  downloadCsv(
                    `cashflow_${reportRange.from}_${reportRange.to}.csv`,
                    [
                      ["Periodo", "Ingresos", "Egresos", "Neto"],
                      ...cashflowReport.map((row) => [
                        row.period,
                        String(row.inflow),
                        String(row.outflow),
                        String(row.net),
                      ]),
                    ]
                  )
                }
              >
                <Download className="h-4 w-4" /> Cashflow CSV
              </Button>
              <Button
                variant="outline"
                className="border-surface-2 bg-surface-1 text-fg-secondary"
                onClick={() =>
                  downloadCsv(
                    `category_breakdown_${reportRange.from}_${reportRange.to}.csv`,
                    [
                      ["Categoría", "Total", "Transacciones"],
                      ...categoryBreakdown.map((row) => [
                        row.categoryName,
                        String(row.totalAmount),
                        String(row.txCount),
                      ]),
                    ]
                  )
                }
              >
                <Download className="h-4 w-4" /> Categorías CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs del rango */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard label="Ingresos del rango" value={formatMoney(reportTotals.inflow, "COP")} tone="positive" />
        <KpiCard label="Egresos del rango" value={formatMoney(reportTotals.outflow, "COP")} tone="danger" />
        <KpiCard
          label="Neto del rango"
          value={formatMoney(reportTotals.net, "COP")}
          tone={reportTotals.net >= 0 ? "accent" : "warning"}
        />
      </div>

      {/* Cashflow mensual */}
      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          {cashflowReport.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="Sin datos en este rango">
              Ajusta el rango de fechas y pulsa Actualizar para generar el reporte.
            </EmptyState>
          ) : (
            <DataView columns={cashflowColumns} rows={cashflowReport} rowKey={(r) => r.period} />
          )}
        </CardContent>
      </Card>

      {/* Desglose por categoría */}
      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          {categoryBreakdown.length === 0 ? (
            <EmptyState icon={<BarChart3 className="h-7 w-7" />} title="Sin desglose disponible">
              No hay movimientos categorizados en este rango.
            </EmptyState>
          ) : (
            <DataView
              columns={breakdownColumns}
              rows={categoryBreakdown}
              rowKey={(r) => `${r.categoryName}-${r.categoryId || "none"}`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportsView;
