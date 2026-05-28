import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

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

const page: CSSProperties = {
  fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
  color: "#0f172a",
  background: "#f4f7fb",
  minHeight: "100vh",
  padding: 16,
};

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #dbe4ef",
  borderRadius: 12,
  padding: 12,
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 560,
};

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
    <main style={page}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div>
          <h1 style={{ margin: 0 }}>Finance Desktop</h1>
          <p style={{ margin: 0, color: "#475569" }}>Paridad funcional para desarrollo: cuentas, transacciones, portfolio y copilot.</p>
        </div>
        <button
          style={{ borderRadius: 9, border: "1px solid #0b3d91", background: "#0b3d91", color: "#fff", padding: "8px 12px" }}
          onClick={load}
          disabled={loading}
        >
          {loading ? "Sincronizando..." : "Actualizar"}
        </button>
      </header>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {(["dashboard", "accounts", "transactions", "portfolio", "copilot"] as TabId[]).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              borderRadius: 8,
              border: `1px solid ${tab === id ? "#0b3d91" : "#cbd5e1"}`,
              background: tab === id ? "#0b3d91" : "#fff",
              color: tab === id ? "#fff" : "#0f172a",
              padding: "7px 10px",
              textTransform: "capitalize",
            }}
          >
            {id}
          </button>
        ))}
      </div>

      {error ? <section style={{ ...card, borderColor: "#f5c2bd", color: "#b42318", marginBottom: 10 }}>{error}</section> : null}

      {tab === "dashboard" && (
        <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <article style={card}>
            <small style={{ color: "#64748b", textTransform: "uppercase" }}>Saldo total</small>
            <h2 style={{ margin: "6px 0 0" }}>{money(summary?.totalBalance || 0, "COP")}</h2>
          </article>
          <article style={card}>
            <small style={{ color: "#64748b", textTransform: "uppercase" }}>Flujo neto del mes</small>
            <h2 style={{ margin: "6px 0 0", color: net >= 0 ? "#0f7a4b" : "#b42318" }}>{money(net, "COP")}</h2>
          </article>
          <article style={card}>
            <small style={{ color: "#64748b", textTransform: "uppercase" }}>Portfolio activo</small>
            <h2 style={{ margin: "6px 0 0" }}>{money(summary?.investedTotal || 0, "USD")}</h2>
            <p style={{ margin: "4px 0 0", color: "#475569" }}>{summary?.activePositions || 0} posiciones</p>
          </article>
        </section>
      )}

      {tab === "accounts" && (
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Cuentas</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Codigo</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Nombre</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Tipo</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{account.code}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{account.name}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{account.account_type}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{money(account.balance_current, account.currency)}</td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "8px 6px", color: "#64748b" }}>
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
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Transacciones</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Fecha</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Descripcion</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Cuenta</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{tx.transaction_date}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{tx.description || "Sin descripcion"}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{tx.account_name}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9", color: tx.direction === "INFLOW" ? "#0f7a4b" : "#b42318" }}>
                      {tx.direction === "INFLOW" ? "+" : "-"} {money(tx.amount, tx.currency)}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "8px 6px", color: "#64748b" }}>
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
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Portfolio</h3>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {investments.map((investment) => (
              <article key={investment.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                <strong>
                  {investment.symbol} · {investment.name}
                </strong>
                <p style={{ margin: "4px 0 0", color: "#475569" }}>{investment.asset_type}</p>
                <p style={{ margin: "4px 0 0", color: "#475569" }}>
                  Cantidad {num(investment.quantity).toLocaleString("es-CO")} · Avg {money(investment.avg_cost, investment.currency)}
                </p>
                <p style={{ margin: "4px 0 0", color: "#0f172a" }}>Invertido {money(investment.invested_amount, investment.currency)}</p>
              </article>
            ))}
            {investments.length === 0 && <p style={{ color: "#64748b" }}>Sin posiciones registradas</p>}
          </div>
        </section>
      )}

      {tab === "copilot" && (
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Copilot</h3>
          <p style={{ margin: "4px 0 8px", color: "#475569" }}>
            Sesiones detectadas: {sessions.length}. Para chat completo usa la vista web y endpoint /v1/copilot/chat.
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {sessions.map((session) => (
              <article key={session.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                <strong>{session.title}</strong>
                <p style={{ margin: "2px 0 0", color: "#475569" }}>
                  {session.mode} · {session.message_count} mensajes
                </p>
              </article>
            ))}
            {sessions.length === 0 && <p style={{ color: "#64748b" }}>Sin sesiones de copilot</p>}
          </div>
        </section>
      )}
    </main>
  );
}
