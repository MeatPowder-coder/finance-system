const cards = [
  "Dashboard financiero",
  "Cuentas",
  "Transacciones",
  "Presupuestos",
  "Recurrentes",
  "Reportes"
];

export function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Finance System Desktop</h1>
      <p>Base nativa del escritorio financiero (Tauri-ready) sin módulos de trading.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 16 }}>
        {cards.map((card) => (
          <article key={card} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <strong>{card}</strong>
          </article>
        ))}
      </div>
    </main>
  );
}
