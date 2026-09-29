"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  CalendarDays,
  Clock3,
  CreditCard,
  Expand,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardBudgetStrip from "@/components/DashboardBudgetStrip";
import type { Account, Budget, Commitment, Transaction } from "@/lib/types";
import { formatMoney, formatDate, toNumber } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface MonthCoachState {
  badge: string;
  title: string;
  amount: string;
  caption: string;
  detail: string;
}

export interface DashboardActionDef {
  key: string;
  label: string;
  caption: string;
  icon: typeof Wallet;
  onClick: () => void;
  tone?: "primary";
}

export interface DashboardViewProps {
  monthCoach: MonthCoachState;
  positiveMonth: boolean;
  dashboardActions: DashboardActionDef[];
  dashboardBudgets: Budget[];
  dashboardBudgetWindow: Budget[];
  dashboardBudgetStart: number;
  setDashboardBudgetStart: React.Dispatch<React.SetStateAction<number>>;
  dashboardBudgetMaxStart: number;
  dashboardBudgetCanPrev: boolean;
  dashboardBudgetCanNext: boolean;
  startBudgetExpense: (budget: Budget) => void;
  openEditBudgetDialog: (budgetId: number) => void;
  upcomingCommitments: Commitment[];
  nextCommitment?: Commitment;
  onReviewExpenses: () => void;
  recentTransactions: Transaction[];
  latestTransaction?: Transaction;
  topAccounts: Account[];
}

