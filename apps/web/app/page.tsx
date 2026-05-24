const items = [
  "Cuentas y saldos",
  "Transacciones y conciliación",
  "Presupuestos",
  "Recurrentes",
  "Deuda/tarjetas",
  "Reportes"
];

export default function HomePage() {
  return (
    <main>
      <h1>Finance System</h1>
      <p>Monorepo financiero en construcción (sin trading).</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>API health: <code>/health</code> en puerto 4100.</p>
    </main>
  );
}
