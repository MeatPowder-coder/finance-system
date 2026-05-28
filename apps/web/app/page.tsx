"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function HomePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function fetchAll() {
    setLoading(true);
    setError(null);

    try {
      const [accountsRes, transactionsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/v1/accounts`),
        fetch(`${API_BASE}/v1/transactions?limit=100`),
        fetch(`${API_BASE}/v1/summary`),
      ]);

      if (!accountsRes.ok || !transactionsRes.ok || !summaryRes.ok) {
        throw new Error("No fue posible cargar datos del API financiero");
      }

      const accountsJson = await accountsRes.json();
      const transactionsJson = await transactionsRes.json();
      const summaryJson = await summaryRes.json();

      setAccounts(accountsJson.data || []);
      setTransactions(transactionsJson.data || []);
      setSummary(summaryJson.data || null);

      if ((accountsJson.data || []).length > 0 && !transactionForm.accountId) {
        setTransactionForm((prev) => ({ ...prev, accountId: String(accountsJson.data[0].id) }));
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

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
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

  async function createTransaction(event: React.FormEvent<HTMLFormElement>) {
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
          <h1>Finance System</h1>
          <p>Base operativa financiera migrada desde legacy, sin dependencias de trading.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="badge">API: {API_BASE}</span>
          <button className="secondary" onClick={fetchAll} disabled={loading}>
            {loading ? "Sincronizando..." : "Actualizar"}
          </button>
        </div>
      </section>

      {error ? (
        <section className="card" style={{ marginBottom: 16, borderColor: "#f7d4d0" }}>
          <strong style={{ color: "#c0392b" }}>Error</strong>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="grid top" style={{ marginBottom: 16 }}>
        <article className="card kpi">
          <span className="label">Saldo total</span>
          <strong>COP {asNumber(summary?.totalBalance).toLocaleString("es-CO")}</strong>
        </article>
        <article className="card kpi">
          <span className="label">Ingresos mes</span>
          <strong style={{ color: "#0f7a4b" }}>COP {asNumber(summary?.monthInflow).toLocaleString("es-CO")}</strong>
        </article>
        <article className="card kpi">
          <span className="label">Flujo neto mes</span>
          <strong style={{ color: netFlow >= 0 ? "#0f7a4b" : "#c0392b" }}>
            COP {netFlow.toLocaleString("es-CO")}
          </strong>
          <span className={`badge ${netFlow >= 0 ? "ok" : "warn"}`}>
            {netFlow >= 0 ? "Positivo" : "Negativo"}
          </span>
        </article>
      </section>

      <section className="grid forms" style={{ marginBottom: 16 }}>
        <article className="card">
          <h2 style={{ marginBottom: 10 }}>Nueva Cuenta</h2>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
          <h2 style={{ marginBottom: 10 }}>Nueva Transaccion</h2>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label>
                Tipo
                <select
                  value={transactionForm.direction}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, direction: e.target.value as "INFLOW" | "OUTFLOW" }))}
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
          <h3 style={{ marginBottom: 10 }}>Cuentas</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Codigo</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Moneda</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">Sin cuentas registradas</td>
                  </tr>
                ) : (
                  accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.id}</td>
                      <td>{account.code}</td>
                      <td>{account.name}</td>
                      <td>{account.account_type}</td>
                      <td>{account.currency}</td>
                      <td>{asNumber(account.balance_current).toLocaleString("es-CO")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginBottom: 10 }}>Transacciones</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripcion</th>
                  <th>Cuenta</th>
                  <th>Direccion</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">Sin transacciones</td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.transaction_date}</td>
                      <td>{tx.description || "Sin descripcion"}</td>
                      <td>{tx.account_name}</td>
                      <td>{tx.direction}</td>
                      <td className={`amount ${tx.direction === "INFLOW" ? "in" : "out"}`}>
                        {tx.direction === "INFLOW" ? "+" : "-"} {tx.currency} {asNumber(tx.amount).toLocaleString("es-CO")}
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
