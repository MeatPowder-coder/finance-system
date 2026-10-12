"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataView, PageHeader, EmptyState, type DataViewColumn } from "@/components/finance";
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
  const [presentation, setPresentation] = React.useState<"visual" | "table">("visual");
  const maxCategoryTotal = React.useMemo(
    () => Math.max(...categoryBreakdown.map((row) => Math.abs(Number(row.totalAmount || 0))), 1),
    [categoryBreakdown]
  );
  const maxCashflow = React.useMemo(
    () => Math.max(...cashflowReport.flatMap((row) => [Number(row.inflow) || 0, Number(row.outflow) || 0]), 1),
    [cashflowReport]
  );
  const cashflowColumns: DataViewColumn<CashflowReportItem>[] = [
    { key: "period", header: "Periodo", cardTitle: true, render: (row) => <strong>{row.period}</strong> },
    { key: "inflow", header: "Ingresos", align: "right", render: (row) => <span className="text-positive">{formatMoney(row.inflow, "COP")}</span> },
    { key: "outflow", header: "Egresos", align: "right", render: (row) => <span className="text-danger">{formatMoney(row.outflow, "COP")}</span> },
    { key: "net", header: "Neto", align: "right", render: (row) => <strong className={row.net >= 0 ? "text-positive" : "text-warning"}>{formatMoney(row.net, "COP")}</strong> },
  ];
  const categoryColumns: DataViewColumn<CategoryBreakdownItem>[] = [
    { key: "categoryName", header: "Categoría", cardTitle: true, render: (row) => <strong>{row.categoryName}</strong> },
    { key: "txCount", header: "Movimientos", align: "right", render: (row) => String(row.txCount) },
    { key: "share", header: "Peso", render: (row) => <div className="h-2 min-w-20 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.abs(Number(row.totalAmount) || 0) / maxCategoryTotal * 100)}%` }} /></div> },
    { key: "totalAmount", header: "Total", align: "right", render: (row) => <strong>{formatMoney(row.totalAmount, "COP")}</strong> },
  ];

  return (
    <div className="section-enter space-y-6 pb-10">
      <PageHeader
        title="Reportes"
        subtitle="Flujo de caja y desglose por categoría en un rango."
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <section className="ui-shell-card grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">Desde</Label><Input className={`${inputCls} mt-1.5 h-11`} type="date" value={reportRange.from} onChange={(e) => setReportRange((p) => ({ ...p, from: e.target.value }))} /></div>
          <div><Label className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">Hasta</Label><Input className={`${inputCls} mt-1.5 h-11`} type="date" value={reportRange.to} onChange={(e) => setReportRange((p) => ({ ...p, to: e.target.value }))} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onRefresh()} disabled={reportsLoading} className="border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-lime)] font-semibold text-[var(--ui-editorial-ink)] shadow-[3px_3px_0_var(--ui-editorial-ink)] hover:translate-y-0.5 hover:shadow-[1px_1px_0_var(--ui-editorial-ink)]">{reportsLoading ? "Cargando..." : "Actualizar"}</Button>
          <Button variant="outline" className="border-surface-2 bg-surface-1 text-fg-secondary" onClick={() => downloadCsv(`cashflow_${reportRange.from}_${reportRange.to}.csv`, [["Periodo", "Ingresos", "Egresos", "Neto"], ...cashflowReport.map((row) => [row.period, String(row.inflow), String(row.outflow), String(row.net)])])}><Download className="h-4 w-4" /> Flujo CSV</Button>
          <Button variant="outline" className="border-surface-2 bg-surface-1 text-fg-secondary" onClick={() => downloadCsv(`category_breakdown_${reportRange.from}_${reportRange.to}.csv`, [["Categoría", "Total", "Transacciones"], ...categoryBreakdown.map((row) => [row.categoryName, String(row.totalAmount), String(row.txCount)])])}><Download className="h-4 w-4" /> Categorías CSV</Button>
          <span className="flex items-center gap-1 rounded-xl border border-surface-2 p-1" aria-label="Formato de reportes">
            <Button type="button" variant={presentation === "visual" ? "default" : "ghost"} size="sm" onClick={() => setPresentation("visual")} aria-pressed={presentation === "visual"}>Gráficas</Button>
            <Button type="button" variant={presentation === "table" ? "default" : "ghost"} size="sm" onClick={() => setPresentation("table")} aria-pressed={presentation === "table"}>Tabla</Button>
          </span>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.45fr_.75fr_.75fr]">
        <article className="relative isolate flex min-h-56 flex-col justify-between overflow-hidden rounded-[1.6rem] border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-forest)] p-6 text-[var(--ui-editorial-hero-text)] shadow-[6px_7px_0_var(--ui-editorial-card-shadow)] md:p-8">
          <span className="pointer-events-none absolute -right-10 -top-16 -z-10 h-64 w-64 rounded-full border border-white/20 shadow-[0_0_0_24px_rgba(255,255,255,.035),0_0_0_50px_rgba(255,255,255,.025)]" />
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] opacity-70">Lectura del periodo</p><h2 className="mt-2 max-w-[12ch] text-3xl font-semibold leading-[.98] tracking-[-.055em] md:text-5xl">Flujo <span className="font-serif italic text-[var(--ui-editorial-lime)]">a favor</span> del plan</h2></div><span className="shrink-0 border border-white/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider">{cashflowReport.length} cortes</span></div>
          <div className="mt-7 flex flex-wrap items-end justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] opacity-65">Neto acumulado</p><p className="mt-1 text-3xl font-semibold tracking-[-.05em] md:text-5xl">{formatMoney(reportTotals.net, "COP")}</p></div><div className="flex h-14 min-w-32 flex-1 items-end justify-end gap-1.5 md:max-w-60" aria-label="Comparación de ingresos y egresos por periodo">{cashflowReport.slice(-12).map((row) => <div key={row.period} className="flex h-full min-w-2 flex-1 items-end gap-0.5" title={`${row.period}: ingresos ${formatMoney(row.inflow, "COP")}, egresos ${formatMoney(row.outflow, "COP")}`}><span className="w-1/2 rounded-t-sm bg-[var(--ui-editorial-lime)]" style={{ height: `${Math.max(5, (Number(row.inflow) / maxCashflow) * 100)}%` }} /><span className="w-1/2 rounded-t-sm bg-[var(--ui-editorial-coral)]" style={{ height: `${Math.max(5, (Number(row.outflow) / maxCashflow) * 100)}%` }} /></div>)}</div></div>
        </article>
        <article className="relative overflow-hidden rounded-[1.6rem] border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-lime)] p-5 text-[var(--ui-editorial-ink)] shadow-[5px_6px_0_var(--ui-editorial-ink)] md:p-6"><ArrowDownRight className="absolute -right-2 -top-3 h-20 w-20 opacity-15"/><p className="relative text-[10px] font-bold uppercase tracking-[.18em]">Entradas · rango</p><p className="relative mt-9 break-words text-2xl font-bold leading-tight tracking-[-.045em] md:text-3xl">{formatMoney(reportTotals.inflow, "COP")}</p><div className="relative mt-4 border-t border-[var(--ui-editorial-ink)]/30 pt-3 text-xs font-medium">Dinero recibido</div></article>
        <article className="relative overflow-hidden rounded-[1.6rem] border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-coral)] p-5 text-[var(--ui-editorial-ink)] shadow-[5px_6px_0_var(--ui-editorial-ink)] md:p-6"><ArrowUpRight className="absolute -right-2 -top-3 h-20 w-20 opacity-15"/><p className="relative text-[10px] font-bold uppercase tracking-[.18em]">Salidas · rango</p><p className="relative mt-9 break-words text-2xl font-bold leading-tight tracking-[-.045em] md:text-3xl">{formatMoney(reportTotals.outflow, "COP")}</p><div className="relative mt-4 border-t border-[var(--ui-editorial-ink)]/30 pt-3 text-xs font-medium">Dinero utilizado</div></article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden rounded-[1.6rem] border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-paper)] text-[var(--ui-editorial-ink)] shadow-[5px_6px_0_var(--ui-editorial-ink)]"><CardContent className="p-0">
          <div className="flex items-end justify-between gap-4 border-b border-[var(--ui-editorial-ink)]/25 px-5 py-5 md:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ui-editorial-forest)]">01 / Ritmo mensual</p><h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Flujo de caja</h2></div><span className="text-right text-[10px] font-semibold uppercase tracking-wider opacity-60">Entró<br/>Salió</span></div>
          {cashflowReport.length === 0 ? <div className="p-5"><EmptyState icon={<CalendarDays className="h-7 w-7"/>} title="Sin datos en este rango">Ajusta el rango y pulsa Actualizar para generar el reporte.</EmptyState></div> : presentation === "table" ? <div className="p-4 md:p-6"><DataView columns={cashflowColumns} rows={cashflowReport} rowKey={(row) => row.period} /></div> : <div className="divide-y divide-[var(--ui-editorial-ink)]/15">
            {cashflowReport.map((row) => { const total = Math.max(Number(row.inflow) || 0, Number(row.outflow) || 0, 1); return <article key={row.period} className="grid gap-3 px-5 py-4 transition-colors hover:bg-[var(--ui-editorial-ink)]/[.035] md:grid-cols-[100px_1fr_1fr_160px] md:items-center md:gap-5 md:px-7"><div className="font-semibold">{row.period}</div><div><div className="mb-1 flex justify-between text-xs"><span className="opacity-60">Entró</span><span className="font-medium text-positive">{formatMoney(row.inflow, "COP")}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--ui-editorial-ink)]/10"><div className="h-full rounded-full bg-[var(--ui-editorial-mint)]" style={{width:`${Math.min(100, (row.inflow / total) * 100)}%`}}/></div></div><div><div className="mb-1 flex justify-between text-xs"><span className="opacity-60">Salió</span><span className="font-medium text-danger">{formatMoney(row.outflow, "COP")}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--ui-editorial-ink)]/10"><div className="h-full rounded-full bg-[var(--ui-editorial-coral)]" style={{width:`${Math.min(100, (row.outflow / total) * 100)}%`}}/></div></div><div className={`text-lg font-semibold md:text-right ${row.net >= 0 ? "text-positive" : "text-warning"}`}>{formatMoney(row.net, "COP")}<span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider opacity-55">Neto</span></div></article>; })}
          </div>}
        </CardContent></Card>

        <Card className="overflow-hidden rounded-[1.6rem] border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-blue)] text-[var(--ui-editorial-ink)] shadow-[5px_6px_0_var(--ui-editorial-ink)]"><CardContent className="p-0"><div className="border-b border-[var(--ui-editorial-ink)]/25 px-5 py-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-65">02 / En qué se fue</p><h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Categorías</h2></div>
          {categoryBreakdown.length === 0 ? <div className="p-5"><EmptyState icon={<BarChart3 className="h-7 w-7"/>} title="Sin desglose disponible">No hay movimientos categorizados en este rango.</EmptyState></div> : presentation === "table" ? <div className="p-4 md:p-6"><DataView columns={categoryColumns} rows={categoryBreakdown} rowKey={(row) => `${row.categoryName}-${row.categoryId || "none"}`} /></div> : <div className="space-y-4 p-5 md:p-6">{categoryBreakdown.map((row,index) => { const share=Math.min(100,(Math.abs(Number(row.totalAmount)||0)/maxCategoryTotal)*100); const colors=["bg-[var(--ui-editorial-forest)]","bg-[var(--ui-editorial-coral)]","bg-[var(--ui-editorial-mint)]","bg-[var(--ui-editorial-lime)]","bg-[var(--ui-editorial-pink)]"]; return <article key={`${row.categoryName}-${row.categoryId||"none"}`}><div className="flex items-end justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{row.categoryName}</p><p className="text-xs opacity-60">{row.txCount} movimientos · {share.toFixed(0)}%</p></div><p className="shrink-0 text-sm font-semibold">{formatMoney(row.totalAmount,"COP")}</p></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--ui-editorial-ink)]/10"><div className={`h-full rounded-full transition-all duration-700 ${colors[index%colors.length]}`} style={{width:`${share}%`}}/></div></article>; })}</div>}
        </CardContent></Card>
      </section>
    </div>
  );
}

export default ReportsView;
