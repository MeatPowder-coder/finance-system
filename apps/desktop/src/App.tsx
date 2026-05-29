import { useEffect, useMemo, useState } from "react";

type TabId = "dashboard" | "accounts" | "transactions" | "portfolio" | "copilot";

type Summary = {
  totalBalance: number;
  monthInflow: number;
  monthOutflow: number;
  investedTotal: number;
  activePositions: number;
};

type Account = {
  id: number;
  code: string;
  name: string;
  currency: string;
  account_type: string;
  balance_current: string | number;
};

type Transaction = {
  id: number;
  transaction_date: string;
  description: string | null;
  amount: string | number;
  currency: string;
  direction: "INFLOW" | "OUTFLOW";
  status: string;
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
  invested_amount: string | number;
};

type CopilotSession = {
  id: string;
  title: string;
  mode: "ACCOUNTANT" | "ANALYST";
  message_count: number;
};

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:4100";

const tabs: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "accounts", label: "Cuentas" },
  { id: "transactions", label: "Transacciones" },
  { id: "portfolio", label: "Portfolio" },
  { id: "copilot", label: "Copilot" },
];

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

export function App() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [sessions, setSessions] = useState<CopilotSession[]>([]);

  const net = useMemo(() => num(summary?.monthInflow) - num(summary?.monthOutflow), [summary]);

  async function fetchJson(url: string) {
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `Request failed (${res.status})`);
    }
    return body;
  }

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, accountRes, txRes, invRes, sessionsRes] = await Promise.all([
        fetchJson(`${API_BASE}/v1/summary`),
        fetchJson(`${API_BASE}/v1/accounts`),
        fetchJson(`${API_BASE}/v1/transactions?limit=60`),
        fetchJson(`${API_BASE}/v1/investments`),
        fetchJson(`${API_BASE}/v1/copilot/sessions`),
      ]);

      setSummary(summaryRes.data || null);
      setAccounts(accountRes.data || []);
      setTransactions(txRes.data || []);
      setInvestments(invRes.data || []);
      setSessions(sessionsRes.data || []);
    } catch (err: any) {
      setError(err?.message || "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main>
      <section className="header">
        <div>
          <h1>Finance Desktop</h1>
          <p>Paridad funcional y visual: cuentas, transacciones, portfolio y copilot.</p>
        </div>
        <div className="header-actions">
          <span className="badge">API {API_BASE}</span>
          <button className="secondary" onClick={load} disabled={loading}>
            {loading ? "Sincronizando..." : "Actualizar"}
          </button>
        </div>
      </section>

      <section className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
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
              <strong className={net >= 0 ? "text-ok" : "text-danger"}>{money(net, "COP")}</strong>
            </article>
            <article className="card kpi">
              <span className="label">Portfolio activo</span>
              <strong>{money(summary?.investedTotal || 0, "USD")}</strong>
              <p>{summary?.activePositions || 0} posiciones activas</p>
            </article>
          </div>
        </section>
      )}

      {tab === "accounts" && (
        <section className="card">
          <h3 style={{ marginBottom: 8 }}>Cuentas</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.code}</td>
                    <td>{account.name}</td>
                    <td>{account.account_type}</td>
                    <td>{money(account.balance_current, account.currency)}</td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Sin cuentas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "transactions" && (
        <section className="card">
          <h3 style={{ marginBottom: 8 }}>Transacciones</h3>
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
                {transactions.map((tx) => (
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
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Sin transacciones
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "portfolio" && (
        <section className="card">
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
              </div>
            ))}
            {investments.length === 0 && <p className="muted">No hay inversiones registradas.</p>}
          </div>
        </section>
      )}

      {tab === "copilot" && (
        <section className="card">
          <h3 style={{ marginBottom: 8 }}>Copilot</h3>
          <p style={{ marginBottom: 8 }}>
            Sesiones detectadas: {sessions.length}. Para chat completo usa la vista web y endpoint `/v1/copilot/chat`.
          </p>
          <div className="chat-sessions">
            {sessions.map((session) => (
              <button key={session.id} className="session-item">
                <div>{session.title}</div>
                <small className="muted">
                  {session.mode} · {session.message_count} mensajes
                </small>
              </button>
            ))}
            {sessions.length === 0 && <p className="muted" style={{ padding: 10 }}>Sin sesiones</p>}
          </div>
        </section>
      )}
    </main>
  );
}
