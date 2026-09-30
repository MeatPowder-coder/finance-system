"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChatInterfaceFinance from "@/components/ChatInterfaceFinance";
import { AuthCallbackScreen, AuthLoginScreen } from "@/components/AuthLogin";
import { ThemeSelector } from "@/components/ThemeSelector";
import PlanningSegmentedNav from "@/components/PlanningSegmentedNav";
import { AccountsView, type AccountFormState } from "@/src/views/AccountsView";
import {
  TransactionsView,
  type TxFormState as TransactionsTxFormState,
  type CategoryFormState,
  type CounterpartyFormState,
  type TagFormState,
} from "@/src/views/TransactionsView";
import { ReportsView } from "@/src/views/ReportsView";
import { InvestmentsView } from "@/src/views/InvestmentsView";
import { PlanningView } from "@/src/views/PlanningView";
import { DashboardView } from "@/src/views/DashboardView";
import { SettingsView } from "@/src/views/SettingsView";
import { buildFinanceHeaders, requestFinanceApi, resolveFinanceApiBaseUrl } from "@/lib/runtime-config";
import { clearAuthSession } from "@/lib/auth";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bot,
  Briefcase,
  CalendarDays,
  Clock3,
  CreditCard,
  Filter,
  LayoutDashboard,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";

import type {
  TabKey,
  PlanningSectionKey,
  AccountType,
  TxDirection,
  TxStatus,
  CategoryDirection,
  Summary,
  Account,
  Category,
  Counterparty,
  TxTag,
  TxSplit,
  TxAttachment,
  Transaction,
  Investment,
  CopilotSession,
  CopilotMessage,
  CopilotModelsConfig,
  CashflowReportItem,
  CategoryBreakdownItem,
  BudgetLine,
  Budget,
  Commitment,
  ProjectionScenario,
  BudgetTransactionContext,
  MonthlyFinanceSummary,
  BudgetDeficitEvent,
  BudgetStatus,
  SplitDraft,
  AttachmentDraft,
} from "@/lib/types";
import {
  TABS,
  NONE_VALUE,
  DASHBOARD_BUDGET_PAGE_SIZE,
} from "@/lib/types";
import {
  toNumber,
  formatMoney,
  formatDate,
  formatMonthLabel,
  getAccountTypeLabel,
  getDirectionLabel,
  getDirectionHint,
  getCadenceLabel,
  getCounterpartyTypeLabel,
  getCategoryDirectionLabel,
  getBudgetStatusLabel,
  getBudgetStatusTone,
  getBudgetStatusAccent,
  getDeficitEventLabel,
  getStatusTone,
  downloadCsv,
} from "@/lib/format";

const API_BASE = resolveFinanceApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");
const PLANNING_SECTIONS: Array<{
  key: PlanningSectionKey;
  label: string;
  caption: string;
  icon: typeof Wallet;
}> = [
  { key: "budgets", label: "Presupuestos", caption: "Control del gasto", icon: Wallet },
  { key: "deficits", label: "Deficits", caption: "Alertas e historial", icon: AlertTriangle },
  { key: "commitments", label: "Compromisos", caption: "Pagos recurrentes", icon: Clock3 },
  { key: "projections", label: "Proyecciones", caption: "Escenarios futuros", icon: BarChart3 },
];

const TAB_META: Record<
  TabKey,
  {
    label: string;
    caption: string;
    icon: typeof LayoutDashboard;
  }
> = {
  dashboard: { label: "Dashboard", caption: "Vision general", icon: LayoutDashboard },
  accounts: { label: "Cuentas", caption: "Bancos y creditos", icon: Wallet },
  transactions: { label: "Transacciones", caption: "Movimiento diario", icon: CreditCard },
  reports: { label: "Reportes", caption: "Cashflow y categorias", icon: BarChart3 },
  investments: { label: "Inversiones", caption: "Portafolio y posicion", icon: PieChart },
  planning: { label: "Planificacion", caption: "Presupuesto y proyecciones", icon: CalendarDays },
  copilot: { label: "Copilot", caption: "Asistente financiero", icon: Bot },
  settings: { label: "Configuracion", caption: "Perfil, temas y accesos", icon: Settings },
};

