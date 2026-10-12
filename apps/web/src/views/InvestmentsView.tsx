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
  const activeCount = summary?.activePositions || 0;
  const featuredPosition = investments.find((investment) => investment.is_active) || investments[0];
  return (
    <div className="section-enter space-y-6 pb-10">
      <PageHeader
        title="Inversiones"
        subtitle="Capital comprometido y posiciones registradas."
        icon={<Briefcase className="h-5 w-5" />}
      />

      <section className="grid gap-3 xl:grid-cols-[1.55fr_.8fr_.65fr]">
        <article className="relative isolate flex min-h-60 flex-col justify-between overflow-hidden rounded-[1.7rem] border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-forest)] p-6 text-[var(--ui-editorial-hero-text)] shadow-[6px_7px_0_var(--ui-editorial-card-shadow)] md:p-8">
          <CircleDollarSign className="pointer-events-none absolute -right-5 -top-7 -z-10 h-52 w-52 rotate-[-12deg] opacity-[.12]" />
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] opacity-70">Cuaderno de inversiones</p><h2 className="mt-2 max-w-[11ch] text-3xl font-semibold leading-[.95] tracking-[-.06em] md:text-5xl">Capital en <span className="font-serif italic text-[var(--ui-editorial-lime)]">movimiento</span></h2></div><span className="shrink-0 border border-white/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider">{investments.length.toString().padStart(2, "0")} posiciones</span></div>
          <div className="mt-7 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] opacity-65">Capital registrado</p><p className="mt-1 break-words text-3xl font-semibold tracking-[-.05em] md:text-5xl">{formatMoney(summary?.investedTotal || 0, "USD")}</p></div><div className="flex items-end gap-1.5" aria-label={`${activeCount} posiciones activas de ${investments.length}`}>
            {investments.slice(0, 12).map((inv) => <span key={inv.id} title={`${inv.symbol} · ${inv.is_active ? "activa" : "inactiva"}`} className={`h-9 w-3 border border-white/30 ${inv.is_active ? "bg-[var(--ui-editorial-lime)]" : "bg-white/20"}`} />)}
          </div></div>
        </article>
        <article className="relative flex min-h-52 flex-col justify-between overflow-hidden rounded-[1.7rem] border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-lime)] p-5 text-[var(--ui-editorial-card-ink,var(--ui-editorial-ink))] shadow-[5px_6px_0_var(--ui-editorial-ink)] md:p-6"><ArrowUpRight className="absolute -right-3 -top-4 h-24 w-24 opacity-15"/><div className="relative flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[.16em]">En seguimiento</p><span className="border border-current px-2 py-1 font-mono text-[10px]">01</span></div><div className="relative"><p className="text-5xl font-semibold tracking-[-.07em] md:text-6xl">{String(activeCount).padStart(2, "0")}</p><p className="mt-1 text-xs font-medium opacity-70">posiciones activas</p></div></article>
        <article className="relative flex min-h-52 flex-col justify-between overflow-hidden rounded-[1.7rem] border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-coral)] p-5 text-[var(--ui-editorial-card-ink,var(--ui-editorial-ink))] shadow-[5px_6px_0_var(--ui-editorial-ink)] md:p-6"><Layers3 className="absolute -right-3 -top-3 h-24 w-24 opacity-15"/><div className="relative flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[.16em]">Instrumentos</p><span className="border border-current px-2 py-1 font-mono text-[10px]">02</span></div><div className="relative"><p className="text-5xl font-semibold tracking-[-.07em] md:text-6xl">{String(investments.length).padStart(2, "0")}</p><p className="mt-1 text-xs font-medium opacity-70">activos registrados</p></div></article>
      </section>

      <Card className="overflow-hidden rounded-[1.7rem] border-2 border-[var(--ui-editorial-ink)] bg-[var(--ui-editorial-paper)] text-[var(--ui-editorial-ink)] shadow-[5px_6px_0_var(--ui-editorial-ink)]"><CardContent className="p-0">
        <div className="grid gap-4 border-b border-[var(--ui-editorial-ink)]/25 px-5 py-5 md:grid-cols-[1fr_auto] md:items-end md:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--ui-editorial-forest)]">01 / Cartera viva</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.04em] md:text-3xl">Posiciones</h2>{featuredPosition && <p className="mt-1 text-xs opacity-65">En foco · {featuredPosition.symbol} / {featuredPosition.name}</p>}</div><div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs opacity-65">{investments.length} instrumentos</span><Button type="button" variant={presentation === "cards" ? "default" : "outline"} size="sm" onClick={() => setPresentation("cards")} aria-pressed={presentation === "cards"}>Tarjetas</Button><Button type="button" variant={presentation === "table" ? "default" : "outline"} size="sm" onClick={() => setPresentation("table")} aria-pressed={presentation === "table"}>Tabla</Button></div></div>
        {investments.length === 0 ? <div className="p-5 md:p-7"><EmptyState icon={<Briefcase className="h-7 w-7" />} title="No hay inversiones registradas">Cuando registres tu primera posición aparecerá acá con su capital y estado.</EmptyState></div> : presentation === "table" ? <div className="p-4 md:p-5"><DataView columns={columns} rows={investments} rowKey={(inv) => inv.id} /></div> : <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6 xl:grid-cols-3">
          {investments.map((inv, index) => {
            const accent = index % 4;
            const background = accent === 0 ? "var(--ui-editorial-blue)" : accent === 1 ? "var(--ui-editorial-paper)" : accent === 2 ? "var(--ui-editorial-lime)" : "var(--ui-editorial-pink)";
            const portfolioTotal = Math.max(Number(summary?.investedTotal) || 0, 1);
            const allocation = Math.min(100, Math.abs(toNumber(inv.invested_amount)) / portfolioTotal * 100);
            return <article key={inv.id} className={`group relative isolate overflow-hidden rounded-[1.45rem] border-2 border-[var(--ui-editorial-ink)] p-5 text-[var(--ui-editorial-card-ink,var(--ui-editorial-ink))] shadow-[4px_5px_0_var(--ui-editorial-ink)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[6px_7px_0_var(--ui-editorial-ink)] md:p-6 ${index === 0 ? "md:col-span-2 xl:col-span-1" : ""}`} style={{ background }}>
              <div className="pointer-events-none absolute -right-8 -top-10 -z-10 h-36 w-36 rounded-full border-[1.5rem] border-black/10 transition-transform duration-500 group-hover:scale-110"/>
              <div className="relative flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] opacity-65">{inv.asset_type} · {String(index + 1).padStart(2, "0")}</p><h3 className="mt-2 truncate text-3xl font-semibold tracking-[-.06em]">{inv.symbol}</h3><p className="mt-0.5 truncate text-sm opacity-70">{inv.name}</p></div><span className="shrink-0 border border-current px-2 py-1 text-[10px] font-bold uppercase tracking-wider">{inv.is_active ? "Activa" : "Pausada"}</span></div>
              <div className="relative mt-6 border-t border-current/25 pt-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] opacity-65">Capital en posición</p><p className="mt-1 break-words text-2xl font-semibold tracking-[-.04em]">{formatMoney(toNumber(inv.invested_amount), inv.currency)}</p></div><span className="font-mono text-xs">{allocation.toFixed(0)}%</span></div><div className="mt-3 h-2 overflow-hidden border border-current/35"><div className="h-full bg-[var(--ui-editorial-forest)] transition-all duration-700" style={{ width: `${allocation}%` }}/></div></div>
              <div className="relative mt-4 grid grid-cols-2 gap-2"><div className="border border-current/20 bg-white/20 p-3"><p className="text-[9px] font-bold uppercase tracking-[.14em] opacity-60">Unidades</p><p className="mt-1 truncate font-mono text-sm font-semibold">{toNumber(inv.quantity).toLocaleString("es-CO")}</p></div><div className="border border-current/20 bg-white/20 p-3"><p className="text-[9px] font-bold uppercase tracking-[.14em] opacity-60">Costo medio</p><p className="mt-1 truncate text-sm font-semibold">{formatMoney(toNumber(inv.avg_cost), inv.currency)}</p></div></div>
            </article>;
          })}
        </div>}
      </CardContent></Card>
    </div>
  );
}

export default InvestmentsView;
