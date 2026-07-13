"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";

type BudgetStatus = "healthy" | "warning" | "over_budget" | "underfunded";

type BudgetStripItem = {
  id: number;
  name: string;
  currency: string;
  allocated_amount: number;
  actual_amount: number;
  lines: Array<{ id: number; category_id?: number; category_name: string }>;
  deficit_summary: {
    status: BudgetStatus;
    incidentCount: number;
  };
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function formatMoney(value: number, currency = "COP") {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

function getStatusLabel(status: BudgetStatus) {
  switch (status) {
    case "over_budget":
      return "Deficit";
    case "underfunded":
      return "Sin fondeo";
    case "warning":
      return "En riesgo";
    default:
      return "Sano";
  }
}

function getStatusClasses(status: BudgetStatus) {
  switch (status) {
    case "over_budget":
      return {
        tone: "#fb7185",
        rail: "from-rose-500 via-rose-500/80 to-fuchsia-500",
        badge: "border-rose-500/40 bg-rose-500/10 text-rose-200",
        glow: "shadow-rose-500/10",
      };
    case "underfunded":
      return {
        tone: "#f59e0b",
        rail: "from-amber-500 via-orange-400 to-amber-400",
        badge: "border-amber-500/40 bg-amber-500/10 text-amber-200",
        glow: "shadow-amber-500/10",
      };
    case "warning":
      return {
        tone: "#f59e0b",
        rail: "from-cyan-400 via-sky-400 to-cyan-300",
        badge: "border-amber-500/40 bg-amber-500/10 text-amber-200",
        glow: "shadow-cyan-500/10",
      };
    default:
      return {
        tone: "#22d3ee",
        rail: "from-emerald-400 via-cyan-400 to-sky-400",
        badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
        glow: "shadow-emerald-500/10",
      };
  }
}

export default function DashboardBudgetStrip({
  budgets,
  totalBudgets,
  onPrev,
  onNext,
  canPrev,
  canNext,
  onRegisterExpense,
  onEditBudget,
}: {
  budgets: BudgetStripItem[];
  totalBudgets: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onRegisterExpense: (budget: BudgetStripItem) => void;
  onEditBudget?: (budget: BudgetStripItem) => void;
}) {
  return (
    <Card className="ui-panel overflow-hidden rounded-[28px]">
      <CardHeader className="flex flex-col gap-4 border-b border-white/5 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-zinc-100">Sobres del mes</CardTitle>
            <Badge variant="secondary" className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              {totalBudgets} activos
            </Badge>
          </div>
          <CardDescription className="ui-muted">Cada fila es dinero apartado. La barra se vacia conforme gastas.</CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onPrev}
            disabled={!canPrev}
            className="ui-action h-10 w-10 rounded-full disabled:opacity-40"
            aria-label="Ver presupuestos anteriores"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onNext}
            disabled={!canNext}
            className="ui-action h-10 w-10 rounded-full disabled:opacity-40"
            aria-label="Ver presupuestos siguientes"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-5 pb-5">
        {budgets.length === 0 ? (
          <div className="ui-empty rounded-[24px] p-8 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-500/25 bg-cyan-500/10 text-cyan-200">
              <Plus className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-zinc-200">Aun no tienes sobres activos este mes.</p>
            <p className="mt-1 text-sm ui-muted">Crea uno para separar dinero de comida, transporte, salud o ahorro.</p>
          </div>
        ) : (
          <div className="budget-list-scroll finance-scrollbar space-y-3">
            {budgets.map((budget) => {
              const allocatedAmount = Math.max(0, toNumber(budget.allocated_amount));
              const actualAmount = Math.max(0, toNumber(budget.actual_amount));
              const consumedRatio = allocatedAmount > 0 ? Math.min(100, Math.max(0, (actualAmount / allocatedAmount) * 100)) : 0;
              const remainingRatio = allocatedAmount > 0 ? Math.max(0, 100 - consumedRatio) : 0;
              const remainingAmount = allocatedAmount - actualAmount;
              const status = getStatusClasses(budget.deficit_summary.status);
              const primaryCategory = budget.lines[0]?.category_name || "Sin categoria";
              const extraCategories = Math.max(0, budget.lines.length - 1);

              return (
                <article
                  key={budget.id}
                  role="button"
                  tabIndex={0}
                  title="Click para registrar gasto"
                  onClick={() => onRegisterExpense(budget)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRegisterExpense(budget);
                    }
                  }}
                  className={`budget-row group cursor-pointer rounded-[20px] p-3.5 ${status.glow}`}
                  style={{ "--budget-tone": status.tone } as CSSProperties}
                >
                  <div className="grid gap-3 md:grid-cols-[minmax(150px,210px)_minmax(260px,1fr)_auto] md:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-1 h-10 w-1.5 shrink-0 rounded-full bg-[var(--budget-tone)] shadow-[0_0_24px_color-mix(in_srgb,var(--budget-tone)_38%,transparent)]" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-zinc-100">{budget.name}</p>
                          <Badge variant="secondary" className={`shrink-0 border ${status.badge}`}>
                            {getStatusLabel(budget.deficit_summary.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {primaryCategory}
                          {extraCategories > 0 ? ` + ${extraCategories}` : ""}
                        </p>
                        <p className="text-[11px] uppercase tracking-[0.16em] ui-subtle">
                          {budget.deficit_summary.incidentCount > 0 ? `${budget.deficit_summary.incidentCount} alertas este mes` : "Sin alertas"}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] ui-subtle">Disponible</p>
                          <p className={`mt-0.5 text-base font-semibold ${remainingAmount >= 0 ? "text-zinc-100" : "text-rose-200"}`}>
                            {remainingAmount >= 0 ? formatMoney(remainingAmount, budget.currency) : `-${formatMoney(Math.abs(remainingAmount), budget.currency)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.16em] ui-subtle">Total</p>
                          <p className="mt-0.5 text-sm font-medium text-zinc-200">{formatMoney(allocatedAmount, budget.currency)}</p>
                        </div>
                      </div>
                      <div className="budget-drain-track mt-2.5 h-3 overflow-hidden rounded-full">
                        <div
                          className="budget-drain-fill h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, remainingRatio)}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] ui-subtle">
                        <span>{formatMoney(actualAmount, budget.currency)} usado</span>
                        <span>{remainingRatio.toFixed(0)}% disponible</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 md:flex-col md:items-stretch">
                        {onEditBudget && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditBudget(budget);
                            }}
                            className="ui-action h-8 rounded-full px-3 text-xs"
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Editar
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRegisterExpense(budget);
                          }}
                          className="ui-action-primary h-8 rounded-full px-3 text-xs"
                        >
                          Registrar gasto
                        </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
