"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  CreditCard,
  Expand,
  Wallet,
} from "lucide-react";
import type { Account, Budget, Commitment, Transaction } from "@/lib/types";
import { formatMoney, formatDate, getAccountTypeLabel, toNumber } from "@/lib/format";

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
  onReviewPayments: () => void;
  onReviewPlanning: () => void;
  onReviewAccounts: () => void;
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
    onReviewPayments,
    onReviewPlanning,
    onReviewAccounts,
    recentTransactions,
    latestTransaction,
    topAccounts,
  } = props;
  const [focusedPanel, setFocusedPanel] = React.useState<null | "month" | "flow" | "budgets" | "payments" | "transactions" | "accounts">(null);
  const [focusBox, setFocusBox] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [focusClosing, setFocusClosing] = React.useState(false);
  const focusReturnRef = React.useRef<HTMLElement | null>(null);
  const originBoxRef = React.useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openFocus = (panel: NonNullable<typeof focusedPanel>, trigger?: HTMLElement | null) => {
    if (focusedPanel || closeTimerRef.current) return;
    focusReturnRef.current = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const grid = gridRef.current;
    const canvas = canvasRef.current;
    const targetPanel = panel;
    const tile = grid?.querySelector<HTMLElement>(`[data-finance-panel="${targetPanel}"]`);
    if (grid && canvas && tile) {
      const tileRect = tile.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const origin = { left: tileRect.left - canvasRect.left, top: tileRect.top - canvasRect.top, width: tileRect.width, height: tileRect.height };
      originBoxRef.current = origin;
      setFocusBox(origin);
      setFocusedPanel(panel);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        // Expand inside the dashboard canvas, matching the prototype's shared-element motion.
        const liveCanvas = canvasRef.current;
        if (!liveCanvas) return;
        // The demo makes the selected Bento panel occupy most of its canvas.
        // Keep the transition anchored to the original tile, then let it become
        // a near full-canvas reading surface so it feels like a scene change.
        const maxWidth = Math.min(1180, liveCanvas.clientWidth - (liveCanvas.clientWidth < 620 ? 16 : 36));
        const availableHeight = Math.max(300, Math.min(liveCanvas.clientHeight - 24, window.innerHeight - 48));
        const targetHeight = Math.min(Math.max(360, tile.scrollHeight), availableHeight);
        setFocusBox({
          left: Math.max(8, (liveCanvas.clientWidth - maxWidth) / 2),
          top: Math.max(8, (liveCanvas.clientHeight - targetHeight) / 2),
          width: maxWidth,
          height: targetHeight,
        });
      }));
      return;
    }
    setFocusedPanel(panel);
  };
  const closeFocus = () => {
    if (!focusedPanel || focusClosing) return;
    if (gridRef.current && focusBox) {
      setFocusClosing(true);
      if (originBoxRef.current) setFocusBox(originBoxRef.current);
      closeTimerRef.current = setTimeout(() => {
        setFocusedPanel(null);
        setFocusBox(null);
        originBoxRef.current = null;
        setFocusClosing(false);
        closeTimerRef.current = null;
        focusReturnRef.current?.focus();
      }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 540);
    } else {
      setFocusedPanel(null);
    }
  };
  React.useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);
  React.useEffect(() => {
    if (!focusedPanel) return;
    if (!focusClosing) requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(".finance-bento-tile.is-focused .finance-bento-close")?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); closeFocus(); } };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focusedPanel, focusClosing, focusBox]);
  const actionByKey = React.useMemo(() => {
    const map: Record<string, DashboardActionDef> = {};
    dashboardActions.forEach((action) => { map[action.key] = action; });
    return map;
  }, [dashboardActions]);
  const focusCopy = {
    month: {
      title: positiveMonth ? "El mes va a favor" : "El mes pide pausa",
      eyebrow: "Lectura del mes",
      summary: monthCoach.detail,
      rows: [
        { label: "Resultado del mes", value: monthCoach.amount },
        { label: "Estado", value: monthCoach.badge },
        { label: "Contexto", value: monthCoach.caption },
        { label: "Presupuestos activos", value: String(dashboardBudgets.length), detail: "Sobres del periodo actual" },
        { label: "Próximo pago", value: nextCommitment?.name || "Sin pagos cercanos", detail: nextCommitment ? `${formatDate(nextCommitment.next_run_at)} · ${formatMoney(Number(nextCommitment.payload.amount || 0), nextCommitment.payload.currency || "COP")}` : "Tu agenda está despejada" },
        { label: "Último movimiento", value: latestTransaction?.description || (latestTransaction ? "Movimiento reciente" : "Sin movimientos aún"), detail: latestTransaction ? `${latestTransaction.account_name} · ${formatDate(latestTransaction.transaction_date)}` : "Al registrar uno aparecerá aquí" },
      ],
    },
    flow: {
      title: "Flujo del mes",
      eyebrow: "02 / Entradas y salidas",
      summary: "Compara lo que ingresó con lo que ya salió y lo que queda disponible.",
      rows: [
        { label: "Entradas", value: monthFlow.income },
        { label: "Salidas", value: monthFlow.expense },
        { label: "Balance disponible", value: monthFlow.balance },
        { label: "Ingreso gastado", value: `${Math.round(monthFlow.spentPercent)}%` },
      ],
    },
    budgets: {
      title: "Presupuestos en tensión",
      eyebrow: "03 / Plan del mes",
      summary: "Revisa cuánto queda en cada sobre y abre uno para registrar un gasto.",
      rows: dashboardBudgets.map((budget) => ({
        label: budget.name,
        value: `${Math.round(budget.allocated_amount ? toNumber(budget.actual_amount) / toNumber(budget.allocated_amount) * 100 : 0)}% usado · ${formatMoney(Math.max(0, toNumber(budget.allocated_amount) - toNumber(budget.actual_amount)), budget.currency)} libre`,
      })),
    },
    payments: {
      title: "Próximos pagos",
      eyebrow: "Agenda financiera",
      summary: "Compromisos próximos para anticipar lo que saldrá de tus cuentas.",
      rows: upcomingCommitments.map((item) => ({
        label: item.name,
        value: formatMoney(Number(item.payload.amount || 0), item.payload.currency || "COP"),
        detail: `${formatDate(item.next_run_at)} · ${item.cadence === "YEARLY" ? "Anual" : item.cadence === "WEEKLY" ? "Semanal" : "Mensual"}`,
      })),
    },
    transactions: {
      title: "Movimientos recientes",
      eyebrow: "Entradas y salidas",
      summary: "Actividad reciente registrada en tus cuentas.",
      rows: recentTransactions.map((tx) => ({
        label: tx.description || "Sin descripción",
        value: `${tx.direction === "INFLOW" ? "+" : "−"} ${formatMoney(toNumber(tx.amount), tx.currency)}`,
        detail: [formatDate(tx.transaction_date), tx.account_name, tx.category_name, tx.status].filter(Boolean).join(" · "),
      })),
    },
    accounts: {
      title: "Tu dinero",
      eyebrow: "Liquidez por cuenta",
      summary: "Saldos actuales en las cuentas que concentran tu liquidez.",
      rows: topAccounts.map((account) => ({
        label: account.name,
        value: formatMoney(toNumber(account.balance_current), account.currency),
        detail: `${getAccountTypeLabel(account.account_type)} · ${account.code}`,
      })),
    },
  };
  const focusPanel = focusedPanel ? focusCopy[focusedPanel] : null;
  const focusActions = {
    month: [
      ...(actionByKey.tx ? [{ label: "Nueva transacción", onClick: actionByKey.tx.onClick }] : []),
      ...(actionByKey.budget ? [{ label: "Crear presupuesto", onClick: actionByKey.budget.onClick }] : []),
    ],
    flow: [
      ...(actionByKey.tx ? [{ label: "Registrar movimiento", onClick: actionByKey.tx.onClick }] : []),
      { label: "Ver movimientos", onClick: onReviewExpenses },
    ],
    budgets: [
      ...(actionByKey.budget ? [{ label: "Crear presupuesto", onClick: actionByKey.budget.onClick }] : []),
      { label: "Abrir planificación", onClick: onReviewPlanning },
    ],
    payments: [
      ...(actionByKey.commitment ? [{ label: "Agregar compromiso", onClick: actionByKey.commitment.onClick }] : []),
      { label: "Ver agenda", onClick: onReviewPayments },
    ],
    transactions: [
      ...(actionByKey.tx ? [{ label: "Nueva transacción", onClick: actionByKey.tx.onClick }] : []),
      { label: "Ver actividad completa", onClick: onReviewExpenses },
    ],
    accounts: [
      ...(actionByKey.account ? [{ label: "Nueva cuenta", onClick: actionByKey.account.onClick }] : []),
      { label: "Gestionar cuentas", onClick: onReviewAccounts },
    ],
  };
  const visualPanel = focusedPanel;
  const openTileOnClick = (panel: NonNullable<typeof focusedPanel>) => (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    openFocus(panel, event.currentTarget);
  };
  const openTileOnKey = (panel: NonNullable<typeof focusedPanel>) => (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    openFocus(panel, event.currentTarget);
  };
  const focusButton = (panel: NonNullable<typeof focusedPanel>, label: string) => (
    <button
      type="button"
      onClick={(event) => openFocus(panel, event.currentTarget)}
      aria-label={`Ampliar ${label}`}
      title={`Ampliar ${label}`}
      aria-expanded={focusedPanel === panel}
      className="finance-bento-open-detail inline-flex shrink-0 items-center justify-center border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
    >
      <Expand className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Ver detalle</span>
    </button>
  );
  const focusControl = (panel: NonNullable<typeof focusedPanel>, label: string) => focusedPanel === panel
    ? <button type="button" className="finance-bento-close" aria-label="Cerrar detalle ampliado" onClick={(event) => { event.stopPropagation(); closeFocus(); }}>×</button>
    : focusButton(panel, label);

  const visibleBudgets = dashboardBudgetWindow.slice(0, 3);
  const maximumAccountBalance = Math.max(...topAccounts.map((account) => Math.abs(toNumber(account.balance_current))), 1);
  const spendingRatio = Math.max(0, Math.min(100, monthFlow.spentPercent));
  const pulseTransactions = recentTransactions.slice(0, 6).reverse();
  const pulseMax = Math.max(...pulseTransactions.map((transaction) => Math.abs(toNumber(transaction.amount))), 1);

  return (
    <div className={`finance-bento-dashboard section-enter${focusedPanel ? " has-focus" : ""}`}>
        <div ref={canvasRef} className="finance-bento-layout">
        <button type="button" className="finance-bento-veil" aria-label="Cerrar tarjeta ampliada" tabIndex={focusedPanel ? 0 : -1} onClick={closeFocus} />
        <nav className="finance-bento-rail" aria-label="Enfoques del resumen">
          {([
            ["month", "Balance del mes"],
            ["flow", "Flujo del mes"],
            ["budgets", "Presupuestos"],
            ["transactions", "Movimientos recientes"],
            ["accounts", "Cuentas"],
            ["payments", "Próximos pagos"],
          ] as const).map(([panel, label], index) => <button key={panel} type="button" className={focusedPanel === panel || (panel === "flow" && focusedPanel === "payments") || (!focusedPanel && index === 0) ? "is-current" : ""} aria-label={`Enfocar ${label}`} onClick={(event) => openFocus(panel, event.currentTarget)}>{String(index + 1).padStart(2, "0")}</button>)}
        </nav>
        <div ref={gridRef} className={`finance-bento-grid${focusedPanel ? " is-focused" : ""}`}>
          <section data-finance-panel="month" style={focusedPanel === "month" && focusBox ? focusBox : undefined} className={`finance-bento-tile finance-bento-hero${focusedPanel === "month" ? " is-focused" : ""}${focusClosing ? " is-closing" : ""}`} aria-label="Balance del mes; ampliar para ver el detalle" aria-expanded={focusedPanel === "month"} aria-labelledby="finance-bento-balance-title" aria-roledescription="Panel ampliable" tabIndex={0} role="group" onClick={openTileOnClick("month")} onKeyDown={openTileOnKey("month")}>
            <header className="finance-bento-tile-head">
              <p>01 / RESUMEN · {positiveMonth ? "EN POSITIVO" : "A TU RITMO"}</p>
              {focusControl("month", "el resumen del mes")}
            </header>
            <div className="finance-bento-hero-content">
              <div className="finance-bento-kicker">Balance del mes · COP</div>
              <h2 id="finance-bento-balance-title">{positiveMonth ? <>El mes va<br /><em>a favor.</em></> : <>El mes pide<br /><em>pausa.</em></>}</h2>
              <p className="finance-bento-balance">{monthCoach.amount}</p>
              <p className="finance-bento-caption">{monthCoach.caption}</p>
            </div>
            {focusedPanel === "month" && focusPanel && <ExpandedDetails panel={focusPanel} rows={focusPanel.rows} actions={focusActions.month} />}
            <div className="finance-bento-hero-foot">
              <p>{monthCoach.detail}</p>
              <div className="finance-bento-hero-actions">
                {actionByKey.tx && <button type="button" onClick={actionByKey.tx.onClick}><CreditCard aria-hidden="true" />Nueva transacción</button>}
                {actionByKey.budget && <button type="button" onClick={actionByKey.budget.onClick}><CalendarDays aria-hidden="true" />Crear presupuesto</button>}
                <button type="button" onClick={onReviewExpenses}><ArrowRight aria-hidden="true" />Ver movimientos</button>
              </div>
            </div>
            {pulseTransactions.length > 0 && <div className="finance-bento-hero-pulse" role="img" aria-label={`Volumen relativo de los ${pulseTransactions.length} movimientos más recientes`}>
              <span>ÚLTIMOS MOVIMIENTOS</span>
              <div>{pulseTransactions.map((transaction) => <i key={transaction.id} style={{ height: `${Math.max(20, Math.round(Math.abs(toNumber(transaction.amount)) / pulseMax * 100))}%` }} />)}</div>
            </div>}
            <svg className="finance-bento-hero-orbit" viewBox="0 0 280 300" fill="none" aria-hidden="true">
              <ellipse cx="158" cy="150" rx="104" ry="137" />
              <ellipse cx="158" cy="150" rx="75" ry="106" />
              <ellipse cx="158" cy="150" rx="45" ry="69" />
              <path d="M4 150h270" />
              <circle cx="68" cy="150" r="6" /><circle cx="158" cy="150" r="6" /><circle cx="225" cy="150" r="6" />
            </svg>
          </section>

            <section data-finance-panel="flow" style={visualPanel === "flow" && focusBox ? focusBox : undefined} className={`finance-bento-tile finance-bento-flow${visualPanel === "flow" ? " is-focused" : ""}${focusClosing ? " is-closing" : ""}`} aria-label="Entradas y salidas; ampliar para ver el detalle" aria-expanded={visualPanel === "flow"} aria-labelledby="finance-bento-flow-title" aria-roledescription="Panel ampliable" tabIndex={0} role="group" onClick={openTileOnClick("flow")} onKeyDown={openTileOnKey("flow")}>
            <header className="finance-bento-tile-head">
              <p>02 / FLUJO DEL MES</p>
              {focusControl("flow", "el flujo del mes")}
            </header>
            {visualPanel === "flow" && focusPanel && <ExpandedDetails panel={focusPanel} rows={focusPanel.rows} actions={focusActions.flow} />}
            <div className="finance-bento-flow-layout">
              <div className="finance-bento-donut" style={{ background: `conic-gradient(var(--ui-editorial-coral) 0 ${spendingRatio}%, var(--ui-editorial-lime) ${spendingRatio}% 100%)` }} aria-label={`${Math.round(spendingRatio)} por ciento del ingreso gastado; ${100 - Math.round(spendingRatio)} por ciento disponible`}>
                <div><strong>{Math.round(spendingRatio)}%</strong><span>gastado</span></div>
              </div>
              <div className="finance-bento-flow-figures">
                <h3 id="finance-bento-flow-title">Entradas<br />y salidas</h3>
                <p><span>Entró</span><strong>{monthFlow.income}</strong></p>
                <p><span>Salió</span><strong>{monthFlow.expense}</strong></p>
              </div>
            </div>
            <button className="finance-bento-next-payment" type="button" onClick={(event) => openFocus("payments", event.currentTarget)}>
              <Clock3 aria-hidden="true" />
              <span>{nextCommitment ? `Siguiente · ${nextCommitment.name}` : "Calendario despejado"}</span>
              <strong>{nextCommitment ? formatMoney(Number(nextCommitment.payload.amount || 0), nextCommitment.payload.currency || "COP") : "Ver pagos"}</strong>
            </button>
          </section>

          <section data-finance-panel="budgets" style={focusedPanel === "budgets" && focusBox ? focusBox : undefined} className={`finance-bento-tile finance-bento-budgets${focusedPanel === "budgets" ? " is-focused" : ""}${focusClosing ? " is-closing" : ""}`} aria-label="Presupuestos; ampliar para ver el detalle" aria-expanded={focusedPanel === "budgets"} aria-labelledby="finance-bento-budgets-title" aria-roledescription="Panel ampliable" tabIndex={0} role="group" onClick={openTileOnClick("budgets")} onKeyDown={openTileOnKey("budgets")}>
            <header className="finance-bento-tile-head">
              <div><p>03 / PRESUPUESTOS</p><h3 id="finance-bento-budgets-title">Presión del mes</h3></div>
              <div className="finance-bento-pager">
                <span>{String(Math.min(dashboardBudgetStart + visibleBudgets.length, dashboardBudgets.length)).padStart(2, "0")} / {String(dashboardBudgets.length).padStart(2, "0")}</span>
                <button type="button" aria-label="Ver presupuestos anteriores" disabled={!dashboardBudgetCanPrev} onClick={() => setDashboardBudgetStart((start) => Math.max(0, start - 3))}>‹</button>
                <button type="button" aria-label="Ver más presupuestos" disabled={!dashboardBudgetCanNext} onClick={() => setDashboardBudgetStart((start) => Math.min(dashboardBudgetMaxStart, start + 3))}>›</button>
                {focusControl("budgets", "los presupuestos")}
              </div>
            </header>
            {focusedPanel === "budgets" && focusPanel && <ExpandedDetails panel={focusPanel} rows={focusPanel.rows} actions={focusActions.budgets} budgets={dashboardBudgets} onBudgetExpense={startBudgetExpense} onBudgetEdit={openEditBudgetDialog} />}
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

          <section data-finance-panel="transactions" style={focusedPanel === "transactions" && focusBox ? focusBox : undefined} className={`finance-bento-tile finance-bento-movements${focusedPanel === "transactions" ? " is-focused" : ""}${focusClosing ? " is-closing" : ""}`} aria-label="Movimientos recientes; ampliar para ver el detalle" aria-expanded={focusedPanel === "transactions"} aria-labelledby="finance-bento-movements-title" aria-roledescription="Panel ampliable" tabIndex={0} role="group" onClick={openTileOnClick("transactions")} onKeyDown={openTileOnKey("transactions")}>
            <header className="finance-bento-tile-head">
              <div><p>04 / RASTRO RECIENTE</p><h3 id="finance-bento-movements-title">Lo que acaba de pasar</h3></div>
              <div className="finance-bento-pager"><span>{recentTransactions.length} movimientos</span><button className="finance-bento-see-all" type="button" onClick={onReviewExpenses}>Ver actividad</button>{focusControl("transactions", "los movimientos recientes")}</div>
            </header>
            {focusedPanel === "transactions" && focusPanel && <ExpandedDetails panel={focusPanel} rows={focusPanel.rows} actions={focusActions.transactions} />}
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

          <section data-finance-panel="accounts" style={focusedPanel === "accounts" && focusBox ? focusBox : undefined} className={`finance-bento-tile finance-bento-accounts${focusedPanel === "accounts" ? " is-focused" : ""}${focusClosing ? " is-closing" : ""}`} aria-label="Cuentas; ampliar para ver el detalle" aria-expanded={focusedPanel === "accounts"} aria-labelledby="finance-bento-accounts-title" aria-roledescription="Panel ampliable" tabIndex={0} role="group" onClick={openTileOnClick("accounts")} onKeyDown={openTileOnKey("accounts")}>
            <header className="finance-bento-tile-head"><div><p>05 / SALDO CONSOLIDADO</p><h3 id="finance-bento-accounts-title">{monthFlow.balance}</h3><span className="finance-bento-account-caption">Dinero en varios lugares</span></div>{focusControl("accounts", "los saldos por cuenta")}</header>
            {focusedPanel === "accounts" && focusPanel && <ExpandedDetails panel={focusPanel} rows={focusPanel.rows} actions={focusActions.accounts} />}
            {topAccounts.length ? <div className="finance-bento-account-list">
              {topAccounts.slice(0, 3).map((account) => {
                const balance = toNumber(account.balance_current);
                const ratio = Math.min(100, Math.round((Math.abs(balance) / maximumAccountBalance) * 100));
                return <article key={account.id}><div><span>{account.name}</span><strong>{formatMoney(balance, account.currency)}</strong></div><i><b style={{ width: `${ratio}%` }} /></i></article>;
              })}
            </div> : <div className="finance-bento-empty"><Wallet aria-hidden="true" /><span>Agrega una cuenta para ver dónde está tu dinero.</span></div>}
          </section>

          <section data-finance-panel="payments" style={focusedPanel === "payments" && focusBox ? focusBox : undefined} className={`finance-bento-tile finance-bento-payments${focusedPanel === "payments" ? " is-focused" : ""}${focusClosing ? " is-closing" : ""}`} aria-label="Próximos pagos; ampliar para ver el detalle" aria-expanded={focusedPanel === "payments"} aria-labelledby="finance-bento-payments-title" aria-roledescription="Panel ampliable" tabIndex={0} role="group" onClick={openTileOnClick("payments")} onKeyDown={openTileOnKey("payments")}>
            <header className="finance-bento-tile-head">
              <div><p>06 / A LA VUELTA</p><h3 id="finance-bento-payments-title">Próximos pagos</h3></div>
              <div className="finance-bento-pager"><span>{upcomingCommitments.length} activos</span><button className="finance-bento-see-all" type="button" onClick={onReviewPayments}>Ver agenda</button>{focusControl("payments", "los próximos pagos")}</div>
            </header>
            {focusedPanel === "payments" && focusPanel && <ExpandedDetails panel={focusPanel} rows={focusPanel.rows} actions={focusActions.payments} />}
            {upcomingCommitments.length ? <div className="finance-bento-payment-list">
              {upcomingCommitments.slice(0, 3).map((item) => (
                <article key={item.id}>
                  <time>{formatDate(item.next_run_at)}</time>
                  <span><strong>{item.name}</strong><small>{item.cadence === "YEARLY" ? "Anual" : item.cadence === "WEEKLY" ? "Semanal" : "Mensual"}</small></span>
                  <b>{formatMoney(Number(item.payload.amount || 0), item.payload.currency || "COP")}</b>
                </article>
              ))}
            </div> : <div className="finance-bento-empty"><Clock3 aria-hidden="true" /><span>No tienes pagos próximos programados.</span><button type="button" onClick={() => actionByKey.commitment?.onClick()}>Agregar pago</button></div>}
          </section>
        </div>
        </div>
    </div>
  );
}

