"use client";

import * as React from "react";
import { ArrowUpRight, Briefcase, CircleDollarSign, Layers3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataView, PageHeader, EmptyState, type DataViewColumn } from "@/components/finance";
import type { Investment, Summary } from "@/lib/types";
import { formatMoney, toNumber } from "@/lib/format";

export interface InvestmentsViewProps {
  investments: Investment[];
  summary: Summary | null;
}

export function InvestmentsView({ investments, summary }: InvestmentsViewProps) {
  const [presentation, setPresentation] = React.useState<"cards" | "table">("cards");
  const columns: DataViewColumn<Investment>[] = [
    { key: "symbol", header: "Activo", cardTitle: true, render: (inv) => <span className="font-semibold">{inv.symbol} <span className="font-normal text-fg-subtle">{inv.name}</span></span> },
    { key: "asset_type", header: "Tipo", render: (inv) => inv.asset_type },
    { key: "quantity", header: "Cantidad", align: "right", render: (inv) => toNumber(inv.quantity).toLocaleString("es-CO") },
    { key: "avg_cost", header: "Costo promedio", align: "right", render: (inv) => formatMoney(toNumber(inv.avg_cost), inv.currency) },
    { key: "invested_amount", header: "Capital", align: "right", render: (inv) => <strong>{formatMoney(toNumber(inv.invested_amount), inv.currency)}</strong> },
    { key: "status", header: "Estado", align: "right", render: (inv) => <span className={inv.is_active ? "text-positive" : "text-fg-subtle"}>{inv.is_active ? "Activa" : "Inactiva"}</span> },
  ];
  return (
    <div className="section-enter space-y-6 pb-10">
      <PageHeader
        title="Inversiones"
        subtitle="Capital comprometido y posiciones registradas."
        icon={<Briefcase className="h-5 w-5" />}
      />

      <section className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <article className="ui-shell-card relative overflow-hidden bg-brand p-5 text-surface md:p-6"><CircleDollarSign className="absolute -right-2 -top-2 h-24 w-24 opacity-15"/><p className="relative text-xs font-semibold uppercase tracking-[0.16em] opacity-75">Capital invertido</p><p className="relative mt-5 text-3xl font-semibold tracking-tight md:text-4xl">{formatMoney(summary?.investedTotal || 0, "USD")}</p><p className="relative mt-2 text-xs opacity-75">Capital comprometido en tus posiciones</p></article>
        <article className="ui-shell-card p-5 md:p-6"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">Posiciones activas</p><span className="rounded-xl bg-positive-soft p-2 text-positive"><ArrowUpRight className="h-4 w-4"/></span></div><p className="mt-5 text-3xl font-semibold tracking-tight text-fg">{String(summary?.activePositions || 0)}</p><p className="mt-1 text-xs text-fg-subtle">En seguimiento</p></article>
        <article className="ui-shell-card p-5 md:p-6"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">Instrumentos</p><span className="rounded-xl bg-brand-soft p-2 text-brand"><Layers3 className="h-4 w-4"/></span></div><p className="mt-5 text-3xl font-semibold tracking-tight text-fg">{String(investments.length)}</p><p className="mt-1 text-xs text-fg-subtle">Activos registrados</p></article>
      </section>

      <Card className="ds-soft-card overflow-hidden"><CardContent className="p-0">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-surface-2 px-5 py-5 md:px-7"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Tu portafolio</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-fg md:text-2xl">Posiciones</h2></div><div className="flex items-center gap-2"><span className="text-xs text-fg-subtle">{investments.length} instrumentos</span><Button type="button" variant={presentation === "cards" ? "default" : "outline"} size="sm" onClick={() => setPresentation("cards")} aria-pressed={presentation === "cards"}>Tarjetas</Button><Button type="button" variant={presentation === "table" ? "default" : "outline"} size="sm" onClick={() => setPresentation("table")} aria-pressed={presentation === "table"}>Tabla</Button></div></div>
        {investments.length === 0 ? <div className="p-5 md:p-7"><EmptyState icon={<Briefcase className="h-7 w-7" />} title="No hay inversiones registradas">Cuando registres tu primera posición aparecerá acá con su capital y estado.</EmptyState></div> : presentation === "table" ? <div className="p-4 md:p-5"><DataView columns={columns} rows={investments} rowKey={(inv) => inv.id} /></div> : <div className="grid gap-3 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
          {investments.map((inv, index) => <article key={inv.id} className={`group relative overflow-hidden rounded-2xl border border-surface-2 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:p-5 ${index === 0 ? "bg-brand-soft md:col-span-2 xl:col-span-1" : "bg-surface-1/70"}`}>
            <div className="absolute -right-7 -top-8 h-24 w-24 rounded-full border-[14px] border-brand/10 transition-transform duration-500 group-hover:scale-125"/>
            <div className="relative flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">{inv.asset_type}</p><h3 className="mt-1 truncate text-2xl font-semibold tracking-tight text-fg">{inv.symbol}</h3><p className="mt-0.5 truncate text-sm text-fg-subtle">{inv.name}</p></div><span className={inv.is_active ? "rounded-full border border-positive/40 bg-positive-soft px-2.5 py-1 text-xs font-medium text-positive" : "rounded-full border border-surface-2 bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-subtle"}>{inv.is_active ? "Activa" : "Inactiva"}</span></div>
            <div className="relative mt-5 border-t border-surface-2/80 pt-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Capital</p><p className="mt-1 text-2xl font-semibold tracking-tight text-fg">{formatMoney(toNumber(inv.invested_amount), inv.currency)}</p></div>
            <div className="relative mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-surface-1/75 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Cantidad</p><p className="mt-1 font-mono text-sm font-medium text-fg">{toNumber(inv.quantity).toLocaleString("es-CO")}</p></div><div className="rounded-xl bg-surface-1/75 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Costo promedio</p><p className="mt-1 truncate text-sm font-medium text-fg">{formatMoney(toNumber(inv.avg_cost), inv.currency)}</p></div></div>
          </article>)}
        </div>}
      </CardContent></Card>
    </div>
  );
}

export default InvestmentsView;