async function apiGet<T>(path: string) {
  try {
    const res = await requestFinanceApi(`${API_BASE}${path}`, { headers: buildFinanceHeaders(), cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json.data as T;
  } catch (error) {
    throw withApiEndpoint(path, error);
  }
}

async function apiPost<T>(path: string, body: unknown) {
  try {
    const res = await requestFinanceApi(`${API_BASE}${path}`, {
      method: "POST",
      headers: buildFinanceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json.data as T;
  } catch (error) {
    throw withApiEndpoint(path, error);
  }
}

async function apiPatch<T>(path: string, body: unknown) {
  try {
    const res = await requestFinanceApi(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: buildFinanceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json.data as T;
  } catch (error) {
    throw withApiEndpoint(path, error);
  }
}

function withApiEndpoint(path: string, error: unknown) {
  const detail = error instanceof Error ? error.message : "Error desconocido";
  return new Error(detail.startsWith(`${path} — `) ? detail : `${path} — ${detail}`);
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as TabKey) || "dashboard";
  const planningSection = (searchParams.get("planningSection") as PlanningSectionKey) || "budgets";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [tags, setTags] = useState<TxTag[]>([]);

  const [txSearch, setTxSearch] = useState("");
  const [txDirection, setTxDirection] = useState<"ALL" | TxDirection>("ALL");
  const [txStatus, setTxStatus] = useState<"ALL" | TxStatus>("ALL");
  const [txCategoryFilter, setTxCategoryFilter] = useState("ALL");
  const [txCounterpartyFilter, setTxCounterpartyFilter] = useState("ALL");
  const [txTagFilter, setTxTagFilter] = useState("ALL");

  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    currency: "COP",
    accountType: "CHECKING" as AccountType,
    balanceCurrent: "0",
  });

  const [txForm, setTxForm] = useState({
    transactionDate: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    currency: "COP",
    direction: "OUTFLOW" as TxDirection,
    status: "POSTED" as TxStatus,
    accountId: "",
    categoryId: "",
    counterpartyId: "",
    notes: "",
    tagIds: [] as string[],
  });

  const [useSplits, setUseSplits] = useState(false);
  const [splitDrafts, setSplitDrafts] = useState<SplitDraft[]>([
    { description: "", amount: "", categoryId: "", counterpartyId: "" },
  ]);

  const [useAttachments, setUseAttachments] = useState(false);
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([
    { fileName: "", fileUrl: "", mimeType: "", fileSize: "" },
  ]);

  const [categoryForm, setCategoryForm] = useState({
    code: "",
    name: "",
    direction: "BOTH" as CategoryDirection,
  });
  const [counterpartyForm, setCounterpartyForm] = useState({
    name: "",
    type: "OTHER" as Counterparty["type"],
  });
  const [tagForm, setTagForm] = useState({
    name: "",
    color: "",
  });

  const [sessions, setSessions] = useState<CopilotSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotModels, setCopilotModels] = useState<CopilotModelsConfig | null>(null);
  const [copilotModel, setCopilotModel] = useState("");
  const [cashflowReport, setCashflowReport] = useState<CashflowReportItem[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetDeficitEvents, setBudgetDeficitEvents] = useState<BudgetDeficitEvent[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [projectionScenarios, setProjectionScenarios] = useState<ProjectionScenario[]>([]);
  const [monthlyFinanceSummary, setMonthlyFinanceSummary] = useState<MonthlyFinanceSummary | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetDialogMode, setBudgetDialogMode] = useState<"create" | "edit">("create");
  const [budgetEditingBudgetId, setBudgetEditingBudgetId] = useState<number | null>(null);
  const [budgetCategoryComposerOpen, setBudgetCategoryComposerOpen] = useState(false);
  const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
  const [projectionDialogOpen, setProjectionDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [budgetTxContext, setBudgetTxContext] = useState<BudgetTransactionContext | null>(null);
  const [reportRange, setReportRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [planningMonth, setPlanningMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dashboardBudgetStart, setDashboardBudgetStart] = useState(0);
  const [budgetForm, setBudgetForm] = useState({
    name: "",
    categoryId: "",
    limitAmount: "",
  });
  const [commitmentForm, setCommitmentForm] = useState({
    name: "",
    amount: "",
    cadence: "MONTHLY" as Commitment["cadence"],
    dayOfMonth: "1",
  });
  const [projectionForm, setProjectionForm] = useState({
    horizonMonths: "6",
    monthlySavingsGoal: "0",
    monthlyInvestmentGoal: "0",
  });

  async function refreshData() {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      apiGet<Summary>("/v1/summary"),
      apiGet<Account[]>("/v1/accounts"),
      apiGet<Transaction[]>("/v1/transactions?limit=250"),
      apiGet<Investment[]>("/v1/investments"),
      apiGet<Category[]>("/v1/categories"),
      apiGet<Counterparty[]>("/v1/counterparties"),
      apiGet<TxTag[]>("/v1/tags"),
    ]);
    const rejected = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
    const authFailure = rejected.find((reason) => /autenticaci[oó]n requerida|unauthorized/i.test(reason instanceof Error ? reason.message : String(reason)));
    if (authFailure) {
      const rawMessage = authFailure instanceof Error ? authFailure.message : String(authFailure);
      if (/autenticaci[oó]n requerida|unauthorized/i.test(rawMessage)) {
        clearAuthSession();
        router.replace(`/?auth=login&returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
      setLoading(false);
      return;
    }

    if (results[0].status === "fulfilled") setSummary(results[0].value);
    if (results[1].status === "fulfilled") setAccounts(results[1].value);
    if (results[2].status === "fulfilled") setTransactions(results[2].value);
    if (results[3].status === "fulfilled") setInvestments(results[3].value);
    if (results[4].status === "fulfilled") setCategories(results[4].value);
    if (results[5].status === "fulfilled") setCounterparties(results[5].value);
    if (results[6].status === "fulfilled") setTags(results[6].value);

    if (rejected.length) {
      const endpoints = rejected.map((reason) => reason instanceof Error ? reason.message.split(" — ")[0] : "un servicio de FinanceSystem");
      setError(`Algunos datos no respondieron (${endpoints.join(", ")}). Conservamos visibles las secciones que sí cargaron; reintenta para actualizar.`);
    }
    setLoading(false);
  }

  async function refreshSessions() {
    const list = await apiGet<CopilotSession[]>("/v1/copilot/sessions");
    setSessions(list);
    if (!activeSessionId && list[0]) setActiveSessionId(list[0].id);
  }

  async function refreshMessages(sessionId: string) {
    if (!sessionId) return;
    const list = await apiGet<CopilotMessage[]>(`/v1/copilot/sessions/${sessionId}/messages`);
    setMessages(list);
  }

  async function refreshCopilotModels() {
    const cfg = await apiGet<CopilotModelsConfig>("/v1/copilot/models");
    setCopilotModels(cfg);
    if (!copilotModel) {
      setCopilotModel(cfg.defaultModel);
    }
  }

  async function refreshReports() {
    setReportsLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (reportRange.from) qs.set("from", reportRange.from);
    if (reportRange.to) qs.set("to", reportRange.to);
    const query = qs.toString();
    const [cashflowResult, breakdownResult] = await Promise.allSettled([
      apiGet<CashflowReportItem[]>(`/v1/reports/cashflow${query ? `?${query}` : ""}`),
      apiGet<CategoryBreakdownItem[]>(`/v1/reports/category-breakdown${query ? `?${query}` : ""}`),
    ]);
    if (cashflowResult.status === "fulfilled") setCashflowReport(cashflowResult.value);
    if (breakdownResult.status === "fulfilled") setCategoryBreakdown(breakdownResult.value);
    const failedEndpoints = [cashflowResult, breakdownResult]
      .flatMap((result) => result.status === "rejected" ? [result.reason] : [])
      .map((reason) => reason instanceof Error ? reason.message.split(" — ")[0] : "un reporte");
    if (failedEndpoints.length) setError(`No se pudieron actualizar ${failedEndpoints.join(" y ")}. Los demás datos siguen disponibles.`);
    setReportsLoading(false);
  }

  async function refreshPlanning() {
    setPlanningLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      apiGet<Budget[]>(`/v1/budgets?month=${planningMonth}`),
      apiGet<BudgetDeficitEvent[]>(`/v1/budget-deficits?month=${planningMonth}`),
      apiGet<Commitment[]>(`/v1/commitments?month=${planningMonth}`),
      apiGet<ProjectionScenario[]>("/v1/projections/scenarios"),
      apiGet<MonthlyFinanceSummary>(`/v1/reports/monthly-finance-summary?month=${planningMonth}`),
    ]);
    if (results[0].status === "fulfilled") setBudgets(results[0].value);
    if (results[1].status === "fulfilled") setBudgetDeficitEvents(results[1].value);
    if (results[2].status === "fulfilled") setCommitments(results[2].value);
    if (results[3].status === "fulfilled") setProjectionScenarios(results[3].value);
    if (results[4].status === "fulfilled") setMonthlyFinanceSummary(results[4].value);
    const failedEndpoints = results
      .flatMap((result) => result.status === "rejected" ? [result.reason] : [])
      .map((reason) => reason instanceof Error ? reason.message.split(" — ")[0] : "un servicio de planificación");
    if (failedEndpoints.length) setError(`No se pudieron actualizar ${failedEndpoints.join(", ")}. Las demás secciones siguen disponibles.`);
    setPlanningLoading(false);
  }

  function resetBudgetDialogState() {
    setBudgetDialogMode("create");
    setBudgetEditingBudgetId(null);
    setBudgetCategoryComposerOpen(false);
    setBudgetForm({ name: "", categoryId: "", limitAmount: "" });
  }

  function openCreateBudgetDialog() {
    resetBudgetDialogState();
    setBudgetDialogOpen(true);
  }

  function openEditBudgetDialog(budgetId: number) {
    const budget = budgets.find((item) => item.id === budgetId);
    if (!budget) return;

    setBudgetDialogMode("edit");
    setBudgetEditingBudgetId(budget.id);
    setBudgetCategoryComposerOpen(false);
    setBudgetForm({
      name: budget.name,
      categoryId: String(budget.lines[0]?.category_id || ""),
      limitAmount: String(budget.lines[0]?.limit_amount || budget.allocated_amount || 0),
    });
    setBudgetDialogOpen(true);
  }

  async function saveBudget() {
    if (!budgetForm.name.trim() || !budgetForm.categoryId || Number(budgetForm.limitAmount) <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const startDate = `${planningMonth}-01`;
      const d = new Date(`${planningMonth}-01T00:00:00Z`);
      const endDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const payload = {
        name: budgetForm.name.trim(),
        period: "MONTHLY" as const,
        currency: "COP",
        startDate,
        endDate,
        lines: [{ categoryId: Number(budgetForm.categoryId), limitAmount: Number(budgetForm.limitAmount) }],
      };

      if (budgetDialogMode === "edit" && budgetEditingBudgetId) {
        await apiPatch(`/v1/budgets/${budgetEditingBudgetId}`, payload);
      } else {
        await apiPost("/v1/budgets", payload);
      }

      resetBudgetDialogState();
      setBudgetDialogOpen(false);
      await refreshPlanning();
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : budgetDialogMode === "edit"
          ? "No se pudo actualizar presupuesto."
          : "No se pudo crear presupuesto.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function createCommitment() {
    if (!commitmentForm.name.trim() || Number(commitmentForm.amount) <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/v1/commitments", {
        name: commitmentForm.name.trim(),
        amount: Number(commitmentForm.amount),
        cadence: commitmentForm.cadence,
        dayOfMonth: Number(commitmentForm.dayOfMonth || "1"),
        direction: "OUTFLOW",
      });
      setCommitmentForm({ name: "", amount: "", cadence: "MONTHLY", dayOfMonth: "1" });
      setCommitmentDialogOpen(false);
      await refreshPlanning();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear compromiso.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function runProjection() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/v1/projections/run", {
        horizonMonths: Number(projectionForm.horizonMonths || "6"),
        monthlySavingsGoal: Number(projectionForm.monthlySavingsGoal || "0"),
        monthlyInvestmentGoal: Number(projectionForm.monthlyInvestmentGoal || "0"),
        includeCommitments: true,
      });
      setProjectionDialogOpen(false);
      await refreshPlanning();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo ejecutar proyeccion.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    if (tab === "copilot") {
      void refreshSessions();
      void refreshCopilotModels();
    }
  }, [tab]);

  useEffect(() => {
    if (activeSessionId) {
      void refreshMessages(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (tab === "reports") {
      void refreshReports();
    }
  }, [tab]);

  useEffect(() => {
    if (tab === "planning" || tab === "dashboard") {
      void refreshPlanning();
    }
  }, [tab, planningMonth]);

  useEffect(() => {
    if (tab !== "dashboard") return;

    const refreshLive = () => {
      void refreshData();
      void refreshPlanning();
    };

    const intervalId = window.setInterval(refreshLive, 12000);
    const onFocus = () => refreshLive();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [tab, planningMonth]);

  const filteredTx = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      const textTags = tx.tags.map((item) => item.name.toLowerCase()).join(" ");
      const matchSearch =
        !q ||
        (tx.description || "").toLowerCase().includes(q) ||
        tx.account_name.toLowerCase().includes(q) ||
        (tx.category_name || "").toLowerCase().includes(q) ||
        (tx.counterparty_name || "").toLowerCase().includes(q) ||
        textTags.includes(q);
      const matchDirection = txDirection === "ALL" || tx.direction === txDirection;
      const matchStatus = txStatus === "ALL" || tx.status === txStatus;
      const matchCategory = txCategoryFilter === "ALL" || String(tx.category_id || "") === txCategoryFilter;
      const matchCounterparty = txCounterpartyFilter === "ALL" || String(tx.counterparty_id || "") === txCounterpartyFilter;
      const matchTag = txTagFilter === "ALL" || tx.tags.some((tag) => String(tag.id) === txTagFilter);
      return matchSearch && matchDirection && matchStatus && matchCategory && matchCounterparty && matchTag;
    });
  }, [transactions, txSearch, txDirection, txStatus, txCategoryFilter, txCounterpartyFilter, txTagFilter]);

  const reportTotals = useMemo(() => {
    return cashflowReport.reduce(
      (acc, row) => {
        acc.inflow += Number(row.inflow || 0);
        acc.outflow += Number(row.outflow || 0);
        acc.net += Number(row.net || 0);
        return acc;
      },
      { inflow: 0, outflow: 0, net: 0 }
    );
  }, [cashflowReport]);

  const accountTotals = useMemo(() => {
    return accounts.reduce(
      (acc, account) => {
        const amount = toNumber(account.balance_current);
        if (amount >= 0) acc.positive += amount;
        else acc.negative += Math.abs(amount);
        if (account.is_active) acc.active += 1;
        else acc.inactive += 1;
        return acc;
      },
      { positive: 0, negative: 0, active: 0, inactive: 0 }
    );
  }, [accounts]);

  const txMetrics = useMemo(() => {
    return filteredTx.reduce(
      (acc, tx) => {
        const amount = toNumber(tx.amount);
        if (tx.direction === "INFLOW") {
          acc.inflowCount += 1;
          acc.inflowTotal += amount;
        } else {
          acc.outflowCount += 1;
          acc.outflowTotal += amount;
        }
        if (tx.status === "PENDING") acc.pending += 1;
        if (tx.splits.length > 0) acc.withSplits += 1;
        if (tx.attachments.length > 0) acc.withAttachments += 1;
        return acc;
      },
      {
        inflowCount: 0,
        inflowTotal: 0,
        outflowCount: 0,
        outflowTotal: 0,
        pending: 0,
        withSplits: 0,
        withAttachments: 0,
      }
    );
  }, [filteredTx]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
      .slice(0, 10);
  }, [transactions]);

  const topAccounts = useMemo(() => {
    return [...accounts]
      .sort((a, b) => Math.abs(toNumber(b.balance_current)) - Math.abs(toNumber(a.balance_current)))
      .slice(0, 6);
  }, [accounts]);

  const dashboardBudgets = useMemo(() => {
    const rank = (status: Budget["deficit_summary"]["status"]) => {
      switch (status) {
        case "over_budget":
          return 0;
        case "underfunded":
          return 1;
        case "warning":
          return 2;
        default:
          return 3;
      }
    };

    return [...budgets].sort((a, b) => {
      const statusDiff = rank(a.deficit_summary.status) - rank(b.deficit_summary.status);
      if (statusDiff !== 0) return statusDiff;

      const aAllocated = Math.max(1, toNumber(a.allocated_amount));
      const bAllocated = Math.max(1, toNumber(b.allocated_amount));
      const aRatio = toNumber(a.actual_amount) / aAllocated;
      const bRatio = toNumber(b.actual_amount) / bAllocated;
      if (aRatio !== bRatio) return bRatio - aRatio;

      return toNumber(b.actual_amount) - toNumber(a.actual_amount);
    });
  }, [budgets]);

  const dashboardBudgetWindow = useMemo(() => {
    if (dashboardBudgets.length <= DASHBOARD_BUDGET_PAGE_SIZE) {
      return dashboardBudgets;
    }
    const maxStart = Math.max(0, dashboardBudgets.length - DASHBOARD_BUDGET_PAGE_SIZE);
    const start = Math.min(dashboardBudgetStart, maxStart);
    return dashboardBudgets.slice(start, start + DASHBOARD_BUDGET_PAGE_SIZE);
  }, [dashboardBudgetStart, dashboardBudgets]);

  const dashboardMonthOptions = useMemo(() => {
    const base = new Date(`${planningMonth}-01T00:00:00`);
    if (Number.isNaN(base.getTime())) return [planningMonth];
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(base);
      date.setMonth(base.getMonth() - 5 + index);
      return date.toISOString().slice(0, 7);
    });
  }, [planningMonth]);
  const dashboardBudgetMaxStart = Math.max(0, dashboardBudgets.length - DASHBOARD_BUDGET_PAGE_SIZE);
  const dashboardBudgetCanPrev = dashboardBudgetStart > 0;
  const dashboardBudgetCanNext = dashboardBudgetStart < dashboardBudgetMaxStart;

  useEffect(() => {
    setDashboardBudgetStart((prev) => Math.min(prev, dashboardBudgetMaxStart));
  }, [dashboardBudgetMaxStart]);

  const upcomingCommitments = useMemo(() => {
    return [...commitments]
      .filter((item) => item.is_active)
      .sort((a, b) => new Date(a.next_run_at).getTime() - new Date(b.next_run_at).getTime())
      .slice(0, 6);
  }, [commitments]);

  const maxCategoryTotal = useMemo(() => {
    return Math.max(...categoryBreakdown.map((row) => Math.abs(Number(row.totalAmount || 0))), 1);
  }, [categoryBreakdown]);

  function goTab(nextTab: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }

  function goPlanningSection(nextSection: PlanningSectionKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "planning");
    params.set("planningSection", nextSection);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }

  const monthNet = (summary?.monthInflow || 0) - (summary?.monthOutflow || 0);
  const positiveMonth = monthNet >= 0;
  const latestTransaction = recentTransactions[0];
  const nextCommitment = upcomingCommitments[0];
  const monthCoach = positiveMonth
    ? {
        badge: "Mes respirando",
        title: "Vas con margen para decidir.",
        amount: formatMoney(monthNet, "COP"),
        caption: "disponible despues de ingresos y egresos",
        detail: "Buen momento para mover una parte a ahorro, inversion o dejarla como colchon.",
      }
    : {
        badge: "Atencion suave",
        title: "Hay que equilibrar el mes.",
        amount: formatMoney(Math.abs(monthNet), "COP"),
        caption: "por recuperar para cerrar en cero",
        detail: "Empieza por revisar gastos recientes y los presupuestos con menos disponible.",
      };
  const planningSummaryCards = [
    { label: "Entradas a deficit", value: String(monthlyFinanceSummary?.deficitEntryCount || 0), tone: "text-zinc-100" },
    { label: "Maximo deficit", value: formatMoney(monthlyFinanceSummary?.maxDeficitAmount || 0, "COP"), tone: "text-rose-100" },
    { label: "Deficit acumulado", value: formatMoney(monthlyFinanceSummary?.totalRecordedDeficitAmount || 0, "COP"), tone: "text-amber-100" },
    { label: "Saldo activo", value: formatMoney(monthlyFinanceSummary?.totalBalance || 0, "COP"), tone: "text-cyan-100" },
  ] as const;
  const dashboardActions = [
    { key: "tx", label: "Nueva transaccion", caption: "Movimiento diario", icon: CreditCard, onClick: () => { setBudgetTxContext(null); setTransactionDialogOpen(true); }, tone: "primary" as const },
    { key: "account", label: "Nueva cuenta", caption: "Alta breve", icon: Wallet, onClick: () => setAccountDialogOpen(true) },
    { key: "budget", label: "Nuevo presupuesto", caption: "Control del mes", icon: CalendarDays, onClick: () => openCreateBudgetDialog() },
    { key: "commitment", label: "Nuevo compromiso", caption: "Pago recurrente", icon: Clock3, onClick: () => setCommitmentDialogOpen(true) },
    { key: "projection", label: "Nueva proyeccion", caption: "Escenario futuro", icon: BarChart3, onClick: () => setProjectionDialogOpen(true) },
  ];

  function toggleTag(tagId: string) {
    setTxForm((prev) => {
      const exists = prev.tagIds.includes(tagId);
      return {
        ...prev,
        tagIds: exists ? prev.tagIds.filter((item) => item !== tagId) : [...prev.tagIds, tagId],
      };
    });
  }

  function startBudgetExpense(budget: Budget) {
    const firstCategoryId = budget.lines[0]?.category_id ? String(budget.lines[0].category_id) : "";
    setBudgetTxContext({
      budgetId: budget.id,
      budgetName: budget.name,
      categoryNames: budget.lines.map((line) => line.category_name).filter(Boolean),
    });
    setTxForm((prev) => ({
      ...prev,
      direction: "OUTFLOW",
      categoryId: firstCategoryId || prev.categoryId,
    }));
    setTransactionDialogOpen(true);
  }

  async function createAccount() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/v1/accounts", {
        code: accountForm.code.trim(),
        name: accountForm.name.trim(),
        currency: accountForm.currency.toUpperCase(),
        accountType: accountForm.accountType,
        balanceCurrent: Number(accountForm.balanceCurrent || "0"),
      });
      setAccountForm({ code: "", name: "", currency: "COP", accountType: "CHECKING", balanceCurrent: "0" });
      setAccountDialogOpen(false);
      await refreshData();
      await refreshPlanning();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear cuenta.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    setSaving(true);
    setError(null);
    try {
      const created = await apiPost<Category>("/v1/categories", {
        code: categoryForm.code.trim().toUpperCase(),
        name: categoryForm.name.trim(),
        direction: categoryForm.direction,
      });
      setCategoryForm({ code: "", name: "", direction: "BOTH" });
      await refreshData();
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear categoria.";
      setError(message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createBudgetCategory() {
    const created = await createCategory();
    if (!created) return;

    setBudgetForm((prev) => ({ ...prev, categoryId: String(created.id) }));
    setBudgetCategoryComposerOpen(false);
  }

  async function createCounterparty() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/v1/counterparties", {
        name: counterpartyForm.name.trim(),
        type: counterpartyForm.type,
      });
      setCounterpartyForm({ name: "", type: "OTHER" });
      await refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear contraparte.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function createTag() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/v1/tags", {
        name: tagForm.name.trim(),
        color: tagForm.color.trim() || undefined,
      });
      setTagForm({ name: "", color: "" });
      await refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear tag.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function createTransaction() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/v1/transactions", {
        transactionDate: txForm.transactionDate,
        description: txForm.description || undefined,
        amount: Number(txForm.amount),
        currency: txForm.currency.toUpperCase(),
        direction: txForm.direction,
        status: txForm.status,
        accountId: Number(txForm.accountId),
        categoryId: txForm.categoryId ? Number(txForm.categoryId) : undefined,
        counterpartyId: txForm.counterpartyId ? Number(txForm.counterpartyId) : undefined,
        notes: txForm.notes || undefined,
        tags: txForm.tagIds.map((id) => Number(id)),
        splits: useSplits
          ? splitDrafts
              .filter((split) => Number(split.amount) > 0)
              .map((split) => ({
                description: split.description || undefined,
                amount: Number(split.amount),
                categoryId: split.categoryId ? Number(split.categoryId) : undefined,
                counterpartyId: split.counterpartyId ? Number(split.counterpartyId) : undefined,
              }))
          : undefined,
        attachments: useAttachments
          ? attachmentDrafts
              .filter((item) => item.fileName.trim() && item.fileUrl.trim())
              .map((item) => ({
                fileName: item.fileName.trim(),
                fileUrl: item.fileUrl.trim(),
                mimeType: item.mimeType.trim() || undefined,
                fileSize: item.fileSize ? Number(item.fileSize) : undefined,
              }))
          : undefined,
      });

      setTxForm({
        transactionDate: new Date().toISOString().slice(0, 10),
        description: "",
        amount: "",
        currency: "COP",
        direction: "OUTFLOW",
        status: "POSTED",
        accountId: "",
        categoryId: "",
        counterpartyId: "",
        notes: "",
        tagIds: [],
      });
      setUseSplits(false);
      setSplitDrafts([{ description: "", amount: "", categoryId: "", counterpartyId: "" }]);
      setUseAttachments(false);
      setAttachmentDrafts([{ fileName: "", fileUrl: "", mimeType: "", fileSize: "" }]);
      setBudgetTxContext(null);
      setTransactionDialogOpen(false);
      await refreshData();
      await refreshPlanning();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo crear transaccion.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function sendCopilot() {
    const input = copilotInput.trim();
    if (!input) return;
    setCopilotBusy(true);
    setError(null);
    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const created = await apiPost<CopilotSession>("/v1/copilot/sessions", { mode: "ACCOUNTANT" });
        sessionId = created.id;
        setActiveSessionId(sessionId);
      }
      const response = await apiPost<{ assistantMessage: CopilotMessage }>("/v1/copilot/chat", {
        sessionId,
        message: input,
        model: copilotModel || undefined,
      });
      setMessages((prev) => [
        ...prev,
        { id: `tmp-${Date.now()}`, role: "user", content: input, created_at: new Date().toISOString() },
        response.assistantMessage,
      ]);
      setCopilotInput("");
      await refreshSessions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo enviar mensaje.";
      setError(message);
    } finally {
      setCopilotBusy(false);
    }
  }

  return (
    <div className={tab === "copilot" ? "flex h-full min-h-0 flex-col overflow-hidden pt-12 md:pt-0" : "min-h-screen bg-transparent overflow-x-hidden pt-12 pb-6 md:pt-0"}>
      <main data-finance-tab={tab} className={tab === "copilot" ? "flex h-full min-h-0 w-full flex-col mx-auto px-4 py-3 md:px-6 md:py-4 lg:px-8" : "w-full xl:max-w-[1600px] mx-auto px-4 py-4 md:px-6 md:py-5 lg:px-8"}>
        <nav aria-label="Navegación principal" className="finance-primary-tabs section-enter mb-4">
          <div className="finance-nav-masthead">
            <div className="finance-nav-masthead-label"><span>Secciones</span><small>08 espacios · tus finanzas en movimiento</small></div>
            <div className="finance-header-palette"><ThemeSelector collapsed showSwatches /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
            {TABS.map((item, index) => {
              const tabConfig = TAB_META[item];
              const Icon = tabConfig.icon;
              const active = tab === item;
              return (
                <Button
                  key={item}
                  variant="outline"
                  onClick={() => goTab(item)}
                  aria-current={active ? "page" : undefined}
                  className={`finance-primary-tab-button ${active ? "is-active" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="finance-primary-tab-index">{String(index + 1).padStart(2, "0")}</span>
                    <Icon className="h-4 w-4 shrink-0" />
                    <div>
                      <div className="finance-primary-tab-label">{tabConfig.label}</div>
                      <div className="finance-primary-tab-caption">{tabConfig.caption}</div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </nav>
        {tab !== "copilot" && (
          <>
        <section className={`section-enter ui-shell-card mb-6 rounded-[32px] p-5 md:p-6 ${tab === "dashboard" ? "finance-dashboard-heading" : ""}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              {tab === "dashboard" && <div className="finance-editorial-brand"><strong>F/S</strong><span>Cuaderno financiero</span><small>Bogotá · {new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(new Date())} · Personal / COP</small></div>}
              <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-tight text-zinc-100">{tab === "dashboard" ? <>{positiveMonth ? "El mes va " : "El mes pide "}<em>{positiveMonth ? "a favor" : "pausa"}</em></> : TAB_META[tab]?.label || "Dashboard"}</h1>
              <p className="text-sm text-zinc-400">{tab === "dashboard" ? "Una lectura clara de tu dinero" : TAB_META[tab]?.caption}</p>
            </div>

            <div className="flex items-center gap-2">
                {tab !== "dashboard" && <Select value={planningMonth} onValueChange={setPlanningMonth}>
                  <SelectTrigger className="ui-control h-11 w-[170px] rounded-2xl px-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-zinc-400" />
                      <SelectValue placeholder={formatMonthLabel(planningMonth)} />
                    </div>
                  </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                  {dashboardMonthOptions.map((month) => (
                    <SelectItem key={month} value={month}>
                      {formatMonthLabel(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>}
              <Button
                variant="outline"
                onClick={() => void refreshData()}
                disabled={loading}
                className="ui-action h-11 rounded-2xl px-3"
                aria-label="Actualizar informacion"
                title="Actualizar"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="ui-action-primary h-11 w-11 rounded-full"
                    aria-label="Agregar elemento"
                    title="Agregar"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 border-zinc-800 bg-zinc-950 text-zinc-100">
                  <DropdownMenuLabel>Crear rapido</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem onSelect={() => { setBudgetTxContext(null); setTransactionDialogOpen(true); }}>
                    Nueva transaccion
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAccountDialogOpen(true)}>Nueva cuenta</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openCreateBudgetDialog()}>Nuevo presupuesto</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCommitmentDialogOpen(true)}>Nuevo compromiso</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setProjectionDialogOpen(true)}>Nueva proyeccion</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {tab !== "dashboard" && <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 finance-dashboard-metrics">
            <Card className="ui-kpi finance-dashboard-metric finance-dashboard-metric-balance rounded-[22px]">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-200">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Saldo consolidado</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-100">{formatMoney(summary?.totalBalance || 0, "COP")}</p>
                  <p className="mt-1 text-sm text-zinc-400">Patrimonio neto</p>
                </div>
              </CardContent>
            </Card>

            <Card className="ui-kpi finance-dashboard-metric finance-dashboard-metric-income rounded-[22px]">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-200">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Ingresos mes</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-100">{formatMoney(summary?.monthInflow || 0, "COP")}</p>
                  <p className="mt-1 text-sm text-zinc-400">{summary?.monthInflow ? "Entradas del periodo" : "Sin ingresos"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="ui-kpi finance-dashboard-metric finance-dashboard-metric-expense rounded-[22px]">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-200">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Egresos mes</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-100">{formatMoney(summary?.monthOutflow || 0, "COP")}</p>
                  <p className="mt-1 text-sm text-zinc-400">{transactions.length} transacciones</p>
                </div>
              </CardContent>
            </Card>

            <Card className="ui-kpi finance-dashboard-metric finance-dashboard-metric-net rounded-[22px]">
              <CardContent className="flex items-start gap-3 p-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${positiveMonth ? "bg-cyan-500/15 text-cyan-200" : "bg-amber-500/15 text-amber-200"}`}>
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Neto del mes</p>
                  <p className={`mt-1 text-2xl font-semibold ${positiveMonth ? "text-cyan-200" : "text-amber-200"}`}>{formatMoney(monthNet, "COP")}</p>
                  <p className="mt-1 text-sm text-zinc-400">{positiveMonth ? "Excedente mensual" : "Deficit mensual"}</p>
                </div>
              </CardContent>
            </Card>
          </div>}
        </section>

          </>
        )}

        {error && (
          <Card className={`section-enter mb-4 ${tab === "dashboard" ? "finance-dashboard-error" : "border-rose-400/40 bg-rose-500/10"}`} role="alert">
            <CardContent className={tab === "dashboard" ? "finance-dashboard-error-content" : "py-4 text-rose-100"}>{error}</CardContent>
          </Card>
        )}

        <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Nueva cuenta</DialogTitle>
              <DialogDescription>Alta rapida para sumar una cuenta operativa al sistema.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Codigo</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" value={accountForm.code} onChange={(e) => setAccountForm((p) => ({ ...p, code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" value={accountForm.currency} onChange={(e) => setAccountForm((p) => ({ ...p, currency: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={accountForm.accountType} onValueChange={(v) => setAccountForm((p) => ({ ...p, accountType: v as AccountType }))}>
                  <SelectTrigger className="border-white/10 bg-zinc-950/85">
                    <SelectValue placeholder="Selecciona tipo de cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "INVESTMENT", "LOAN", "OTHER"] as AccountType[]).map((item) => (
                      <SelectItem key={item} value={item}>
                        {getAccountTypeLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-2xl border border-dashed border-zinc-800/90 bg-zinc-950/60 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">Â¿No ves tu categoria?</p>
                      <p className="text-xs text-zinc-500">Creala aqui y quedara disponible para presupuestos y transacciones.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setBudgetCategoryComposerOpen((prev) => !prev)}
                      className="rounded-full border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                    >
                      {budgetCategoryComposerOpen ? "Cerrar" : "Abrir"}
                    </Button>
                  </div>
                  {budgetCategoryComposerOpen && (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Codigo</Label>
                          <Input
                            className="h-11 border-white/10 bg-zinc-950/85"
                            value={categoryForm.code}
                            onChange={(e) => setCategoryForm((p) => ({ ...p, code: e.target.value }))}
                            placeholder="Ej: HOGAR"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Nombre</Label>
                          <Input
                            className="h-11 border-white/10 bg-zinc-950/85"
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Ej: Servicios hogar"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Direccion</Label>
                        <Select value={categoryForm.direction} onValueChange={(v) => setCategoryForm((p) => ({ ...p, direction: v as CategoryDirection }))}>
                          <SelectTrigger className="border-white/10 bg-zinc-950/85">
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
                        onClick={() => void createBudgetCategory()}
                        disabled={saving}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                      >
                        Crear y usar categoria
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Saldo inicial</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" type="number" value={accountForm.balanceCurrent} onChange={(e) => setAccountForm((p) => ({ ...p, balanceCurrent: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => void createAccount()} disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">
                  Crear cuenta
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={transactionDialogOpen} onOpenChange={(open) => {
          setTransactionDialogOpen(open);
          if (!open) setBudgetTxContext(null);
        }}>
          <DialogContent className="sm:max-w-[680px]">
            <DialogHeader>
              <DialogTitle>Nueva transaccion</DialogTitle>
              <DialogDescription>Captura rapida desde la portada. Para splits y catalogos avanzados sigue disponible el tab de transacciones.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {budgetTxContext && (
                <div className="md:col-span-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
                  <p className="text-sm font-semibold text-cyan-100">Este gasto quedara vinculado a {budgetTxContext.budgetName}</p>
                  <p className="mt-1 text-xs text-cyan-100/75">
                    Para que cuente dentro del presupuesto, guarda la transaccion con una de estas categorias: {budgetTxContext.categoryNames.join(", ")}.
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" type="date" value={txForm.transactionDate} onChange={(e) => setTxForm((p) => ({ ...p, transactionDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cuenta</Label>
                <Select value={txForm.accountId} onValueChange={(v) => setTxForm((p) => ({ ...p, accountId: v }))}>
                  <SelectTrigger className="border-white/10 bg-zinc-950/85">
                    <SelectValue placeholder="Selecciona cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name} Â· {getAccountTypeLabel(item.account_type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Direccion</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["INFLOW", "OUTFLOW"] as TxDirection[]).map((direction) => {
                    const active = txForm.direction === direction;
                    const Icon = direction === "INFLOW" ? ArrowUpRight : ArrowDownLeft;
                    return (
                      <Button
                        key={direction}
                        type="button"
                        variant="outline"
                        onClick={() => setTxForm((p) => ({ ...p, direction }))}
                        aria-pressed={active}
                        className={`h-auto justify-start rounded-2xl border px-4 py-3 text-left transition-all ${
                          active
                            ? "border-cyan-400/40 bg-cyan-500/12 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
                            : "border-white/10 bg-zinc-950/80 text-zinc-200 hover:border-cyan-500/25 hover:bg-zinc-900/90"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-cyan-500/15 text-cyan-200" : "bg-zinc-900 text-zinc-500"}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{getDirectionLabel(direction)}</div>
                            <div className="text-[11px] text-zinc-500">{getDirectionHint(direction)}</div>
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Monto</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" type="number" value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Descripcion</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" value={txForm.description} onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={txForm.categoryId || NONE_VALUE} onValueChange={(v) => setTxForm((p) => ({ ...p, categoryId: v === NONE_VALUE ? "" : v }))}>
                  <SelectTrigger className="border-white/10 bg-zinc-950/85">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sin categoria</SelectItem>
                    {categories.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name} Â· {getCategoryDirectionLabel(item.direction)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contraparte</Label>
                <Select value={txForm.counterpartyId || NONE_VALUE} onValueChange={(v) => setTxForm((p) => ({ ...p, counterpartyId: v === NONE_VALUE ? "" : v }))}>
                  <SelectTrigger className="border-white/10 bg-zinc-950/85">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sin contraparte</SelectItem>
                    {counterparties.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name} Â· {getCounterpartyTypeLabel(item.type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => void createTransaction()} disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">
                  Guardar transaccion
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {tab !== "planning" && (
          <>
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
                  ? "Ajusta el nombre, la categoria o el tope del presupuesto seleccionado."
                  : "Define un limite mensual sobre una categoria real de tu base."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" value={budgetForm.name} onChange={(e) => setBudgetForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Presupuesto hogar" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={budgetForm.categoryId} onValueChange={(v) => setBudgetForm((p) => ({ ...p, categoryId: v }))}>
                  <SelectTrigger className="border-white/10 bg-zinc-950/85">
                    <SelectValue placeholder="Selecciona una categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name} Â· {getCategoryDirectionLabel(category.direction)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tope mensual (COP)</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" type="number" value={budgetForm.limitAmount} onChange={(e) => setBudgetForm((p) => ({ ...p, limitAmount: e.target.value }))} placeholder="0" />
              </div>
              <Button onClick={() => void saveBudget()} disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">
                {budgetDialogMode === "edit" ? "Actualizar presupuesto" : "Guardar presupuesto"}
              </Button>
            </div>
              </DialogContent>
            </Dialog>

        <Dialog open={commitmentDialogOpen} onOpenChange={setCommitmentDialogOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Crear compromiso recurrente</DialogTitle>
              <DialogDescription>Registra pagos fijos sin mezclar la portada con formularios largos.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" value={commitmentForm.name} onChange={(e) => setCommitmentForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Gimnasio" />
              </div>
              <div className="space-y-1.5">
                <Label>Monto (COP)</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" type="number" value={commitmentForm.amount} onChange={(e) => setCommitmentForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cadencia</Label>
                  <Select value={commitmentForm.cadence} onValueChange={(v) => setCommitmentForm((p) => ({ ...p, cadence: v as Commitment["cadence"] }))}>
                    <SelectTrigger className="border-white/10 bg-zinc-950/85">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">{getCadenceLabel("WEEKLY")}</SelectItem>
                      <SelectItem value="MONTHLY">{getCadenceLabel("MONTHLY")}</SelectItem>
                      <SelectItem value="YEARLY">{getCadenceLabel("YEARLY")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Dia del mes</Label>
                  <Input className="h-11 border-white/10 bg-zinc-950/85" type="number" min={1} max={31} value={commitmentForm.dayOfMonth} onChange={(e) => setCommitmentForm((p) => ({ ...p, dayOfMonth: e.target.value }))} />
                </div>
              </div>
              <Button onClick={() => void createCommitment()} disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">
                Guardar compromiso
              </Button>
                </div>
              </DialogContent>
            </Dialog>

        <Dialog open={projectionDialogOpen} onOpenChange={setProjectionDialogOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Crear proyeccion de flujo</DialogTitle>
              <DialogDescription>Simula ahorro e inversion futura sin salir del dashboard.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Horizonte (meses)</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" type="number" min={1} max={36} value={projectionForm.horizonMonths} onChange={(e) => setProjectionForm((p) => ({ ...p, horizonMonths: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Ahorro mensual meta (COP)</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" type="number" value={projectionForm.monthlySavingsGoal} onChange={(e) => setProjectionForm((p) => ({ ...p, monthlySavingsGoal: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Inversion mensual meta (COP)</Label>
                <Input className="h-11 border-white/10 bg-zinc-950/85" type="number" value={projectionForm.monthlyInvestmentGoal} onChange={(e) => setProjectionForm((p) => ({ ...p, monthlyInvestmentGoal: e.target.value }))} />
              </div>
              <Button onClick={() => void runProjection()} disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">
                Ejecutar proyeccion
              </Button>
            </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {tab === "dashboard" && summary && (
          <DashboardView
            monthCoach={monthCoach}
            monthFlow={{
              balance: formatMoney(summary?.totalBalance || 0, "COP"),
              income: formatMoney(summary?.monthInflow || 0, "COP"),
              expense: formatMoney(summary?.monthOutflow || 0, "COP"),
              spentPercent: Number(summary?.monthInflow || 0) > 0
                ? (Number(summary?.monthOutflow || 0) / Number(summary?.monthInflow || 0)) * 100
                : 0,
            }}
            positiveMonth={positiveMonth}
            dashboardActions={dashboardActions}
            dashboardBudgets={dashboardBudgets}
            dashboardBudgetWindow={dashboardBudgetWindow}
            dashboardBudgetStart={dashboardBudgetStart}
            setDashboardBudgetStart={setDashboardBudgetStart}
            dashboardBudgetMaxStart={dashboardBudgetMaxStart}
            dashboardBudgetCanPrev={dashboardBudgetCanPrev}
            dashboardBudgetCanNext={dashboardBudgetCanNext}
            startBudgetExpense={startBudgetExpense}
            openEditBudgetDialog={openEditBudgetDialog}
            upcomingCommitments={upcomingCommitments}
            nextCommitment={nextCommitment}
            onReviewExpenses={() => goTab("transactions")}
            onReviewPlanning={() => goTab("planning")}
            onReviewAccounts={() => goTab("accounts")}
            recentTransactions={recentTransactions}
            latestTransaction={latestTransaction}
            topAccounts={topAccounts}
            onReviewPayments={() => goPlanningSection("commitments")}
          />
        )}

        {tab === "dashboard" && !summary && !loading && error && (
          <section className="finance-dashboard-unavailable" role="status">
            <span>01 / ESPACIO FINANCIERO</span>
            <h2>Conecta tu espacio para ver los datos reales.</h2>
            <p>{error}</p>
            <Button type="button" variant="outline" onClick={() => void refreshData()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
            </Button>
          </section>
        )}

        {tab === "accounts" && (
          <AccountsView
            accounts={accounts}
            accountTotals={accountTotals}
            accountForm={accountForm}
            setAccountForm={setAccountForm}
            onCreateAccount={() => void createAccount()}
            saving={saving}
          />
        )}

        {tab === "transactions" && (
          <TransactionsView
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            counterparties={counterparties}
            tags={tags}
            filteredTx={filteredTx}
            txMetrics={txMetrics}
            txSearch={txSearch}
            setTxSearch={setTxSearch}
            txDirection={txDirection}
            setTxDirection={setTxDirection}
            txStatus={txStatus}
            setTxStatus={setTxStatus}
            txCategoryFilter={txCategoryFilter}
            setTxCategoryFilter={setTxCategoryFilter}
            txCounterpartyFilter={txCounterpartyFilter}
            setTxCounterpartyFilter={setTxCounterpartyFilter}
            txTagFilter={txTagFilter}
            setTxTagFilter={setTxTagFilter}
            txForm={txForm}
            setTxForm={setTxForm}
            toggleTag={toggleTag}
            useSplits={useSplits}
            setUseSplits={setUseSplits}
            splitDrafts={splitDrafts}
            setSplitDrafts={setSplitDrafts}
            useAttachments={useAttachments}
            setUseAttachments={setUseAttachments}
            attachmentDrafts={attachmentDrafts}
            setAttachmentDrafts={setAttachmentDrafts}
            onCreateTransaction={() => void createTransaction()}
            categoryForm={categoryForm}
            setCategoryForm={setCategoryForm}
            onCreateCategory={() => void createCategory()}
            counterpartyForm={counterpartyForm}
            setCounterpartyForm={setCounterpartyForm}
            onCreateCounterparty={() => void createCounterparty()}
            tagForm={tagForm}
            setTagForm={setTagForm}
            onCreateTag={() => void createTag()}
            saving={saving}
          />
        )}

        {tab === "reports" && (
          <ReportsView
            reportRange={reportRange}
            setReportRange={setReportRange}
            onRefresh={() => void refreshReports()}
            reportsLoading={reportsLoading}
            reportTotals={reportTotals}
            cashflowReport={cashflowReport}
            categoryBreakdown={categoryBreakdown}
          />
        )}

        {tab === "planning" && (
          <PlanningView
            planningSection={planningSection}
            goPlanningSection={goPlanningSection}
            planningSections={PLANNING_SECTIONS}
            planningMonth={planningMonth}
            setPlanningMonth={setPlanningMonth}
            planningLoading={planningLoading}
            refreshPlanning={() => void refreshPlanning()}
            planningSummaryCards={planningSummaryCards}
            budgets={budgets}
            budgetDeficitEvents={budgetDeficitEvents}
            commitments={commitments}
            projectionScenarios={projectionScenarios}
            monthlyFinanceSummary={monthlyFinanceSummary}
            categories={categories}
            budgetDialogOpen={budgetDialogOpen}
            setBudgetDialogOpen={setBudgetDialogOpen}
            resetBudgetDialogState={resetBudgetDialogState}
            openCreateBudgetDialog={openCreateBudgetDialog}
            budgetDialogMode={budgetDialogMode}
            budgetForm={budgetForm}
            setBudgetForm={setBudgetForm}
            saveBudget={() => void saveBudget()}
            budgetCategoryComposerOpen={budgetCategoryComposerOpen}
            setBudgetCategoryComposerOpen={setBudgetCategoryComposerOpen}
            createBudgetCategory={() => void createBudgetCategory()}
            categoryForm={categoryForm}
            setCategoryForm={setCategoryForm}
            commitmentDialogOpen={commitmentDialogOpen}
            setCommitmentDialogOpen={setCommitmentDialogOpen}
            commitmentForm={commitmentForm}
            setCommitmentForm={setCommitmentForm}
            createCommitment={() => void createCommitment()}
            projectionDialogOpen={projectionDialogOpen}
            setProjectionDialogOpen={setProjectionDialogOpen}
            projectionForm={projectionForm}
            setProjectionForm={setProjectionForm}
            runProjection={() => void runProjection()}
            saving={saving}
          />
        )}

        {tab === "investments" && (
          <InvestmentsView
            investments={investments}
            summary={summary}
          />
        )}

        {tab === "copilot" && (
          <div className="section-enter ui-shell-card min-h-0 flex-1 overflow-hidden rounded-[28px]">
            <ChatInterfaceFinance />
          </div>
        )}

        {tab === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

export default function HomePage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const authMode = searchParams.get("auth");

  // The desktop Vite shell renders this page for deep links such as
  // /auth/callback. Keep OAuth callback handling working when its static
  // server falls back to the root document instead of a Next route file.
  if (pathname === "/auth/callback" || authMode === "callback") {
    return <AuthCallbackScreen />;
  }

  if (authMode === "login") {
    return <AuthLoginScreen />;
  }

  return <HomeContent />;
}
