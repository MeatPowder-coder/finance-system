/**
 * Helpers de formato y etiquetas para el Finance System.
 *
 * Extraídos de apps/web/app/page.tsx. Funciones puras que mapean
 * enums del dominio a etiquetas legibles en español (es-CO) y
 * helpers de formato de números/fechas.
 */

import type {
  AccountType,
  BudgetDeficitEventType,
  BudgetStatus,
  CategoryDirection,
  Commitment,
  Counterparty,
  TxDirection,
  TxStatus,
} from "./types";

// --- Numéricos ---
export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export function formatMoney(value: number, currency = "COP"): string {
  try {
    const n = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "COP" ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

// --- Fechas ---
export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-CO");
}

export function formatMonthLabel(value: string): string {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const label = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// --- Etiquetas de enums ---
export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case "CHECKING":
      return "Cuenta corriente";
    case "SAVINGS":
      return "Ahorros";
    case "CREDIT_CARD":
      return "Tarjeta de crédito";
    case "CASH":
      return "Efectivo";
    case "INVESTMENT":
      return "Inversión";
    case "LOAN":
      return "Préstamo";
    default:
      return "Otro tipo";
  }
}

export function getDirectionLabel(direction: TxDirection): string {
  return direction === "INFLOW" ? "Ingreso" : "Egreso";
}

export function getDirectionHint(direction: TxDirection): string {
  return direction === "INFLOW" ? "Suma dinero a la cuenta" : "Resta dinero de la cuenta";
}

export function getCadenceLabel(cadence: Commitment["cadence"]): string {
  switch (cadence) {
    case "WEEKLY":
      return "Semanal";
    case "MONTHLY":
      return "Mensual";
    case "YEARLY":
      return "Anual";
    default:
      return cadence;
  }
}

export function getCounterpartyTypeLabel(type: Counterparty["type"]): string {
  switch (type) {
    case "PERSON":
      return "Persona";
    case "BUSINESS":
      return "Empresa";
    case "INTERNAL":
      return "Interna";
    default:
      return "Otro";
  }
}

export function getCategoryDirectionLabel(direction: CategoryDirection): string {
  switch (direction) {
    case "INFLOW":
      return "Ingreso";
    case "OUTFLOW":
      return "Egreso";
    default:
      return "Mixta";
  }
}

export function getBudgetStatusLabel(status: BudgetStatus): string {
  switch (status) {
    case "over_budget":
      return "Sobrepresupuesto";
    case "underfunded":
      return "Sin fondeo";
    case "warning":
      return "En vigilancia";
    default:
      return "Sano";
  }
}

export function getDeficitEventLabel(eventType: BudgetDeficitEventType): string {
  switch (eventType) {
    case "ENTERED_DEFICIT":
      return "Entró en déficit";
    case "DEFICIT_WORSENED":
      return "Déficit empeoró";
    case "DEFICIT_IMPROVED":
      return "Déficit mejoró";
    default:
      return "Salió de déficit";
  }
}

// --- Tone strings (clases Tailwind) para badges/pills ---
// Nota: estos strings heredan del estilo zinc/cyan actual; el nuevo
// sistema de StatusPill (components/finance/StatusPill) usa tokens --
// estas helpers se mantienen para compatibilidad con el JSX existente.
export function getBudgetStatusTone(status: BudgetStatus): string {
  switch (status) {
    case "over_budget":
      return "border-rose-500/40 bg-rose-500/10 text-rose-200";
    case "underfunded":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "warning":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";
    default:
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
}

export function getBudgetStatusAccent(status: BudgetStatus): string {
  switch (status) {
    case "over_budget":
      return "from-rose-500/20 via-rose-500/10 to-transparent border-rose-500/30";
    case "underfunded":
      return "from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30";
    case "warning":
      return "from-cyan-500/20 via-cyan-500/10 to-transparent border-cyan-500/30";
    default:
      return "from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/30";
  }
}

export function getStatusTone(status: TxStatus): string {
  switch (status) {
    case "RECONCILED":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
    case "POSTED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "PENDING":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    default:
      return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";
  }
}

// --- CSV export (utilidad para Reportes) ---
export function downloadCsv(
  filename: string,
  rows: Array<Array<string | number>>
): void {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