export function DashboardView(props: DashboardViewProps) {
  const {
    monthCoach,
    positiveMonth,
    dashboardActions,
    dashboardBudgets,
    dashboardBudgetWindow,
    setDashboardBudgetStart,
    dashboardBudgetMaxStart,
    dashboardBudgetCanPrev,
    dashboardBudgetCanNext,
    startBudgetExpense,
    openEditBudgetDialog,
    upcomingCommitments,
    nextCommitment,
    onReviewExpenses,
    recentTransactions,
    latestTransaction,
    topAccounts,
  } = props;
  const [focusedPanel, setFocusedPanel] = React.useState<null | "month" | "today" | "payments" | "transactions" | "accounts">(null);
  const actionByKey = React.useMemo(() => {
    const map: Record<string, DashboardActionDef> = {};
    dashboardActions.forEach((action) => { map[action.key] = action; });
    return map;
  }, [dashboardActions]);
  const heroCardCls = "ui-shell-card rounded-[28px] p-5 md:p-6";
  const nextStepCls = "ui-panel-soft rounded-2xl p-3.5 flex items-center gap-3 transition hover:border-brand/40 hover:bg-brand-soft";
  const insightRowCls = "ui-panel-soft rounded-2xl p-3.5 flex gap-3 items-start";
  const insightIconCls = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand border border-brand/20";
  const listRowCls = "ui-panel-soft rounded-xl px-3 py-3 transition hover:border-brand/30";
  const countBadgeCls =
    "border border-surface-2 bg-surface-1 text-fg-subtle";
  const focusCopy = {
    month: {
      title: monthCoach.title,
      eyebrow: "Lectura del mes",
      summary: monthCoach.detail,
      rows: [
        { label: "Resultado del mes", value: monthCoach.amount },
        { label: "Estado", value: monthCoach.badge },
        { label: "Contexto", value: monthCoach.caption },
      ],
    },
    today: {
      title: "Lo importante hoy",
      eyebrow: "Resumen de actividad",
      summary: "Una lectura rápida de presupuestos, compromisos y tu movimiento más reciente.",
      rows: [
        { label: "Presupuestos activos", value: String(dashboardBudgets.length) },
        { label: "Próximo pago", value: nextCommitment?.name ?? "Sin pagos cercanos" },
        { label: "Último movimiento", value: latestTransaction?.description || "Sin movimientos aún" },
      ],
    },
    payments: {
      title: "Próximos pagos",
      eyebrow: "Agenda financiera",
      summary: "Compromisos próximos para anticipar lo que saldrá de tus cuentas.",
      rows: upcomingCommitments.slice(0, 8).map((item) => ({
        label: `${item.name} · ${formatDate(item.next_run_at)}`,
        value: formatMoney(Number(item.payload.amount || 0), item.payload.currency || "COP"),
      })),
    },
    transactions: {
      title: "Movimientos recientes",
      eyebrow: "Entradas y salidas",
      summary: "Actividad reciente registrada en tus cuentas.",
      rows: recentTransactions.slice(0, 8).map((tx) => ({
        label: `${tx.description || "Sin descripción"} · ${formatDate(tx.transaction_date)}`,
        value: `${tx.direction === "INFLOW" ? "+" : "−"} ${formatMoney(toNumber(tx.amount), tx.currency)}`,
      })),
    },
    accounts: {
      title: "Tu dinero",
      eyebrow: "Liquidez por cuenta",
      summary: "Saldos actuales en las cuentas que concentran tu liquidez.",
      rows: topAccounts.slice(0, 8).map((account) => ({
        label: account.name,
        value: formatMoney(toNumber(account.balance_current), account.currency),
      })),
    },
  };
  const focusPanel = focusedPanel ? focusCopy[focusedPanel] : null;
  const focusButton = (panel: NonNullable<typeof focusedPanel>, label: string) => (
    <button
      type="button"
      onClick={() => setFocusedPanel(panel)}
      aria-label={`Ampliar ${label}`}
      title={`Ampliar ${label}`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-surface-2 bg-surface-1 text-fg-subtle transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 motion-safe:hover:scale-105"
    >
      <Expand className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <div className="dashboard-view-compact section-enter space-y-5">
      <Dialog open={focusedPanel !== null} onOpenChange={(open) => { if (!open) setFocusedPanel(null); }}>
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className={`${heroCardCls} relative min-h-[300px] overflow-hidden p-6 md:p-8`}>
          <CardContent className="relative p-0">
            <div className="absolute right-0 top-0">{focusButton("month", "el resumen del mes")}</div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-5 pr-10">
                <Badge
                  variant="secondary"
                  className={
                    positiveMonth
                      ? "border border-positive/40 bg-positive-soft text-positive"
                      : "border border-warning/40 bg-warning-soft text-warning"
                  }
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {monthCoach.badge}
                </Badge>
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.24em] ui-subtle">Tu mes, en simple</p>
                  <h2 className="max-w-xl text-4xl font-semibold tracking-[-0.055em] text-fg md:text-6xl">
                    {monthCoach.title}
                  </h2>
                </div>
                <div>
                  <p
                    className="text-5xl font-bold tracking-[-0.06em] md:text-7xl text-brand"
                  >
                    {monthCoach.amount}
                  </p>
                  <p className="mt-1 text-sm ui-muted">{monthCoach.caption}</p>
                </div>
                <p className="max-w-xl text-sm leading-6 ui-muted">{monthCoach.detail}</p>
              </div>

              <div className="grid min-w-[240px] gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {actionByKey.tx && (
                  <button type="button" onClick={actionByKey.tx.onClick} className="ui-panel-soft rounded-2xl p-3.5 flex items-center gap-3 text-left">
                    <CreditCard className="h-4 w-4 text-brand" />
                    <span>
                      <strong className="block text-sm font-semibold text-fg">Nueva transacción</strong>
                      <small className="mt-0.5 block text-xs ui-muted">Registrar en segundos</small>
                    </span>
                  </button>
                )}
                {actionByKey.budget && (
                  <button type="button" onClick={actionByKey.budget.onClick} className="ui-panel-soft rounded-2xl p-3.5 flex items-center gap-3 text-left">
                    <CalendarDays className="h-4 w-4 text-brand" />
                    <span>
                      <strong className="block text-sm font-semibold text-fg">Crear presupuesto</strong>
                      <small className="mt-0.5 block text-xs ui-muted">Armar un sobre mensual</small>
                    </span>
                  </button>
                )}
                <button type="button" onClick={onReviewExpenses} className="ui-panel-soft rounded-2xl p-3.5 flex items-center gap-3 text-left">
                  <Search className="h-4 w-4 text-brand" />
                  <span>
                    <strong className="block text-sm font-semibold text-fg">Revisar gastos</strong>
                    <small className="mt-0.5 block text-xs ui-muted">Ver movimientos recientes</small>
                  </span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="ds-soft-card relative overflow-hidden">
          <CardHeader className="pb-3 pr-14">
            <CardTitle className="text-fg text-xl">Lo importante hoy</CardTitle>
            <CardDescription className="text-fg-subtle">Una lectura corta para no perderte entre datos.</CardDescription>
            <div className="absolute right-5 top-5">{focusButton("today", "lo importante hoy")}</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={insightRowCls}>
              <div className={insightIconCls}>
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">{dashboardBudgets.length} presupuestos activos</p>
                <p className="text-xs ui-muted">Se actualizan con las transacciones vinculadas.</p>
              </div>
            </div>
            <div className={insightRowCls}>
              <div className={insightIconCls}>
                <Clock3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">
                  {nextCommitment ? nextCommitment.name : "Sin pagos cercanos"}
                </p>
                <p className="text-xs ui-muted">
                  {nextCommitment
                    ? "Pago programado"
                    : "Cuando registres compromisos aparecerán aquí."}
                </p>
              </div>
            </div>
            <div className={insightRowCls}>
              <div className={insightIconCls}>
                <ArrowDownLeft className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">
                  {latestTransaction ? latestTransaction.description || "Movimiento reciente" : "Sin movimientos aún"}
                </p>
                <p className="text-xs ui-muted">
                  {latestTransaction
                    ? "Movimiento registrado"
                    : "Agrega tu primera transacción para empezar a leer patrones."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <DashboardBudgetStrip
        budgets={dashboardBudgetWindow}
        totalBudgets={dashboardBudgets.length}
        onPrev={() => setDashboardBudgetStart((prev) => Math.max(0, prev - 5))}
        onNext={() => setDashboardBudgetStart((prev) => Math.min(dashboardBudgetMaxStart, prev + 5))}
        canPrev={dashboardBudgetCanPrev}
        canNext={dashboardBudgetCanNext}
        onRegisterExpense={(budget) => startBudgetExpense(budget as Budget)}
        onEditBudget={(budget) => openEditBudgetDialog(budget.id)}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.92fr_1.25fr_0.95fr]">
        <Card className="ds-soft-card relative overflow-hidden">
          <CardHeader className="pb-3 pr-14">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-fg text-xl">Próximos pagos</CardTitle>
                <CardDescription className="text-fg-subtle">Solo lo que necesitas anticipar.</CardDescription>
              </div>
              <Badge variant="secondary" className={countBadgeCls}>
                {upcomingCommitments.length}
              </Badge>
            </div>
            <div className="absolute right-5 top-5">{focusButton("payments", "los próximos pagos")}</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingCommitments.length === 0 && (
              <div className="dashboard-empty-state">
                <Clock3 className="h-5 w-5 text-brand" />
                <div>
                  <p className="text-sm font-medium text-fg">Tu calendario esta despejado</p>
                  <p className="mt-1 text-xs ui-muted">Los pagos recurrentes apareceran aqui cuando los registres.</p>
                </div>
              </div>
            )}
            {upcomingCommitments.map((item) => (
              <article key={item.id} className={listRowCls}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{item.name}</p>
                    <p className="text-xs text-fg-subtle">
                      {formatDate(item.next_run_at)} · {item.cadence}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-fg">
                    {formatMoney(Number(item.payload.amount || 0), item.payload.currency || "COP")}
                  </span>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="ds-soft-card relative overflow-hidden">
          <CardHeader className="pb-3 pr-14">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-fg text-xl">Movimientos</CardTitle>
                <CardDescription className="text-fg-subtle">Una lista corta para leer rápido.</CardDescription>
              </div>
              <Badge variant="secondary" className={countBadgeCls}>
                {recentTransactions.length}
              </Badge>
            </div>
            <div className="absolute right-5 top-5">{focusButton("transactions", "los movimientos recientes")}</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentTransactions.map((tx) => {
              const isInflow = tx.direction === "INFLOW";
              const amount = toNumber(tx.amount);
              return (
                <article key={tx.id} className={listRowCls}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{tx.description || "Sin descripción"}</p>
                      <p className="text-[11px] text-fg-subtle">
                        {formatDate(tx.transaction_date)} · {tx.account_name}
                      </p>
                    </div>
                    <div className={`text-sm font-semibold ${isInflow ? "text-positive" : "text-danger"}`}>
                      {isInflow ? "+" : "−"} {formatMoney(amount, tx.currency)}
                    </div>
                  </div>
                </article>
              );
            })}
            {recentTransactions.length === 0 && <p className="text-sm text-fg-subtle">No hay actividad reciente.</p>}
          </CardContent>
        </Card>

        <Card className="ds-soft-card relative overflow-hidden">
          <CardHeader className="pb-3 pr-14">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-fg text-xl">Tu dinero</CardTitle>
                <CardDescription className="text-fg-subtle">Donde vive hoy tu liquidez.</CardDescription>
              </div>
              <Badge variant="secondary" className={countBadgeCls}>
                {topAccounts.length}
              </Badge>
            </div>
            <div className="absolute right-5 top-5">{focusButton("accounts", "los saldos por cuenta")}</div>
          </CardHeader>
          <CardContent className="space-y-3">
            {topAccounts.map((account) => {
              const amount = Math.abs(toNumber(account.balance_current));
              const maxAmount = Math.max(...topAccounts.map((item) => Math.abs(toNumber(item.balance_current))), 1);
              const ratio = Math.min(100, (amount / maxAmount) * 100);
              return (
                <div key={account.id} className="dashboard-money-row space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2 truncate text-fg-secondary">
                      <span className="dashboard-money-icon"><Wallet className="h-3.5 w-3.5" /></span>
                      <span className="truncate">{account.name}</span>
                    </span>
                    <span className="font-medium text-fg">
                      {formatMoney(toNumber(account.balance_current), account.currency)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${ratio}%` }} />
                  </div>
                </div>
              );
            })}
            {topAccounts.length === 0 && (
              <div className="dashboard-empty-state">
                <Wallet className="h-5 w-5 text-brand" />
                <div>
                  <p className="text-sm font-medium text-fg">Tu liquidez aparecera aqui</p>
                  <p className="mt-1 text-xs ui-muted">Agrega una cuenta para ver donde vive tu dinero.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <DialogContent className="max-w-2xl ui-shell-card border border-surface-2 shadow-2xl motion-reduce:duration-0">
        {focusPanel && (
          <>
            <DialogHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">{focusPanel.eyebrow}</p>
              <DialogTitle className="text-3xl tracking-[-0.04em] sm:text-4xl">{focusPanel.title}</DialogTitle>
              <DialogDescription>{focusPanel.summary}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
              {focusPanel.rows.length ? focusPanel.rows.map((row, index) => (
                <div key={`${row.label}-${index}`} className={`rounded-2xl border border-surface-2 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 ${index === 0 ? "bg-brand-soft" : "bg-surface-1"}`} style={{ animationDelay: `${index * 45}ms`, animationFillMode: "both" }}>
                  <p className="text-xs ui-muted">{row.label}</p>
                  <p className="mt-1 break-words text-lg font-semibold tracking-tight text-fg">{row.value}</p>
                </div>
              )) : <p className="rounded-2xl border border-dashed border-surface-2 p-5 text-sm ui-muted">No hay datos para mostrar todavía.</p>}
            </div>
          </>
        )}
      </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardView;
