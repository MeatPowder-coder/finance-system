"use client";

import { useMemo, useState, useEffect, useRef } from "react";

type TabId = "dashboard" | "accounts" | "transactions" | "portfolio" | "copilot";

type Account = {
  id: number;
  code: string;
  name: string;
  currency: string;
  account_type: string;
  balance_current: string | number;
  is_active: boolean;
};

type Transaction = {
  id: number;
  transaction_date: string;
  description: string | null;
  amount: string | number;
  currency: string;
  direction: "INFLOW" | "OUTFLOW";
  status: string;
  account_id: number;
  account_name: string;
};

type Investment = {
  id: number;
  symbol: string;
  name: string;
  asset_type: string;
  quantity: string | number;
  avg_cost: string | number;
  currency: string;
  account_id: number | null;
  account_name?: string | null;
  notes?: string | null;
  is_active: boolean;
  invested_amount: string | number;
};

type CopilotSession = {
  id: string;
  title: string;
  mode: "ACCOUNTANT" | "ANALYST";
  message_count: number;
  updated_at: string;
};

type CopilotMessage = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type Summary = {
  totalBalance: number;
  monthInflow: number;
  monthOutflow: number;
  investedTotal: number;
  activePositions: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

const tabs: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "accounts", label: "Cuentas" },
  { id: "transactions", label: "Transacciones" },
  { id: "portfolio", label: "Portfolio" },
  { id: "copilot", label: "Copilot" },
];

const sidebarItems: { id: TabId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "accounts", label: "Cuentas", icon: "◷" },
  { id: "transactions", label: "Transacciones", icon: "¤" },
  { id: "portfolio", label: "Portfolio", icon: "↗" },
  { id: "copilot", label: "Copilot", icon: "✦" },
];

