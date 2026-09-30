"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  CalendarDays,
  Clock3,
  CreditCard,
  Expand,
  Wallet,
} from "lucide-react";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Account, Budget, Commitment, Transaction } from "@/lib/types";
import { formatMoney, formatDate, toNumber } from "@/lib/format";
import { Dialog } from "@/components/ui/dialog";

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
  monthFlow: { balance: string; income: string; expense: string; spentPercent: number };
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
    monthFlow,
    positiveMonth,
    dashboardActions,
    dashboardBudgets,
    dashboardBudgetWindow,
    dashboardBudgetStart,
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
  const openTileOnClick = (panel: NonNullable<typeof focusedPanel>) => (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    setFocusedPanel(panel);
  };
  const openTileOnKey = (panel: NonNullable<typeof focusedPanel>) => (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    setFocusedPanel(panel);
  };
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

  const visibleBudgets = dashboardBudgetWindow.slice(0, 3);
  const maximumAccountBalance = Math.max(...topAccounts.map((account) => Math.abs(toNumber(account.balance_current))), 1);
  const spendingRatio = Math.max(0, Math.min(100, monthFlow.spentPercent));

  return (
    <div className="finance-bento-dashboard section-enter">
      <Dialog open={focusedPanel !== null} onOpenChange={(open) => { if (!open) setFocusedPanel(null); }}>
        <div className="finance-bento-grid">
          <section className="finance-bento-tile finance-bento-hero" aria-labelledby="finance-bento-balance-title" aria-roledescription="Tarjeta ampliable" tabIndex={0} role="group" onClick={openTileOnClick("month")} onKeyDown={openTileOnKey("month")}>
            <header className="finance-bento-tile-head">
              <p>01 / RESUMEN · {positiveMonth ? "EN POSITIVO" : "A TU RITMO"}</p>
              {focusButton("month", "el resumen del mes")}
            </header>
            <div className="finance-bento-hero-content">
              <div className="finance-bento-kicker">Balance del mes · COP</div>
              <h2 id="finance-bento-balance-title">{monthCoach.title}</h2>
              <p className="finance-bento-balance">{monthCoach.amount}</p>
              <p className="finance-bento-caption">{monthCoach.caption}</p>
            </div>
            <div className="finance-bento-hero-foot">
              <p>{monthCoach.detail}</p>
              <div className="finance-bento-hero-actions">
                {actionByKey.tx && <button type="button" onClick={actionByKey.tx.onClick}><CreditCard aria-hidden="true" />Nueva transacción</button>}
                {actionByKey.budget && <button type="button" onClick={actionByKey.budget.onClick}><CalendarDays aria-hidden="true" />Crear presupuesto</button>}
              </div>
            </div>
            <svg className="finance-bento-hero-orbit" viewBox="0 0 280 300" fill="none" aria-hidden="true">
              <ellipse cx="158" cy="150" rx="104" ry="137" />
              <ellipse cx="158" cy="150" rx="75" ry="106" />
              <ellipse cx="158" cy="150" rx="45" ry="69" />
              <path d="M4 150h270" />
              <circle cx="68" cy="150" r="6" /><circle cx="158" cy="150" r="6" /><circle cx="225" cy="150" r="6" />
            </svg>
          </section>

          <section className="finance-bento-tile finance-bento-flow" aria-labelledby="finance-bento-flow-title" aria-roledescription="Tarjeta ampliable" tabIndex={0} role="group" onClick={openTileOnClick("today")} onKeyDown={openTileOnKey("today")}>
            <header className="finance-bento-tile-head">
              <p>02 / FLUJO DEL MES</p>
              {focusButton("today", "el flujo del mes")}
            </header>
            <div className="finance-bento-flow-layout">
              <div className="finance-bento-donut" style={{ background: `conic-gradient(var(--ui-editorial-coral) 0 ${spendingRatio}%, var(--ui-editorial-forest) ${spendingRatio}% 100%)` }} aria-label={`${Math.round(spendingRatio)} por ciento del ingreso gastado`}>
                <div><strong>{Math.round(spendingRatio)}%</strong><span>gastado</span></div>
              </div>
              <div className="finance-bento-flow-figures">
                <h3 id="finance-bento-flow-title">Entradas<br />y salidas</h3>
                <p><span>Entró</span><strong>{monthFlow.income}</strong></p>
                <p><span>Salió</span><strong>{monthFlow.expense}</strong></p>
              </div>
            </div>
            <button className="finance-bento-next-payment" type="button" onClick={() => setFocusedPanel("payments")}>
              <Clock3 aria-hidden="true" />
              <span>{nextCommitment ? `Siguiente · ${nextCommitment.name}` : "Calendario despejado"}</span>
              <strong>{nextCommitment ? formatMoney(Number(nextCommitment.payload.amount || 0), nextCommitment.payload.currency || "COP") : "Ver pagos"}</strong>
            </button>
          </section>

          <section className="finance-bento-tile finance-bento-budgets" aria-labelledby="finance-bento-budgets-title" aria-roledescription="Tarjeta ampliable" tabIndex={0} role="group" onClick={openTileOnClick("today")} onKeyDown={openTileOnKey("today")}>
            <header className="finance-bento-tile-head">
              <div><p>03 / PRESUPUESTOS</p><h3 id="finance-bento-budgets-title">Presión del mes</h3></div>
              <div className="finance-bento-pager">
                <span>{String(Math.min(dashboardBudgetStart + visibleBudgets.length, dashboardBudgets.length)).padStart(2, "0")} / {String(dashboardBudgets.length).padStart(2, "0")}</span>
                <button type="button" aria-label="Ver presupuestos anteriores" disabled={!dashboardBudgetCanPrev} onClick={() => setDashboardBudgetStart((start) => Math.max(0, start - 3))}>‹</button>
                <button type="button" aria-label="Ver más presupuestos" disabled={!dashboardBudgetCanNext} onClick={() => setDashboardBudgetStart((start) => Math.min(dashboardBudgetMaxStart, start + 3))}>›</button>
                {focusButton("today", "los presupuestos")}
              </div>
            </header>
            {visibleBudgets.length ? <div className="finance-bento-budget-list">
              {visibleBudgets.map((budget) => {
                const allocated = Math.max(0, toNumber(budget.allocated_amount));
                const spent = Math.max(0, toNumber(budget.actual_amount));
                const ratio = allocated ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
                const status = budget.deficit_summary.status === "over_budget" ? "alto" : budget.deficit_summary.status === "warning" ? "atención" : "bien";
                return <article key={budget.id} className="finance-bento-budget-row">
                  <button type="button" className="finance-bento-budget-main" onClick={() => startBudgetExpense(budget)} aria-label={`Registrar gasto en ${budget.name}`}>
                    <span><strong>{budget.name}</strong><em>{status}</em></span>
                    <span className="finance-bento-progress"><i style={{ width: `${ratio}%` }} /></span>
                    <small>{ratio}% usado · {formatMoney(Math.max(0, allocated - spent), budget.currency)} disponible</small>
                  </button>
                  <button type="button" className="finance-bento-edit" onClick={() => openEditBudgetDialog(budget.id)} aria-label={`Editar presupuesto ${budget.name}`}>↗</button>
                </article>;
              })}
            </div> : <div className="finance-bento-empty"><Wallet aria-hidden="true" /><span>Aún no tienes sobres activos este mes.</span><button type="button" onClick={() => actionByKey.budget?.onClick()}>Crear presupuesto</button></div>}
          </section>

          <section className="finance-bento-tile finance-bento-movements" aria-labelledby="finance-bento-movements-title" aria-roledescription="Tarjeta ampliable" tabIndex={0} role="group" onClick={openTileOnClick("transactions")} onKeyDown={openTileOnKey("transactions")}>
            <header className="finance-bento-tile-head">
              <div><p>04 / RASTRO RECIENTE</p><h3 id="finance-bento-movements-title">Lo que acaba de pasar</h3></div>
              <div className="finance-bento-pager"><span>{recentTransactions.length} movimientos</span><button className="finance-bento-see-all" type="button" onClick={onReviewExpenses}>Ver actividad</button>{focusButton("transactions", "los movimientos recientes")}</div>
            </header>
            {recentTransactions.length ? <div className="finance-bento-timeline">
              {recentTransactions.slice(0, 3).map((tx) => {
                const isInflow = tx.direction === "INFLOW";
                return <article key={tx.id}>
                  <span className={`finance-bento-timeline-dot ${isInflow ? "is-inflow" : "is-outflow"}`} />
                  <time>{formatDate(tx.transaction_date)} · {tx.account_name}</time>
                  <strong>{tx.description || "Movimiento"}</strong>
                  <b>{isInflow ? "+" : "−"}{formatMoney(toNumber(tx.amount), tx.currency)}</b>
                </article>;
              })}
            </div> : <div className="finance-bento-empty"><ArrowDownLeft aria-hidden="true" /><span>Los movimientos aparecerán aquí cuando registres actividad.</span><button type="button" onClick={() => actionByKey.tx?.onClick()}>Registrar transacción</button></div>}
          </section>

          <section className="finance-bento-tile finance-bento-accounts" aria-labelledby="finance-bento-accounts-title" aria-roledescription="Tarjeta ampliable" tabIndex={0} role="group" onClick={openTileOnClick("accounts")} onKeyDown={openTileOnKey("accounts")}>
            <header className="finance-bento-tile-head"><div><p>05 / TUS CUENTAS</p><h3 id="finance-bento-accounts-title">Dinero en varios lugares</h3></div>{focusButton("accounts", "los saldos por cuenta")}</header>
            {topAccounts.length ? <div className="finance-bento-account-list">
              {topAccounts.slice(0, 3).map((account) => {
                const balance = toNumber(account.balance_current);
                const ratio = Math.min(100, Math.round((Math.abs(balance) / maximumAccountBalance) * 100));
                return <article key={account.id}><div><span>{account.name}</span><strong>{formatMoney(balance, account.currency)}</strong></div><i><b style={{ width: `${ratio}%` }} /></i></article>;
              })}
            </div> : <div className="finance-bento-empty"><Wallet aria-hidden="true" /><span>Agrega una cuenta para ver dónde está tu dinero.</span></div>}
          </section>
        </div>

        <DialogContent className="max-w-2xl ui-shell-card border border-surface-2 shadow-2xl motion-reduce:duration-0">
          {focusPanel && <>
            <DialogHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">{focusPanel.eyebrow}</p>
              <DialogTitle className="text-3xl tracking-[-0.04em] sm:text-4xl">{focusPanel.title}</DialogTitle>
              <DialogDescription>{focusPanel.summary}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
              {focusPanel.rows.length ? focusPanel.rows.map((row, index) => (
                <div key={`${row.label}-${index}`} className={`rounded-2xl border border-surface-2 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 ${index === 0 ? "bg-brand-soft" : "bg-surface-1"}`} style={{ animationDelay: `${index * 45}ms`, animationFillMode: "both" }}>
                  <p className="text-xs ui-muted">{row.label}</p><p className="mt-1 break-words text-lg font-semibold tracking-tight text-fg">{row.value}</p>
                </div>
              )) : <p className="rounded-2xl border border-dashed border-surface-2 p-5 text-sm ui-muted">No hay datos para mostrar todavía.</p>}
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardView;
