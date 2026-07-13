"use client";

import * as React from "react";
import { CalendarDays, Wallet, AlertTriangle, Clock3, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlanningSegmentedNav from "@/components/PlanningSegmentedNav";
import { PageHeader } from "@/components/finance";
import type {
  Budget,
  BudgetDeficitEvent,
  Category,
  CategoryDirection,
  Commitment,
  MonthlyFinanceSummary,
  PlanningSectionKey,
  ProjectionScenario,
} from "@/lib/types";
import {
  formatDate,
  formatMoney,
  downloadCsv,
  getBudgetStatusAccent,
  getBudgetStatusLabel,
  getBudgetStatusTone,
  getCategoryDirectionLabel,
  getDeficitEventLabel,
} from "@/lib/format";
import type { CategoryFormState } from "./TransactionsView";

export interface BudgetFormState {
  name: string;
  categoryId: string;
  limitAmount: string;
}
export interface CommitmentFormState {
  name: string;
  amount: string;
  cadence: Commitment["cadence"];
  dayOfMonth: string;
}
export interface ProjectionFormState {
  horizonMonths: string;
  monthlySavingsGoal: string;
  monthlyInvestmentGoal: string;
}

interface PlanningSectionDef {
  key: PlanningSectionKey;
  label: string;
  caption: string;
  icon: typeof Wallet;
}

export interface PlanningSummaryCard {
  label: string;
  value: string;
  tone: string;
}

export interface PlanningViewProps {
  // nav
  planningSection: PlanningSectionKey;
  goPlanningSection: (section: PlanningSectionKey) => void;
  planningSections: PlanningSectionDef[];
  // month + summary
  planningMonth: string;
  setPlanningMonth: React.Dispatch<React.SetStateAction<string>>;
  planningLoading: boolean;
  refreshPlanning: () => void;
  planningSummaryCards: readonly PlanningSummaryCard[];
  // data
  budgets: Budget[];
  budgetDeficitEvents: BudgetDeficitEvent[];
  commitments: Commitment[];
  projectionScenarios: ProjectionScenario[];
  monthlyFinanceSummary: MonthlyFinanceSummary | null;
  categories: Category[];
  // budget dialog
  budgetDialogOpen: boolean;
  setBudgetDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  resetBudgetDialogState: () => void;
  openCreateBudgetDialog: () => void;
  budgetDialogMode: "create" | "edit";
  budgetForm: BudgetFormState;
  setBudgetForm: React.Dispatch<React.SetStateAction<BudgetFormState>>;
  saveBudget: () => void;
  budgetCategoryComposerOpen: boolean;
  setBudgetCategoryComposerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  createBudgetCategory: () => void;
  categoryForm: CategoryFormState;
  setCategoryForm: React.Dispatch<React.SetStateAction<CategoryFormState>>;
  // commitment dialog
  commitmentDialogOpen: boolean;
  setCommitmentDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  commitmentForm: CommitmentFormState;
  setCommitmentForm: React.Dispatch<React.SetStateAction<CommitmentFormState>>;
  createCommitment: () => void;
  // projection dialog
  projectionDialogOpen: boolean;
  setProjectionDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectionForm: ProjectionFormState;
  setProjectionForm: React.Dispatch<React.SetStateAction<ProjectionFormState>>;
  runProjection: () => void;
  saving: boolean;
}

const inputCls = "bg-surface-1 border-surface-2";
const selectTriggerCls = "bg-surface-1 border-surface-2";

export function PlanningView(p: PlanningViewProps) {
  const {
    planningSection,
    goPlanningSection,
    planningSections,
    planningMonth,
    setPlanningMonth,
    planningLoading,
    refreshPlanning,
    planningSummaryCards,
    budgets,
    budgetDeficitEvents,
    commitments,
    projectionScenarios,
    monthlyFinanceSummary,
    categories,
    budgetDialogOpen,
    setBudgetDialogOpen,
    resetBudgetDialogState,
    openCreateBudgetDialog,
    budgetDialogMode,
    budgetForm,
    setBudgetForm,
    saveBudget,
    budgetCategoryComposerOpen,
    setBudgetCategoryComposerOpen,
    createBudgetCategory,
    categoryForm,
    setCategoryForm,
    commitmentDialogOpen,
    setCommitmentDialogOpen,
    commitmentForm,
    setCommitmentForm,
    createCommitment,
    projectionDialogOpen,
    setProjectionDialogOpen,
    projectionForm,
    setProjectionForm,
    runProjection,
    saving,
  } = p;

  return (
    <div className="section-enter space-y-5">
      <PageHeader
        title="Planificación"
        subtitle="Presupuestos, déficits, compromisos y proyecciones del mes."
        icon={<CalendarDays className="h-5 w-5" />}
      />

      <section className="ui-shell-card rounded-[28px] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-[180px]">
              <Label className="text-xs text-fg-subtle">Mes</Label>
              <Input
                className="mt-2 bg-surface-1 border-surface-2"
                type="month"
                value={planningMonth}
                onChange={(e) => setPlanningMonth(e.target.value)}
              />
            </div>
            <Button
              onClick={() => refreshPlanning()}
              disabled={planningLoading}
              className="ui-action-primary mt-2 rounded-full lg:mt-7"
            >
              {planningLoading ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {planningSummaryCards.map((item) => (
              <div key={item.label} className="ui-panel-soft rounded-2xl px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.14em] ui-subtle">{item.label}</p>
                <p className={`mt-1 text-sm font-semibold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PlanningSegmentedNav
            sections={planningSections.map((section) => ({ key: section.key, label: section.label, icon: section.icon }))}
            activeKey={planningSection}
            onChange={(key) => goPlanningSection(key as PlanningSectionKey)}
          />
          <div className="flex flex-wrap gap-2">
            {planningSection === "budgets" && (
              <Button onClick={() => openCreateBudgetDialog()} className="ui-action-primary rounded-full">
                Nuevo presupuesto
              </Button>
            )}
            {planningSection === "commitments" && (
              <Button onClick={() => setCommitmentDialogOpen(true)} className="ui-action-primary rounded-full">
                Nuevo compromiso
              </Button>
            )}
            {planningSection === "projections" && (
              <Button onClick={() => setProjectionDialogOpen(true)} className="ui-action-primary rounded-full">
                Nueva proyección
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Diálogo presupuesto */}
      <Dialog
        open={budgetDialogOpen}
        onOpenChange={(open) => {
          setBudgetDialogOpen(open);
          if (!open) resetBudgetDialogState();
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{budgetDialogMode === "edit" ? "Editar presupuesto" : "Crear presupuesto"}</DialogTitle>
            <DialogDescription>
              {budgetDialogMode === "edit"
                ? "Ajusta el nombre, la categoría o el tope del presupuesto seleccionado."
                : "Define un límite mensual sobre una categoría real de tu base."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-fg-subtle">Nombre</Label>
              <Input
                className={inputCls}
                value={budgetForm.name}
                onChange={(e) => setBudgetForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Presupuesto hogar"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs text-fg-subtle">Categoría</Label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setBudgetCategoryComposerOpen((prev) => !prev)}
                  className="h-8 rounded-full px-3 text-xs text-brand hover:bg-brand-soft hover:text-brand"
                >
                  {budgetCategoryComposerOpen ? "Ocultar creador" : "Crear categoría"}
                </Button>
              </div>
              <Select value={budgetForm.categoryId} onValueChange={(v) => setBudgetForm((prev) => ({ ...prev, categoryId: v }))}>
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue placeholder="Selecciona una categoría o crea una nueva" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name} · {getCategoryDirectionLabel(category.direction)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-2xl border border-dashed border-surface-2 bg-surface-1/60 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-fg">¿No ves tu categoría?</p>
                    <p className="text-xs text-fg-subtle">Créala aquí y quedará disponible para presupuestos y transacciones.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBudgetCategoryComposerOpen((prev) => !prev)}
                    className="rounded-full border-surface-2 bg-surface-1 text-fg hover:bg-surface-2"
                  >
                    {budgetCategoryComposerOpen ? "Cerrar" : "Abrir"}
                  </Button>
                </div>
                {budgetCategoryComposerOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-fg-subtle">Código</Label>
                        <Input
                          className={inputCls}
                          value={categoryForm.code}
                          onChange={(e) => setCategoryForm((prev) => ({ ...prev, code: e.target.value }))}
                          placeholder="Ej: HOGAR"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-fg-subtle">Nombre</Label>
                        <Input
                          className={inputCls}
                          value={categoryForm.name}
                          onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Ej: Servicios hogar"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-fg-subtle">Dirección</Label>
                      <Select
                        value={categoryForm.direction}
                        onValueChange={(v) => setCategoryForm((prev) => ({ ...prev, direction: v as CategoryDirection }))}
                      >
                        <SelectTrigger className={selectTriggerCls}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BOTH">Mixta</SelectItem>
                          <SelectItem value="INFLOW">Ingreso</SelectItem>
                          <SelectItem value="OUTFLOW">Egreso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      onClick={() => createBudgetCategory()}
                      disabled={saving}
                      className="w-full bg-brand hover:bg-brand/90 text-surface"
                    >
                      Crear y usar categoría
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Tope mensual (COP)</Label>
              <Input
                className={inputCls}
                type="number"
                value={budgetForm.limitAmount}
                onChange={(e) => setBudgetForm((prev) => ({ ...prev, limitAmount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <Button onClick={() => saveBudget()} disabled={saving} className="w-full bg-brand hover:bg-brand/90 text-surface">
              {budgetDialogMode === "edit" ? "Actualizar presupuesto" : "Guardar presupuesto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo compromiso */}
      <Dialog open={commitmentDialogOpen} onOpenChange={setCommitmentDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Crear compromiso recurrente</DialogTitle>
            <DialogDescription>Registra pagos fijos sin mezclar el formulario con la lectura principal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-fg-subtle">Nombre</Label>
              <Input
                className={inputCls}
                value={commitmentForm.name}
                onChange={(e) => setCommitmentForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Gimnasio"
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Monto (COP)</Label>
              <Input
                className={inputCls}
                type="number"
                value={commitmentForm.amount}
                onChange={(e) => setCommitmentForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-fg-subtle">Cadencia</Label>
                <Select
                  value={commitmentForm.cadence}
                  onValueChange={(v) => setCommitmentForm((prev) => ({ ...prev, cadence: v as Commitment["cadence"] }))}
                >
                  <SelectTrigger className={selectTriggerCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="MONTHLY">Mensual</SelectItem>
                    <SelectItem value="YEARLY">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-fg-subtle">Día del mes</Label>
                <Input
                  className={inputCls}
                  type="number"
                  min={1}
                  max={31}
                  value={commitmentForm.dayOfMonth}
                  onChange={(e) => setCommitmentForm((prev) => ({ ...prev, dayOfMonth: e.target.value }))}
                />
              </div>
            </div>
            <Button onClick={() => createCommitment()} disabled={saving} className="w-full bg-brand hover:bg-brand/90 text-surface">
              Guardar compromiso
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo proyección */}
      <Dialog open={projectionDialogOpen} onOpenChange={setProjectionDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Crear proyección de flujo</DialogTitle>
            <DialogDescription>Simula ahorro e inversión sin cargar la portada del workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-fg-subtle">Horizonte (meses)</Label>
              <Input
                className={inputCls}
                type="number"
                min={1}
                max={36}
                value={projectionForm.horizonMonths}
                onChange={(e) => setProjectionForm((prev) => ({ ...prev, horizonMonths: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Ahorro mensual meta (COP)</Label>
              <Input
                className={inputCls}
                type="number"
                value={projectionForm.monthlySavingsGoal}
                onChange={(e) => setProjectionForm((prev) => ({ ...prev, monthlySavingsGoal: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Inversión mensual meta (COP)</Label>
              <Input
                className={inputCls}
                type="number"
                value={projectionForm.monthlyInvestmentGoal}
                onChange={(e) => setProjectionForm((prev) => ({ ...prev, monthlyInvestmentGoal: e.target.value }))}
              />
            </div>
            <Button onClick={() => runProjection()} disabled={saving} className="w-full bg-brand hover:bg-brand/90 text-surface">
              Ejecutar proyección
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <section className="space-y-4">
        {planningSection === "budgets" && (
          <Card className="ds-soft-card overflow-hidden">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-fg">Presupuestos</CardTitle>
                <CardDescription className="text-fg-subtle">
                  Lectura primero: consumo, saldo restante y alertas por categoría.
                </CardDescription>
              </div>
              <Button onClick={() => openCreateBudgetDialog()} className="bg-brand hover:bg-brand/90 text-surface">
                Nuevo presupuesto
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgets.length === 0 && (
                <div className="rounded-2xl border border-dashed border-surface-2 bg-surface-1/40 p-8 text-center text-fg-subtle">
                  No hay presupuestos en el mes seleccionado.
                </div>
              )}
              {budgets.map((budget) => {
                const utilization =
                  budget.allocated_amount > 0
                    ? Math.min(100, Math.max(0, (budget.actual_amount / budget.allocated_amount) * 100))
                    : 0;
                return (
                  <article
                    key={budget.id}
                    className="planning-budget-row rounded-2xl p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-fg">{budget.name}</p>
                          <Badge variant="secondary" className={getBudgetStatusTone(budget.deficit_summary.status)}>
                            {getBudgetStatusLabel(budget.deficit_summary.status)}
                          </Badge>
                          <span className="rounded-full border border-surface-2 px-2 py-1 text-[11px] text-fg-secondary">
                            {budget.deficit_summary.incidentCount} incidentes
                          </span>
                        </div>
                        <p className="text-xs text-fg-subtle">
                          {formatDate(budget.start_date)} — {formatDate(budget.end_date)}
                        </p>
                        <p className="text-xs text-fg-secondary">
                          {budget.fundingAccounts.length > 0
                            ? `${budget.fundingAccounts.length} cuenta${budget.fundingAccounts.length === 1 ? "" : "s"} de fondeo conectada${budget.fundingAccounts.length === 1 ? "" : "s"}`
                            : "Sin cuentas de fondeo asignadas"}
                        </p>
                      </div>

                      <div className="planning-budget-metrics grid min-w-[260px] grid-cols-2 gap-3">
                        <div className="rounded-xl border border-surface-2 bg-surface-1/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-fg-subtle">Asignado</p>
                          <p className="mt-1 font-semibold text-fg">{formatMoney(budget.allocated_amount, budget.currency)}</p>
                        </div>
                        <div className="rounded-xl border border-surface-2 bg-surface-1/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-fg-subtle">Consumido</p>
                          <p className="mt-1 font-semibold text-fg">{formatMoney(budget.actual_amount, budget.currency)}</p>
                        </div>
                        <div className="rounded-xl border border-surface-2 bg-surface-1/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-fg-subtle">Restante</p>
                          <p className="mt-1 font-semibold text-fg">{formatMoney(budget.remaining_budget_amount, budget.currency)}</p>
                        </div>
                        <div className="rounded-xl border border-surface-2 bg-surface-1/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-fg-subtle">Última causa</p>
                          <p className="mt-1 text-sm text-fg-secondary">{budget.deficit_summary.lastCauseSummary || "Sin incidentes"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-fg-subtle">Consumo del presupuesto</span>
                        <span className="font-medium text-fg">
                          {formatMoney(budget.actual_amount, budget.currency)} / {formatMoney(budget.allocated_amount, budget.currency)}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            budget.deficit_summary.status === "over_budget"
                              ? "bg-danger"
                              : budget.deficit_summary.status === "underfunded"
                                ? "bg-warning"
                                : budget.deficit_summary.status === "warning"
                                  ? "bg-brand"
                                  : "bg-positive"
                          }`}
                          style={{ width: `${utilization}%` }}
                        />
                      </div>
                    </div>

                    <div className="planning-budget-lines mt-4 grid gap-2">
                      {budget.lines.map((line) => {
                        const lineUtilization =
                          line.limit_amount > 0 ? Math.min(100, Math.max(0, (line.actual_amount / line.limit_amount) * 100)) : 0;
                        return (
                          <div key={line.id} className="rounded-xl border border-surface-2 bg-surface-1/70 p-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-medium text-fg">{line.category_name || "Categoría sin nombre"}</span>
                              <span className="text-fg-secondary">
                                {formatMoney(line.actual_amount, budget.currency)} / {formatMoney(line.limit_amount, budget.currency)}
                              </span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  line.remaining_amount < 0 ? "bg-danger" : "bg-brand"
                                }`}
                                style={{ width: `${lineUtilization}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>
        )}

        {planningSection === "deficits" && (
          <Card className="ds-soft-card">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-fg">Déficits</CardTitle>
                <CardDescription className="text-fg-subtle">
                  Historial del mes, causas recurrentes y exporte rápido para cierre financiero.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                className="border-surface-2 bg-surface-1 text-fg hover:bg-surface-2"
                onClick={() =>
                  downloadCsv(`deficits-${planningMonth}.csv`, [
                    ["Presupuesto", "Evento", "Fecha", "Déficit", "Falta de fondeo", "Causa"],
                    ...budgetDeficitEvents.map((event) => [
                      event.budget_name,
                      getDeficitEventLabel(event.event_type),
                      formatDate(event.detected_at),
                      String(event.deficit_amount || 0),
                      String(event.funding_shortfall_amount || 0),
                      event.cause_summary || event.cause_code || "",
                    ]),
                  ])
                }
              >
                Exportar resumen
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-surface-2 bg-surface-1/70 p-4">
                  <p className="text-sm font-semibold text-fg">Eventos del mes</p>
                  <div className="mt-4 space-y-3">
                    {budgetDeficitEvents.length === 0 && (
                      <p className="text-sm text-fg-subtle">No hay déficits registrados en este mes.</p>
                    )}
                    {budgetDeficitEvents.map((event) => (
                      <article key={event.id} className="rounded-xl border border-surface-2 bg-surface-1 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-fg">{event.budget_name}</p>
                            <p className="text-xs text-fg-subtle">{formatDate(event.detected_at)}</p>
                          </div>
                          <Badge variant="secondary" className="border border-danger/35 bg-danger-soft text-danger">
                            {getDeficitEventLabel(event.event_type)}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <div className="rounded-lg border border-surface-2 bg-surface-2 p-2">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">Déficit</p>
                            <p className="mt-1 font-semibold text-fg">{formatMoney(event.deficit_amount, "COP")}</p>
                          </div>
                          <div className="rounded-lg border border-surface-2 bg-surface-2 p-2">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">Fondeo faltante</p>
                            <p className="mt-1 font-semibold text-fg">{formatMoney(event.funding_shortfall_amount, "COP")}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-fg-secondary">{event.cause_summary || "Sin causa registrada."}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-surface-2 bg-surface-1/70 p-4">
                    <p className="text-sm font-semibold text-fg">Presupuestos más sensibles</p>
                    <div className="mt-4 space-y-3">
                      {monthlyFinanceSummary?.topProblemBudgets?.length ? (
                        monthlyFinanceSummary.topProblemBudgets.map((item) => (
                          <div key={item.budgetId} className="rounded-xl border border-surface-2 bg-surface-1 px-3 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-fg">{item.budgetName}</p>
                              <span className="text-xs text-fg-subtle">{item.incidents} eventos</span>
                            </div>
                            <p className="mt-2 text-sm text-danger">{formatMoney(item.maxDeficitAmount, "COP")} pico máximo</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-fg-subtle">Sin presupuestos críticos en este mes.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-surface-2 bg-surface-1/70 p-4">
                    <p className="text-sm font-semibold text-fg">Causas más frecuentes</p>
                    <div className="mt-4 space-y-2">
                      {monthlyFinanceSummary?.frequentCauses?.length ? (
                        monthlyFinanceSummary.frequentCauses.map((cause) => (
                          <div
                            key={cause.causeCode}
                            className="flex items-center justify-between rounded-xl border border-surface-2 bg-surface-1 px-3 py-2"
                          >
                            <span className="text-sm text-fg">{cause.causeCode}</span>
                            <span className="text-xs text-fg-subtle">{cause.count} veces</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-fg-subtle">Todavía no hay causas repetidas.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {planningSection === "commitments" && (
          <Card className="ds-soft-card">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-fg">Compromisos</CardTitle>
                <CardDescription className="text-fg-subtle">
                  Pagos recurrentes visibles sin mezclar formularios ni resúmenes redundantes.
                </CardDescription>
              </div>
              <Button onClick={() => setCommitmentDialogOpen(true)} className="bg-brand hover:bg-brand/90 text-surface">
                Nuevo compromiso
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {commitments.length === 0 && <p className="text-sm text-fg-subtle">No hay compromisos para este mes.</p>}
              {commitments.map((item) => (
                <article key={item.id} className="rounded-2xl border border-surface-2 bg-surface-1/80 px-4 py-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-fg">{item.name}</p>
                      <p className="mt-1 text-xs text-fg-subtle">
                        {item.cadence} · próximo: {formatDate(item.next_run_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          item.is_active
                            ? "border border-positive/40 bg-positive-soft text-positive"
                            : "border border-zinc-600/50 bg-zinc-600/10 text-fg-subtle"
                        }
                      >
                        {item.is_active ? "Activo" : "Pausado"}
                      </Badge>
                      <span className="text-sm font-semibold text-fg">
                        {formatMoney(Number(item.payload.amount || 0), item.payload.currency || "COP")}
                      </span>
                    </div>
                  </div>
                  {item.payload.notes && <p className="mt-3 text-sm text-fg-subtle">{item.payload.notes}</p>}
                </article>
              ))}
            </CardContent>
          </Card>
        )}

        {planningSection === "projections" && (
          <Card className="ds-soft-card">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-fg">Proyecciones</CardTitle>
                <CardDescription className="text-fg-subtle">
                  Escenarios guardados con las métricas útiles para evaluar caja futura.
                </CardDescription>
              </div>
              <Button onClick={() => setProjectionDialogOpen(true)} className="bg-brand hover:bg-brand/90 text-surface">
                Nueva proyección
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {projectionScenarios.length === 0 && <p className="text-sm text-fg-subtle">No hay escenarios ejecutados.</p>}
              {projectionScenarios.map((scenario) => (
                <article key={scenario.id} className="rounded-2xl border border-surface-2 bg-surface-1/80 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-fg">{scenario.title}</p>
                      <p className="text-xs text-fg-subtle">{formatDate(scenario.created_at)}</p>
                    </div>
                    <Badge variant="secondary" className="border border-brand/30 bg-brand-soft text-brand">
                      {Number(scenario.result.horizonMonths || scenario.assumptions?.horizonMonths || 0)} meses
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-surface-2 bg-surface-2 p-3">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">Saldo final</p>
                      <p className="mt-1 font-semibold text-brand">{formatMoney(Number(scenario.result.finalClosingBalance || 0), "COP")}</p>
                    </div>
                    <div className="rounded-xl border border-surface-2 bg-surface-2 p-3">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">Piso de caja</p>
                      <p className="mt-1 font-semibold text-warning">{formatMoney(Number(scenario.result.minClosingBalance || 0), "COP")}</p>
                    </div>
                    <div className="rounded-xl border border-surface-2 bg-surface-2 p-3">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">Balance inicial</p>
                      <p className="mt-1 font-semibold text-fg">{formatMoney(Number(scenario.result.openingBalance || 0), "COP")}</p>
                    </div>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

export default PlanningView;
