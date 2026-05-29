"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

type Summary = {
  totalBalance: number;
  monthInflow: number;
  monthOutflow: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

function asNumber(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: string | number | null | undefined, currency = "COP") {
  const amount = asNumber(value);
  const safeCurrency = (currency || "COP").toUpperCase();

  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${safeCurrency} ${amount.toLocaleString("es-CO")}`;
  }
}

function statusClass(status: string) {
  const value = status.toUpperCase();
  if (value === "POSTED") return "posted";
  if (value === "RECONCILED") return "reconciled";
  if (value === "PENDING") return "pending";
  return "void";
}

export default function HomePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accountSearch, setAccountSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("ALL");

  const [txSearch, setTxSearch] = useState("");
  const [txDirectionFilter, setTxDirectionFilter] = useState("ALL");
  const [txStatusFilter, setTxStatusFilter] = useState("ALL");
  const [txAccountFilter, setTxAccountFilter] = useState("ALL");

  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    currency: "COP",
    accountType: "CHECKING",
    balanceCurrent: "0",
  });

  const [transactionForm, setTransactionForm] = useState({
    transactionDate: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    currency: "COP",
    direction: "OUTFLOW",
    status: "POSTED",
    accountId: "",
  });

  const netFlow = useMemo(() => {
    if (!summary) return 0;
    return summary.monthInflow - summary.monthOutflow;
  }, [summary]);

  const filteredAccounts = useMemo(() => {
    const search = accountSearch.trim().toLowerCase();

    return accounts
      .filter((account) => {
        const matchesType = accountTypeFilter === "ALL" || account.account_type === accountTypeFilter;
        if (!matchesType) return false;
        if (!search) return true;

        return (
          account.name.toLowerCase().includes(search) ||
          account.code.toLowerCase().includes(search) ||
          account.currency.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => asNumber(b.balance_current) - asNumber(a.balance_current));
  }, [accounts, accountSearch, accountTypeFilter]);

  const filteredTransactions = useMemo(() => {
    const search = txSearch.trim().toLowerCase();

    return transactions.filter((tx) => {
      if (txDirectionFilter !== "ALL" && tx.direction !== txDirectionFilter) return false;
      if (txStatusFilter !== "ALL" && tx.status !== txStatusFilter) return false;
      if (txAccountFilter !== "ALL" && String(tx.account_id) !== txAccountFilter) return false;

      if (!search) return true;
      return (
        (tx.description || "").toLowerCase().includes(search) ||
        tx.account_name.toLowerCase().includes(search) ||
        tx.transaction_date.includes(search) ||
        tx.status.toLowerCase().includes(search) ||
        tx.direction.toLowerCase().includes(search)
      );
    });
  }, [transactions, txSearch, txDirectionFilter, txStatusFilter, txAccountFilter]);

  const accountTypes = useMemo(() => {
    return Array.from(new Set(accounts.map((account) => account.account_type))).sort();
  }, [accounts]);

  const transactionStatuses = useMemo(() => {
    return Array.from(new Set(transactions.map((tx) => tx.status))).sort();
  }, [transactions]);

  async function fetchAll() {
    setLoading(true);
    setError(null);

    try {
      const [accountsRes, transactionsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/v1/accounts`),
        fetch(`${API_BASE}/v1/transactions?limit=200`),
        fetch(`${API_BASE}/v1/summary`),
      ]);

      if (!accountsRes.ok || !transactionsRes.ok || !summaryRes.ok) {
        throw new Error("No fue posible cargar datos del API financiero");
      }

      const accountsJson = await accountsRes.json();
      const transactionsJson = await transactionsRes.json();
      const summaryJson = await summaryRes.json();

      const nextAccounts = accountsJson.data || [];
      setAccounts(nextAccounts);
      setTransactions(transactionsJson.data || []);
      setSummary(summaryJson.data || null);

      if (nextAccounts.length > 0 && !transactionForm.accountId) {
        setTransactionForm((prev) => ({ ...prev, accountId: String(nextAccounts[0].id) }));
      }
    } catch (err: any) {
      setError(err?.message || "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/v1/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...accountForm,
          balanceCurrent: Number(accountForm.balanceCurrent || 0),
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "No se pudo crear la cuenta");
      }

      setAccountForm({
        code: "",
        name: "",
        currency: "COP",
        accountType: "CHECKING",
        balanceCurrent: "0",
      });

      await fetchAll();
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la cuenta");
    }
  }

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/v1/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...transactionForm,
          amount: Number(transactionForm.amount || 0),
          accountId: Number(transactionForm.accountId),
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "No se pudo crear la transaccion");
      }

      setTransactionForm((prev) => ({
        ...prev,
        description: "",
        amount: "",
      }));

      await fetchAll();
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la transaccion");
    }
  }

  return (
    <main>
      <section className="toolbar">
        <div>
          <h1>Finance Dashboard</h1>
          <p>Monitoreo diario de cuentas y movimientos financieros.</p>
        </div>
        <div className="toolbar-actions">
          <span className="badge">API: {API_BASE}</span>
          <button className="secondary" onClick={fetchAll} disabled={loading}>
            {loading ? "Sincronizando..." : "Actualizar"}
          </button>
        </div>
      </section>

      {error ? (
        <section className="card error-card">
          <strong>Error</strong>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="grid top">
        <article className="card kpi">
          <span className="label">Saldo total</span>
          <strong>{formatMoney(summary?.totalBalance, "COP")}</strong>
        </article>
        <article className="card kpi">
          <span className="label">Ingresos del mes</span>
          <strong className="kpi-positive">{formatMoney(summary?.monthInflow, "COP")}</strong>
        </article>
        <article className="card kpi">
          <span className="label">Flujo neto mensual</span>
          <strong className={netFlow >= 0 ? "kpi-positive" : "kpi-negative"}>{formatMoney(netFlow, "COP")}</strong>
          <span className={`badge ${netFlow >= 0 ? "ok" : "warn"}`}>{netFlow >= 0 ? "Positivo" : "Negativo"}</span>
        </article>
      </section>

      <section className="grid forms">
        <article className="card">
          <h2>Nueva Cuenta</h2>
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
            <div className="form-row">
              <label>
                Moneda
                <input
                  value={accountForm.currency}
                  onChange={(e) => setAccountForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  required
                />
              </label>
              <label>
                Saldo inicial
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.balanceCurrent}
                  onChange={(e) => setAccountForm((prev) => ({ ...prev, balanceCurrent: e.target.value }))}
                  required
                />
              </label>
            </div>
            <button type="submit">Crear cuenta</button>
          </form>
        </article>

        <article className="card">
          <h2>Nueva Transaccion</h2>
          <form onSubmit={createTransaction}>
            <label>
              Fecha
              <input
                type="date"
                value={transactionForm.transactionDate}
                onChange={(e) => setTransactionForm((prev) => ({ ...prev, transactionDate: e.target.value }))}
                required
              />
            </label>
            <label>
              Descripcion
              <input
                value={transactionForm.description}
                onChange={(e) => setTransactionForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Mercado del mes"
              />
            </label>
            <div className="form-row">
              <label>
                Tipo
                <select
                  value={transactionForm.direction}
                  onChange={(e) =>
                    setTransactionForm((prev) => ({ ...prev, direction: e.target.value as "INFLOW" | "OUTFLOW" }))
                  }
                >
                  <option value="OUTFLOW">OUTFLOW</option>
                  <option value="INFLOW">INFLOW</option>
                </select>
              </label>
              <label>
                Estado
                <select
                  value={transactionForm.status}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="POSTED">POSTED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="RECONCILED">RECONCILED</option>
                  <option value="VOID">VOID</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Moneda
                <input
                  value={transactionForm.currency}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                />
              </label>
              <label>
                Monto
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transactionForm.amount}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </label>
            </div>
            <label>
              Cuenta
              <select
                value={transactionForm.accountId}
                onChange={(e) => setTransactionForm((prev) => ({ ...prev, accountId: e.target.value }))}
                required
              >
                <option value="">Selecciona una cuenta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={accounts.length === 0}>
              Registrar transaccion
            </button>
          </form>
        </article>
      </section>

      <section className="grid tables">
        <article className="card">
          <div className="table-header">
            <h3>Cuentas</h3>
            <span className="muted">{filteredAccounts.length} resultados</span>
          </div>
          <div className="table-filters">
            <input
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              placeholder="Buscar por nombre, codigo o moneda..."
            />
            <select value={accountTypeFilter} onChange={(e) => setAccountTypeFilter(e.target.value)}>
              <option value="ALL">Todos los tipos</option>
              {accountTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th>Moneda</th>
                  <th>Estado</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Sin cuentas que coincidan con el filtro
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => (
                    <tr key={account.id}>
                      <td data-label="Cuenta">
                        <strong>{account.name}</strong>
                        <div className="muted code-line">{account.code}</div>
                      </td>
                      <td data-label="Tipo">{account.account_type}</td>
                      <td data-label="Moneda">{account.currency}</td>
                      <td data-label="Estado">
                        <span className={`status-pill ${account.is_active ? "active" : "inactive"}`}>
                          {account.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td data-label="Saldo">{formatMoney(account.balance_current, account.currency)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <div className="table-header">
            <h3>Transacciones</h3>
            <span className="muted">{filteredTransactions.length} resultados</span>
          </div>
          <div className="table-filters">
            <input
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Buscar por descripcion, cuenta, fecha..."
            />
            <div className="filters-row">
              <select value={txDirectionFilter} onChange={(e) => setTxDirectionFilter(e.target.value)}>
                <option value="ALL">Todos los tipos</option>
                <option value="INFLOW">INFLOW</option>
                <option value="OUTFLOW">OUTFLOW</option>
              </select>
              <select value={txStatusFilter} onChange={(e) => setTxStatusFilter(e.target.value)}>
                <option value="ALL">Todos los estados</option>
                {transactionStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select value={txAccountFilter} onChange={(e) => setTxAccountFilter(e.target.value)}>
                <option value="ALL">Todas las cuentas</option>
                {accounts.map((account) => (
                  <option key={account.id} value={String(account.id)}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripcion</th>
                  <th>Cuenta</th>
                  <th>Estado</th>
                  <th>Direccion</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Sin transacciones que coincidan con el filtro
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td data-label="Fecha">{tx.transaction_date}</td>
                      <td data-label="Descripcion">{tx.description || "Sin descripcion"}</td>
                      <td data-label="Cuenta">{tx.account_name}</td>
                      <td data-label="Estado">
                        <span className={`status-pill ${statusClass(tx.status)}`}>{tx.status}</span>
                      </td>
                      <td data-label="Direccion">{tx.direction}</td>
                      <td data-label="Monto" className={`amount ${tx.direction === "INFLOW" ? "in" : "out"}`}>
                        {tx.direction === "INFLOW" ? "+" : "-"} {formatMoney(tx.amount, tx.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