const tabMeta: Record<TabId, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Monitor your active positions and performance.",
  },
  accounts: {
    title: "Cuentas",
    subtitle: "Control operativo de saldos, tipos de cuenta y estructura base.",
  },
  transactions: {
    title: "Historial de Transacciones",
    subtitle: "Movimientos recientes en tus cuentas.",
  },
  portfolio: {
    title: "Portfolio",
    subtitle: "Visión consolidada de posiciones e inversión activa.",
  },
  copilot: {
    title: "Agentame Chat",
    subtitle: "Asistente financiero con sesiones y contexto persistente.",
  },
};

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown, currency = "COP") {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(num(value));
  } catch {
    return `${currency} ${num(value).toFixed(2)}`;
  }
}

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  const [copilotSessions, setCopilotSessions] = useState<CopilotSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [copilotSending, setCopilotSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    currency: "COP",
    accountType: "CHECKING",
    balanceCurrent: "0",
  });

  const [txForm, setTxForm] = useState({
    transactionDate: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    currency: "COP",
    direction: "OUTFLOW",
    status: "POSTED",
    accountId: "",
  });

  const [txFilter, setTxFilter] = useState({
    search: "",
    direction: "ALL",
    status: "ALL",
  });

  const [investmentForm, setInvestmentForm] = useState({
    symbol: "",
    name: "",
    assetType: "CRYPTO",
    quantity: "1",
    avgCost: "0",
    currency: "USD",
    accountId: "",
    notes: "",
  });

  const [sessionForm, setSessionForm] = useState({
    title: "",
    mode: "ACCOUNTANT",
  });

  const [chatInput, setChatInput] = useState("");

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        txFilter.search.trim() === "" ||
        (tx.description || "").toLowerCase().includes(txFilter.search.toLowerCase()) ||
        tx.account_name.toLowerCase().includes(txFilter.search.toLowerCase());

      const matchesDirection = txFilter.direction === "ALL" || tx.direction === txFilter.direction;
      const matchesStatus = txFilter.status === "ALL" || tx.status === txFilter.status;

      return matchesSearch && matchesDirection && matchesStatus;
    });
  }, [transactions, txFilter]);

  const dashboardNet = num(summary?.monthInflow) - num(summary?.monthOutflow);

  const activeSession = copilotSessions.find((s) => s.id === activeSessionId) || null;
  const currentMeta = tabMeta[tab];

  async function fetchJson(url: string, options?: RequestInit) {
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `Request failed (${res.status})`);
    }
    return body;
  }

  async function loadCoreData() {
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, accountsRes, txRes, invRes, sessionsRes] = await Promise.all([
        fetchJson(`${API_BASE}/v1/summary`),
        fetchJson(`${API_BASE}/v1/accounts`),
        fetchJson(`${API_BASE}/v1/transactions?limit=200`),
        fetchJson(`${API_BASE}/v1/investments`),
        fetchJson(`${API_BASE}/v1/copilot/sessions`),
      ]);

      setSummary(summaryRes.data || null);
      setAccounts(accountsRes.data || []);
      setTransactions(txRes.data || []);
      setInvestments(invRes.data || []);
      const sessions = sessionsRes.data || [];
      setCopilotSessions(sessions);

      if (!txForm.accountId && (accountsRes.data || []).length > 0) {
        setTxForm((prev) => ({ ...prev, accountId: String(accountsRes.data[0].id) }));
      }

      if (activeSessionId) {
        const exists = sessions.some((s: CopilotSession) => s.id === activeSessionId);
        if (!exists) {
          setActiveSessionId(sessions[0]?.id || null);
        }
      } else if (sessions.length > 0) {
        setActiveSessionId(sessions[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(sessionId: string) {
    try {
      const data = await fetchJson(`${API_BASE}/v1/copilot/sessions/${sessionId}/messages`);
      setCopilotMessages(data.data || []);
    } catch (err: any) {
      setError(err?.message || "Error cargando mensajes");
    }
  }

  useEffect(() => {
    loadCoreData();
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      setCopilotMessages([]);
      return;
    }
    loadMessages(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [copilotMessages]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await fetchJson(`${API_BASE}/v1/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...accountForm,
          balanceCurrent: Number(accountForm.balanceCurrent || 0),
        }),
      });

      setAccountForm({
        code: "",
        name: "",
        currency: "COP",
        accountType: "CHECKING",
        balanceCurrent: "0",
      });
      await loadCoreData();
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la cuenta");
    }
  }

  async function createTransaction(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await fetchJson(`${API_BASE}/v1/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...txForm,
          amount: Number(txForm.amount || 0),
          accountId: Number(txForm.accountId),
        }),
      });

      setTxForm((prev) => ({ ...prev, description: "", amount: "" }));
      await loadCoreData();
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la transacción");
    }
  }

  async function createInvestment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await fetchJson(`${API_BASE}/v1/investments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...investmentForm,
          quantity: Number(investmentForm.quantity || 0),
          avgCost: Number(investmentForm.avgCost || 0),
          accountId: investmentForm.accountId ? Number(investmentForm.accountId) : undefined,
        }),
      });

      setInvestmentForm({
        symbol: "",
        name: "",
        assetType: "CRYPTO",
        quantity: "1",
        avgCost: "0",
        currency: "USD",
        accountId: "",
        notes: "",
      });

      await loadCoreData();
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la inversión");
    }
  }

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const data = await fetchJson(`${API_BASE}/v1/copilot/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sessionForm.title.trim() || undefined,
          mode: sessionForm.mode,
        }),
      });

      const session = data.data as CopilotSession;
      setSessionForm({ title: "", mode: "ACCOUNTANT" });
      await loadCoreData();
      setActiveSessionId(session.id);
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la sesión");
    }
  }

  async function sendCopilotMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!activeSessionId) {
      setError("Crea o selecciona una sesión de Copilot primero");
      return;
    }

    const text = chatInput.trim();
    if (!text) return;

    setCopilotSending(true);
    setError(null);

    const optimistic: CopilotMessage = {
      id: Date.now(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setCopilotMessages((prev) => [...prev, optimistic]);
    setChatInput("");

    try {
      await fetchJson(`${API_BASE}/v1/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: text,
        }),
      });

      await Promise.all([loadMessages(activeSessionId), loadCoreData()]);
    } catch (err: any) {
      setError(err?.message || "No se pudo enviar el mensaje al Copilot");
      await loadMessages(activeSessionId);
    } finally {
      setCopilotSending(false);
    }
  }

  return (
    <div className="journal-shell">
      <aside className="journal-sidebar">
        <div className="sidebar-head">
          <button type="button" className="sidebar-hamburger" aria-label="Menú">
            ≡
          </button>
          <button type="button" className="sidebar-bolt" aria-label="Modo">
            ⚡
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-item ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
              title={item.label}
              aria-label={item.label}
            >
              <span>{item.icon}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button type="button" className="sidebar-item" title="Tema" aria-label="Tema">
            ◌
          </button>
          <button type="button" className="sidebar-item" title="Salir" aria-label="Salir">
            ↳
          </button>
        </div>
      </aside>

      <div className="journal-main">
        <div className="journal-grid-bg" aria-hidden />
        <main>
          <section className="header">
            <div>
              <h1>{currentMeta.title}</h1>
              <p>{currentMeta.subtitle}</p>
            </div>
            <div className="header-actions">
              <span className="badge">API {API_BASE}</span>
              <button className="primary-action" type="button">
                ↗ Nueva Operación
              </button>
              <button className="secondary" onClick={loadCoreData} disabled={loading}>
                {loading ? "Sincronizando..." : "Actualizar"}
              </button>
            </div>
          </section>

          <section className="tabs">
            {tabs.map((t) => (
              <button key={t.id} type="button" className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </section>

          {error ? (
            <section className="card error" style={{ marginBottom: 10 }}>
              {error}
            </section>
          ) : null}

          {tab === "dashboard" && (
            <section className="layout-grid" style={{ gap: 12 }}>
          <div className="layout-grid three">
            <article className="card kpi">
              <span className="label">Saldo total</span>
              <strong>{money(summary?.totalBalance || 0, "COP")}</strong>
            </article>
            <article className="card kpi">
              <span className="label">Flujo del mes</span>
              <strong className={dashboardNet >= 0 ? "text-ok" : "text-danger"}>{money(dashboardNet, "COP")}</strong>
            </article>
            <article className="card kpi">
              <span className="label">Portfolio activo</span>
              <strong>{money(summary?.investedTotal || 0, "USD")}</strong>
              <p>{summary?.activePositions || 0} posiciones activas</p>
            </article>
          </div>

          <div className="layout-grid two">
            <article className="card">
              <h3 style={{ marginBottom: 8 }}>Cuentas recientes</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th>Tipo</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.slice(0, 8).map((account) => (
                      <tr key={account.id}>
                        <td>{account.name}</td>
                        <td>{account.account_type}</td>
                        <td>{money(account.balance_current, account.currency)}</td>
                      </tr>
                    ))}
                    {accounts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          Sin cuentas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="card">
              <h3 style={{ marginBottom: 8 }}>Transacciones recientes</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripcion</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 8).map((tx) => (
                      <tr key={tx.id}>
                        <td>{tx.transaction_date}</td>
                        <td>{tx.description || "Sin descripcion"}</td>
                        <td className={`amount ${tx.direction === "INFLOW" ? "in" : "out"}`}>
                          {tx.direction === "INFLOW" ? "+" : "-"} {money(tx.amount, tx.currency)}
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          Sin transacciones
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
            </section>
          )}

          {tab === "accounts" && (
            <section className="layout-grid two">
          <article className="card alt">
            <h3 style={{ marginBottom: 8 }}>Nueva cuenta</h3>
            <form onSubmit={createAccount}>
              <label>
                Codigo
                <input
                  value={accountForm.code}
                  onChange={(e) => setAccountForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="BANCOLOMBIA_AHORROS"
                  required
                />
              </label>
              <label>
                Nombre
                <input
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Bancolombia Ahorros"
                  required
                />
              </label>
              <div className="layout-grid two" style={{ gap: 8 }}>
                <label>
                  Moneda
                  <input
                    value={accountForm.currency}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={accountForm.accountType}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, accountType: e.target.value }))}
                  >
                    <option value="CHECKING">CHECKING</option>
                    <option value="SAVINGS">SAVINGS</option>
                    <option value="CREDIT_CARD">CREDIT_CARD</option>
                    <option value="CASH">CASH</option>
                    <option value="INVESTMENT">INVESTMENT</option>
                    <option value="LOAN">LOAN</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </label>
              </div>
              <label>
                Saldo inicial
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.balanceCurrent}
                  onChange={(e) => setAccountForm((prev) => ({ ...prev, balanceCurrent: e.target.value }))}
                />
              </label>
              <button type="submit">Crear cuenta</button>
            </form>
          </article>

          <article className="card">
            <h3 style={{ marginBottom: 8 }}>Listado de cuentas</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.id}</td>
                      <td>{account.code}</td>
                      <td>{account.name}</td>
                      <td>{account.account_type}</td>
                      <td>{money(account.balance_current, account.currency)}</td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Sin cuentas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
            </section>
          )}

          {tab === "transactions" && (
            <section className="layout-grid two">
          <article className="card alt">
            <h3 style={{ marginBottom: 8 }}>Nueva transacción</h3>
            <form onSubmit={createTransaction}>
              <label>
                Fecha
                <input
                  type="date"
                  value={txForm.transactionDate}
                  onChange={(e) => setTxForm((prev) => ({ ...prev, transactionDate: e.target.value }))}
                  required
                />
              </label>
              <label>
                Descripción
                <input
                  value={txForm.description}
                  onChange={(e) => setTxForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <div className="layout-grid two" style={{ gap: 8 }}>
                <label>
                  Tipo
                  <select
                    value={txForm.direction}
                    onChange={(e) => setTxForm((prev) => ({ ...prev, direction: e.target.value }))}
                  >
                    <option value="OUTFLOW">OUTFLOW</option>
                    <option value="INFLOW">INFLOW</option>
                  </select>
                </label>
                <label>
                  Estado
                  <select value={txForm.status} onChange={(e) => setTxForm((prev) => ({ ...prev, status: e.target.value }))}>
                    <option value="POSTED">POSTED</option>
                    <option value="PENDING">PENDING</option>
                    <option value="RECONCILED">RECONCILED</option>
                    <option value="VOID">VOID</option>
                  </select>
                </label>
              </div>
              <div className="layout-grid two" style={{ gap: 8 }}>
                <label>
                  Moneda
                  <input value={txForm.currency} onChange={(e) => setTxForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} />
                </label>
                <label>
                  Monto
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={txForm.amount}
                    onChange={(e) => setTxForm((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </label>
              </div>
              <label>
                Cuenta
                <select value={txForm.accountId} onChange={(e) => setTxForm((prev) => ({ ...prev, accountId: e.target.value }))} required>
                  <option value="">Selecciona una cuenta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Registrar transacción</button>
            </form>
          </article>

          <article className="card">
            <h3 style={{ marginBottom: 8 }}>Historial</h3>
            <div className="filters">
              <input
                placeholder="Buscar descripción/cuenta"
                value={txFilter.search}
                onChange={(e) => setTxFilter((prev) => ({ ...prev, search: e.target.value }))}
              />
              <select value={txFilter.direction} onChange={(e) => setTxFilter((prev) => ({ ...prev, direction: e.target.value }))}>
                <option value="ALL">Dirección: todas</option>
                <option value="INFLOW">INFLOW</option>
                <option value="OUTFLOW">OUTFLOW</option>
              </select>
              <select value={txFilter.status} onChange={(e) => setTxFilter((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="ALL">Estado: todos</option>
                <option value="POSTED">POSTED</option>
                <option value="PENDING">PENDING</option>
                <option value="RECONCILED">RECONCILED</option>
                <option value="VOID">VOID</option>
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Cuenta</th>
                    <th>Estado</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.transaction_date}</td>
                      <td>{tx.description || "Sin descripción"}</td>
                      <td>{tx.account_name}</td>
                      <td>{tx.status}</td>
                      <td className={`amount ${tx.direction === "INFLOW" ? "in" : "out"}`}>
                        {tx.direction === "INFLOW" ? "+" : "-"} {money(tx.amount, tx.currency)}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
            </section>
          )}

          {tab === "portfolio" && (
            <section className="layout-grid two">
          <article className="card alt">
            <h3 style={{ marginBottom: 8 }}>Nueva posición</h3>
            <form onSubmit={createInvestment}>
              <div className="layout-grid two" style={{ gap: 8 }}>
                <label>
                  Símbolo
                  <input
                    value={investmentForm.symbol}
                    onChange={(e) => setInvestmentForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                    required
                  />
                </label>
                <label>
                  Nombre
                  <input value={investmentForm.name} onChange={(e) => setInvestmentForm((prev) => ({ ...prev, name: e.target.value }))} required />
                </label>
              </div>

              <div className="layout-grid two" style={{ gap: 8 }}>
                <label>
                  Tipo de activo
                  <select value={investmentForm.assetType} onChange={(e) => setInvestmentForm((prev) => ({ ...prev, assetType: e.target.value }))}>
                    <option value="CRYPTO">CRYPTO</option>
                    <option value="STOCK">STOCK</option>
                    <option value="ETF">ETF</option>
                    <option value="FUND">FUND</option>
                    <option value="BOND">BOND</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </label>
                <label>
                  Moneda
                  <input
                    value={investmentForm.currency}
                    onChange={(e) => setInvestmentForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  />
                </label>
              </div>

              <div className="layout-grid two" style={{ gap: 8 }}>
                <label>
                  Cantidad
                  <input
                    type="number"
                    min="0"
                    step="0.00000001"
                    value={investmentForm.quantity}
                    onChange={(e) => setInvestmentForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  />
                </label>
                <label>
                  Costo promedio
                  <input
                    type="number"
                    min="0"
                    step="0.00000001"
                    value={investmentForm.avgCost}
                    onChange={(e) => setInvestmentForm((prev) => ({ ...prev, avgCost: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                Cuenta asociada (opcional)
                <select value={investmentForm.accountId} onChange={(e) => setInvestmentForm((prev) => ({ ...prev, accountId: e.target.value }))}>
                  <option value="">Sin cuenta asociada</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Notas
                <textarea value={investmentForm.notes} onChange={(e) => setInvestmentForm((prev) => ({ ...prev, notes: e.target.value }))} />
              </label>

              <button type="submit">Crear posición</button>
            </form>
          </article>

          <article className="card">
            <h3 style={{ marginBottom: 8 }}>Portfolio</h3>
            <div className="portfolio-grid">
              {investments.map((item) => (
                <div className="portfolio-item" key={item.id}>
                  <strong>
                    {item.symbol} · {item.name}
                  </strong>
                  <p>{item.asset_type}</p>
                  <p>
                    Cantidad: {num(item.quantity).toLocaleString("es-CO")} · Avg: {money(item.avg_cost, item.currency)}
                  </p>
                  <p>Invertido: {money(item.invested_amount, item.currency)}</p>
                  <p>Cuenta: {item.account_name || "Sin cuenta"}</p>
                </div>
              ))}
              {investments.length === 0 && <p className="muted">No hay inversiones registradas.</p>}
            </div>
          </article>
            </section>
          )}

          {tab === "copilot" && (
            <section className="chat-layout">
          <article className="card alt">
            <h3 style={{ marginBottom: 8 }}>Sesiones</h3>
            <form onSubmit={createSession} style={{ marginBottom: 8 }}>
              <label>
                Título (opcional)
                <input value={sessionForm.title} onChange={(e) => setSessionForm((prev) => ({ ...prev, title: e.target.value }))} />
              </label>
              <label>
                Modo
                <select value={sessionForm.mode} onChange={(e) => setSessionForm((prev) => ({ ...prev, mode: e.target.value }))}>
                  <option value="ACCOUNTANT">ACCOUNTANT</option>
                  <option value="ANALYST">ANALYST</option>
                </select>
              </label>
              <button type="submit">Crear sesión</button>
            </form>

            <div className="chat-sessions">
              {copilotSessions.map((session) => (
                <button
                  key={session.id}
                  className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  <div>{session.title}</div>
                  <small className="muted">
                    {session.mode} · {session.message_count} mensajes
                  </small>
                </button>
              ))}
              {copilotSessions.length === 0 && <p className="muted" style={{ padding: 10 }}>Sin sesiones</p>}
            </div>
          </article>

          <article className="chat-panel">
            <div className="messages">
              <div className="muted">
                {activeSession ? `${activeSession.title} (${activeSession.mode})` : "Selecciona o crea una sesión"}
              </div>
              {copilotMessages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role === "user" ? "user" : "assistant"}`}>
                  {msg.content}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input" onSubmit={sendCopilotMessage}>
              <textarea
                placeholder="Escribe una consulta financiera: saldos, gastos, movimientos, resumen mensual..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={!activeSessionId || copilotSending}
              />
              <button type="submit" disabled={!activeSessionId || copilotSending}>
                {copilotSending ? "Enviando..." : "Enviar"}
              </button>
            </form>
          </article>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
