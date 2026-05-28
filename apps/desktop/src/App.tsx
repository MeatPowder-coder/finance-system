import { useEffect, useState, type CSSProperties } from "react";

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

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:4100";

const wrapper: CSSProperties = {
  fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
  padding: 18,
  color: "#0f172a",
  background: "#f5f7fb",
  minHeight: "100vh",
};

const card: CSSProperties = {
  border: "1px solid #dbe4ef",
  borderRadius: 12,
  background: "#fff",
  padding: 14,
};

function toNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [accountsRes, txRes] = await Promise.all([
        fetch(`${API_BASE}/v1/accounts`),
        fetch(`${API_BASE}/v1/transactions?limit=25`),
      ]);

      if (!accountsRes.ok || !txRes.ok) {
        throw new Error("No fue posible cargar la informacion desde el API financiero");
      }

      const accountsJson = await accountsRes.json();
      const txJson = await txRes.json();

      setAccounts(accountsJson.data || []);
      setTransactions(txJson.data || []);
    } catch (err: any) {
      setError(err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={wrapper}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Finance System Desktop</h1>
          <p style={{ margin: "4px 0 0", color: "#475569" }}>Vista operativa sincronizada con API financiera</p>
        </div>
        <button
          style={{ border: "1px solid #0b3d91", background: "#0b3d91", color: "#fff", borderRadius: 10, padding: "8px 12px" }}
          onClick={load}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </header>

      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginBottom: 14 }}>
        <article style={card}>
          <small style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cuentas</small>
          <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{accounts.length}</h2>
        </article>
        <article style={card}>
          <small style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Transacciones</small>
          <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{transactions.length}</h2>
        </article>
        <article style={card}>
          <small style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Saldo agregado</small>
          <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>
            COP {accounts.reduce((sum, account) => sum + toNumber(account.balance_current), 0).toLocaleString("es-CO")}
          </h2>
        </article>
      </section>

      {error ? (
        <section style={{ ...card, borderColor: "#f5c2bd", color: "#b42318", marginBottom: 12 }}>{error}</section>
      ) : null}

      <section style={{ ...card, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Cuentas</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Codigo</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Nombre</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Tipo</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Moneda</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "10px 6px", color: "#64748b" }}>Sin cuentas</td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id}>
                    <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>{account.code}</td>
                    <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>{account.name}</td>
                    <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>{account.account_type}</td>
                    <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>{account.currency}</td>
                    <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px", textAlign: "right" }}>
                      {toNumber(account.balance_current).toLocaleString("es-CO")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Transacciones recientes</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {transactions.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>Sin transacciones</p>
          ) : (
            transactions.map((tx) => (
              <article
                key={tx.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <strong>{tx.description || "Sin descripcion"}</strong>
                  <p style={{ margin: "4px 0 0", color: "#64748b" }}>
                    {tx.transaction_date} · {tx.account_name}
                  </p>
                </div>
                <strong style={{ color: tx.direction === "INFLOW" ? "#0f7a4b" : "#b42318" }}>
                  {tx.direction === "INFLOW" ? "+" : "-"} {tx.currency} {toNumber(tx.amount).toLocaleString("es-CO")}
                </strong>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
