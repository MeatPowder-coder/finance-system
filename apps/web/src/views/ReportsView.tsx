"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, Download, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, EmptyState } from "@/components/finance";
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

  return (
    <div className="section-enter space-y-6 pb-10">
      <PageHeader
        title="Reportes"
        subtitle="Flujo de caja y desglose por categoría en un rango."
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <section className="ui-shell-card grid gap-5 p-4 md:grid-cols-[1fr_auto] md:items-end md:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs text-fg-subtle">Desde</Label><Input className={`${inputCls} mt-1.5 h-11`} type="date" value={reportRange.from} onChange={(e) => setReportRange((p) => ({ ...p, from: e.target.value }))} /></div>
          <div><Label className="text-xs text-fg-subtle">Hasta</Label><Input className={`${inputCls} mt-1.5 h-11`} type="date" value={reportRange.to} onChange={(e) => setReportRange((p) => ({ ...p, to: e.target.value }))} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onRefresh()} disabled={reportsLoading} className="bg-brand text-surface hover:bg-brand/90">{reportsLoading ? "Cargando..." : "Actualizar reporte"}</Button>
          <Button variant="outline" className="border-surface-2 bg-surface-1 text-fg-secondary" onClick={() => downloadCsv(`cashflow_${reportRange.from}_${reportRange.to}.csv`, [["Periodo", "Ingresos", "Egresos", "Neto"], ...cashflowReport.map((row) => [row.period, String(row.inflow), String(row.outflow), String(row.net)])])}><Download className="h-4 w-4" /> Flujo CSV</Button>
          <Button variant="outline" className="border-surface-2 bg-surface-1 text-fg-secondary" onClick={() => downloadCsv(`category_breakdown_${reportRange.from}_${reportRange.to}.csv`, [["Categoría", "Total", "Transacciones"], ...categoryBreakdown.map((row) => [row.categoryName, String(row.totalAmount), String(row.txCount)])])}><Download className="h-4 w-4" /> Categorías CSV</Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="ui-shell-card relative overflow-hidden p-5 md:p-6"><span className="absolute -right-4 -top-7 h-24 w-24 rounded-full bg-positive/10"/><div className="relative flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-subtle">Ingresos del rango</p><ArrowDownRight className="h-5 w-5 text-positive" /></div><p className="relative mt-5 text-2xl font-semibold tracking-tight text-positive md:text-3xl">{formatMoney(reportTotals.inflow, "COP")}</p></article>
        <article className="ui-shell-card relative overflow-hidden bg-brand-soft p-5 md:p-6"><span className="absolute -bottom-10 -right-5 h-28 w-28 rounded-full border-[18px] border-brand/10"/><div className="relative flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-subtle">Egresos del rango</p><ArrowUpRight className="h-5 w-5 text-danger" /></div><p className="relative mt-5 text-2xl font-semibold tracking-tight text-danger md:text-3xl">{formatMoney(reportTotals.outflow, "COP")}</p></article>
        <article className={`ui-shell-card relative overflow-hidden p-5 md:p-6 ${reportTotals.net >= 0 ? "bg-brand text-surface" : "bg-danger-soft"}`}><TrendingUp className="absolute -right-2 -top-2 h-20 w-20 opacity-15"/><p className="relative text-xs font-semibold uppercase tracking-[0.15em] opacity-75">Neto del rango</p><p className="relative mt-5 text-2xl font-semibold tracking-tight md:text-3xl">{formatMoney(reportTotals.net, "COP")}</p></article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="ds-soft-card overflow-hidden"><CardContent className="p-0">
          <div className="flex items-end justify-between gap-4 border-b border-surface-2 px-5 py-5 md:px-7"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Ritmo mensual</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-fg md:text-2xl">Flujo de caja</h2></div><span className="text-xs text-fg-subtle">Ingresos y egresos</span></div>
          {cashflowReport.length === 0 ? <div className="p-5"><EmptyState icon={<CalendarDays className="h-7 w-7"/>} title="Sin datos en este rango">Ajusta el rango y pulsa Actualizar para generar el reporte.</EmptyState></div> : <div className="divide-y divide-surface-2/70">
            {cashflowReport.map((row) => { const total = Math.max(Number(row.inflow) || 0, Number(row.outflow) || 0, 1); return <article key={row.period} className="grid gap-3 px-5 py-4 transition-colors hover:bg-surface-1/60 md:grid-cols-[100px_1fr_1fr_160px] md:items-center md:gap-5 md:px-7"><div className="font-semibold text-fg">{row.period}</div><div><div className="mb-1 flex justify-between text-xs"><span className="text-fg-subtle">Entró</span><span className="font-medium text-positive">{formatMoney(row.inflow, "COP")}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-positive" style={{width:`${Math.min(100, (row.inflow / total) * 100)}%`}}/></div></div><div><div className="mb-1 flex justify-between text-xs"><span className="text-fg-subtle">Salió</span><span className="font-medium text-danger">{formatMoney(row.outflow, "COP")}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-danger" style={{width:`${Math.min(100, (row.outflow / total) * 100)}%`}}/></div></div><div className={`text-lg font-semibold md:text-right ${row.net >= 0 ? "text-positive" : "text-warning"}`}>{formatMoney(row.net, "COP")}<span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider text-fg-subtle">Neto</span></div></article>; })}
          </div>}
        </CardContent></Card>

        <Card className="ds-soft-card overflow-hidden"><CardContent className="p-0"><div className="border-b border-surface-2 px-5 py-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">En qué se fue</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-fg md:text-2xl">Categorías</h2></div>
          {categoryBreakdown.length === 0 ? <div className="p-5"><EmptyState icon={<BarChart3 className="h-7 w-7"/>} title="Sin desglose disponible">No hay movimientos categorizados en este rango.</EmptyState></div> : <div className="space-y-4 p-5 md:p-6">{categoryBreakdown.map((row,index) => { const share=Math.min(100,(Math.abs(Number(row.totalAmount)||0)/maxCategoryTotal)*100); const colors=["bg-brand","bg-danger","bg-positive","bg-warning","bg-brand/50"]; return <article key={`${row.categoryName}-${row.categoryId||"none"}`}><div className="flex items-end justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold text-fg">{row.categoryName}</p><p className="text-xs text-fg-subtle">{row.txCount} movimientos · {share.toFixed(0)}%</p></div><p className="shrink-0 text-sm font-semibold text-fg">{formatMoney(row.totalAmount,"COP")}</p></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full transition-all duration-700 ${colors[index%colors.length]}`} style={{width:`${share}%`}}/></div></article>; })}</div>}
        </CardContent></Card>
      </section>
    </div>
  );
}

export default ReportsView;