function ExpandedDetails({ panel, rows, actions = [], budgets, onBudgetExpense, onBudgetEdit }: { panel: { title: string; eyebrow: string; summary: string; rows: { label: string; value: string; detail?: string }[] }; rows: { label: string; value: string; detail?: string }[]; actions?: { label: string; onClick: () => void }[]; budgets?: Budget[]; onBudgetExpense?: (budget: Budget) => void; onBudgetEdit?: (budgetId: number) => void }) {
  return (
    <div className="finance-bento-expanded" role="region" aria-label={`Detalle: ${panel.title}`}>
      <p className="finance-bento-expanded-eyebrow">{panel.eyebrow}</p>
      <h3>{panel.title}</h3>
      <p className="finance-bento-expanded-summary">{panel.summary}</p>
      {actions.length > 0 && <div className="finance-bento-expanded-toolbar">{actions.map((action) => <button type="button" key={action.label} onClick={action.onClick}>{action.label}<span aria-hidden="true">↗</span></button>)}</div>}
      <div className="finance-bento-expanded-rows">
        {budgets ? budgets.map((budget, index) => {
          const allocated = Math.max(0, toNumber(budget.allocated_amount));
          const spent = Math.max(0, toNumber(budget.actual_amount));
          const ratio = allocated ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
          const status = budget.deficit_summary.status === "over_budget" ? "Excedido" : budget.deficit_summary.status === "warning" ? "Atención" : "En control";
          return <article key={budget.id} style={{ animationDelay: `${170 + index * 65}ms` }}><span>{budget.name} · {status}</span><strong>{formatMoney(Math.max(0, allocated - spent), budget.currency)} libre</strong><small>{formatMoney(spent, budget.currency)} de {formatMoney(allocated, budget.currency)} · {ratio}% usado</small><div className="finance-bento-expanded-meter" aria-label={`${ratio}% del presupuesto usado`}><i style={{ width: `${ratio}%` }} /></div><div className="finance-bento-expanded-actions"><button type="button" onClick={() => onBudgetExpense?.(budget)}>Registrar gasto</button><button type="button" onClick={() => onBudgetEdit?.(budget.id)}>Editar</button></div></article>;
        }) : rows.length ? rows.map((row, index) => <article key={`${row.label}-${index}`} style={{ animationDelay: `${170 + index * 65}ms` }}><span>{row.label}</span><strong>{row.value}</strong>{row.detail && <small>{row.detail}</small>}</article>) : <p>No hay datos para mostrar todavía.</p>}
      </div>
    </div>
  );
}

export default DashboardView;
