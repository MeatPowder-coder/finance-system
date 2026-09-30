/**
 * Tipos del dominio financiero del Finance System.
 *
 * Extraídos de apps/web/app/page.tsx para permitir reutilización
 * entre views, hooks y componentes sin duplicar definiciones.
 *
 * NOTA: mantener sincronizado con cualquier nuevo tipo añadido en page.tsx
 * durante la migración incremental.
 */

// --- Navegación ---
export type TabKey =
  | "dashboard"
  | "accounts"
  | "transactions"
  | "reports"
  | "investments"
  | "planning"
  | "copilot"
  | "settings";

export type PlanningSectionKey =
  | "budgets"
  | "deficits"
  | "commitments"
  | "projections";

// --- Enums de dominio ---
export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "CASH"
  | "INVESTMENT"
  | "LOAN"
  | "OTHER";

export type TxDirection = "INFLOW" | "OUTFLOW";

export type TxStatus = "PENDING" | "POSTED" | "RECONCILED" | "VOID";

export type CategoryDirection = "INFLOW" | "OUTFLOW" | "BOTH";

export type BudgetStatus = "healthy" | "warning" | "over_budget" | "underfunded";

export type BudgetDeficitEventType =
  | "ENTERED_DEFICIT"
  | "DEFICIT_WORSENED"
  | "DEFICIT_IMPROVED"
  | "EXITED_DEFICIT";

// --- Resumen / KPIs ---
export type Summary = {
  totalBalance: number;
  monthInflow: number;
  monthOutflow: number;
  investedTotal: number;
  activePositions: number;
};

// --- Cuentas ---
export type Account = {
  id: number;
  code: string;
  name: string;
  currency: string;
  account_type: AccountType;
  balance_current: number | string;
  is_active: boolean;
};

// --- Categorías y contrapartes ---
export type Category = {
  id: number;
  code: string;
  name: string;
  direction: CategoryDirection;
};

export type Counterparty = {
  id: number;
  name: string;
  type: "PERSON" | "BUSINESS" | "INTERNAL" | "OTHER";
};

export type TxTag = {
  id: number;
  name: string;
  color: string | null;
};

// --- Transacciones ---
export type TxSplit = {
  id: number;
  lineNo: number;
  description: string | null;
  amount: number | string;
  categoryName: string | null;
  counterpartyName: string | null;
};

export type TxAttachment = {
  id: number;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
};

export type Transaction = {
  id: number;
  transaction_date: string;
  description: string | null;
  amount: number | string;
  currency: string;
  direction: TxDirection;
  status: TxStatus;
  account_name: string;
  category_id?: number | null;
  category_name: string | null;
  counterparty_id?: number | null;
  counterparty_name: string | null;
  notes: string | null;
  tags: TxTag[];
  splits: TxSplit[];
  attachments: TxAttachment[];
};

// --- Inversiones ---
export type Investment = {
  id: number;
  symbol: string;
  name: string;
  asset_type: string;
  quantity: number | string;
  avg_cost: number | string;
  currency: string;
  invested_amount: number | string;
  is_active: boolean;
};

// --- Copilot ---
export type CopilotSession = {
  id: string;
  title: string;
  message_count: number;
};

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type CopilotModelsConfig = {
  provider: string;
  configured: boolean;
  models: string[];
  defaultModel: string;
};

// --- Reportes ---
export type CashflowReportItem = {
  period: string;
  inflow: number;
  outflow: number;
  net: number;
};

export type CategoryBreakdownItem = {
  categoryId: number | null;
  categoryName: string;
  totalAmount: number;
  txCount: number;
};

// --- Planificación: presupuestos ---
export type BudgetLine = {
  id: number;
  category_id: number;
  category_name: string;
  limit_amount: number;
  actual_amount: number;
  remaining_amount: number;
};

export type Budget = {
  id: number;
  name: string;
  period: "MONTHLY" | "YEARLY";
  currency: string;
  start_date: string;
  end_date: string;
  lines: BudgetLine[];
  fundingAccounts: Array<{
    accountId: number;
    accountName: string;
    currency: string;
    balanceCurrent: number;
  }>;
  allocated_amount: number;
  actual_amount: number;
  remaining_budget_amount: number;
  funding_balance: number;
  funding_remaining_amount: number;
  funding_shortfall_amount: number;
  deficit_summary: {
    status: BudgetStatus;
    deficitAmount: number;
    incidentCount: number;
    latestEventType: string | null;
    lastCauseCode: string | null;
    lastCauseSummary: string | null;
    lastDetectedAt: string | null;
  };
};

export type BudgetTransactionContext = {
  budgetId: number;
  budgetName: string;
  categoryNames: string[];
};

export type Commitment = {
  id: number;
  name: string;
  cadence: "WEEKLY" | "MONTHLY" | "YEARLY";
  next_run_at: string;
  is_active: boolean;
  payload: {
    amount?: number;
    currency?: string;
    direction?: TxDirection;
    dayOfMonth?: number;
    notes?: string;
  };
};

export type ProjectionScenario = {
  id: string;
  scenario_type: "DEBT_PAYOFF" | "CASHFLOW" | "INVESTMENT";
  title: string;
  assumptions: Record<string, unknown>;
  result: {
    openingBalance?: number;
    horizonMonths?: number;
    finalClosingBalance?: number;
    minClosingBalance?: number;
    months?: Array<{
      month: string;
      income: number;
      outflow: number;
      savings: number;
      investing: number;
      net: number;
      closingBalance: number;
    }>;
  };
  created_at: string;
};

export type MonthlyFinanceSummary = {
  month: string;
  totalBalance: number;
  deficitEntryCount: number;
  totalIncidentCount: number;
  maxDeficitAmount: number;
  totalRecordedDeficitAmount: number;
  topProblemBudgets: Array<{
    budgetId: number;
    budgetName: string;
    incidents: number;
    maxDeficitAmount: number;
  }>;
  frequentCauses: Array<{
    causeCode: string;
    count: number;
  }>;
};

export type BudgetDeficitEvent = {
  id: number;
  budget_id: number;
  budget_line_id: number | null;
  budget_name: string;
  event_type: BudgetDeficitEventType;
  detected_at: string;
  period_month: string;
  deficit_amount: number;
  funding_shortfall_amount: number;
  budget_remaining_amount: number;
  funding_remaining_amount: number;
  cause_code: string;
  cause_summary: string | null;
  resolved_at: string | null;
};

// --- Drafts de formularios ---
export type SplitDraft = {
  description: string;
  amount: string;
  categoryId: string;
  counterpartyId: string;
};

export type AttachmentDraft = {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: string;
};

// --- Constantes de navegación ---
export const TABS: TabKey[] = [
  "dashboard",
  "accounts",
  "transactions",
  "reports",
  "investments",
  "planning",
  "copilot",
  "settings",
];

export const MOBILE_TABS: TabKey[] = [
  "dashboard",
  "accounts",
  "transactions",
  "reports",
  "investments",
  "planning",
  "settings",
];

export const NONE_VALUE = "__NONE__";

export const DASHBOARD_BUDGET_PAGE_SIZE = 3;
