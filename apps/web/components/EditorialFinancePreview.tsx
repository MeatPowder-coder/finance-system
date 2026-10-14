"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type EditorialFinancePreviewProps = {
  className?: string;
  returnTo?: string;
};

type PreviewPanel = "balance" | "flow" | "budgets" | "accounts" | "movements" | "payments";
const appSections = [
  ["Resumen", "dashboard"], ["Cuentas", "accounts"], ["Movimientos", "transactions"], ["Reportes", "reports"],
  ["Inversiones", "investments"], ["Planificación", "planning"], ["Copilot", "copilot"], ["Ajustes", "settings"],
] as const;

const panels: Array<{ id: PreviewPanel; label: string; title: string; summary: string; details: Array<[string, string, string]> }> = [
  { id: "balance", label: "Balance del mes", title: "El mes va a favor", summary: "Una lectura rápida junta el saldo neto, el ritmo del periodo y lo que viene después.", details: [["Ingresos registrados", "$6,24 M", "En el periodo actual"], ["Gastos registrados", "$4,96 M", "Incluye movimientos conciliados"], ["Resultado neto", "+$1.284.000", "Ingresos menos gastos"], ["Cambio mensual", "+8,4%", "Frente al periodo anterior"]] },
  { id: "flow", label: "Flujo del mes", title: "Entradas y salidas", summary: "El anillo compara el dinero que ya salió con el ingreso disponible del mes.", details: [["Ingreso gastado", "69%", "Del ingreso registrado"], ["Disponible", "$1,28 M", "Antes de próximos pagos"], ["Entradas", "$6,24 M", "Nómina y otros ingresos"], ["Salidas", "$4,96 M", "Compras, servicios y pagos"]] },
  { id: "budgets", label: "Presupuestos", title: "Presupuestos en tensión", summary: "Cada barra muestra cuánto del límite asignado se ha consumido.", details: [["Hogar", "78% usado", "$440.000 disponibles"], ["Comida", "63% usado", "$296.000 disponibles"], ["Movilidad", "41% usado", "$354.000 disponibles"], ["Presupuestos activos", "4 de 8", "El ejemplo muestra tres categorías"]] },
  { id: "accounts", label: "Cuentas", title: "Saldo consolidado", summary: "Consulta la distribución del dinero por cuenta y el peso relativo de cada saldo.", details: [["Cuenta principal", "$5,24 M", "Disponible"], ["Ahorro", "$2,80 M", "Reserva"], ["Efectivo", "$420 k", "En mano"], ["Total disponible", "$8,46 M", "Suma ilustrativa de las cuentas"]] },
  { id: "movements", label: "Movimientos", title: "Lo que acaba de pasar", summary: "Una línea de tiempo deja ingresos y gastos a la vista sin convertir el inicio en una tabla.", details: [["Nómina", "+$3.200.000", "Hoy · Cuenta principal · Ingreso"], ["Mercado", "−$186.400", "Ayer · Hogar · Tarjeta débito"], ["Transporte", "−$42.000", "27 sep · Movilidad · Efectivo"], ["Ver todos", "Actividad completa", "La app conserva búsqueda y filtros"]] },
  { id: "payments", label: "Próximos pagos", title: "A la vuelta", summary: "Los compromisos próximos ayudan a anticipar lo que saldrá de las cuentas.", details: [["Internet hogar", "$119.900", "02 oct · Servicios"], ["Tarjeta crédito", "$640.000", "05 oct · Compromisos"], ["Próximo vencimiento", "02 oct", "En 3 días"], ["Agenda", "2 pagos", "Compromisos ilustrativos"]] },
];

const budgetSamples = [
  { label: "Hogar", value: "78%", width: "78%", tone: "coral" },
  { label: "Comida", value: "63%", width: "63%", tone: "forest" },
  { label: "Movilidad", value: "41%", width: "41%", tone: "forest" },
];

const movementSamples = [
  { date: "HOY · 09:14", label: "Nómina", amount: "+$3.200.000", tone: "income" },
  { date: "AYER · 18:32", label: "Mercado", amount: "−$186.400", tone: "expense" },
  { date: "27 SEP · 12:06", label: "Transporte", amount: "−$42.000", tone: "expense" },
];

const accountSamples = [
  ["Cuenta principal", "$5,24 M"],
  ["Ahorro", "$2,80 M"],
  ["Efectivo", "$420 k"],
];

function buildAuthUrl(returnTo: string) {
  const params = new URLSearchParams({ auth: "login", returnTo });
  return `/?${params.toString()}`;
}

export function EditorialFinancePreview({ className = "", returnTo = "/" }: EditorialFinancePreviewProps) {
  const [focusedPanel, setFocusedPanel] = useState<PreviewPanel | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const previousRectsRef = useRef(new Map<PreviewPanel, DOMRect>());

  const rememberRects = () => {
    const rects = new Map<PreviewPanel, DOMRect>();
    gridRef.current?.querySelectorAll<HTMLElement>("[data-preview-panel]").forEach((tile) => {
      const id = tile.dataset.previewPanel as PreviewPanel | undefined;
      if (id) rects.set(id, tile.getBoundingClientRect());
    });
    previousRectsRef.current = rects;
  };

  const focusPanel = (id: PreviewPanel, source?: HTMLElement | null) => {
    if (focusedPanel === id) return;
    if (!focusedPanel) returnFocusRef.current = source || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    rememberRects();
    setFocusedPanel(id);
  };

  const closePanel = () => {
    if (!focusedPanel) return;
    rememberRects();
    setFocusedPanel(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus({ preventScroll: true }));
  };

  useLayoutEffect(() => {
    const before = previousRectsRef.current;
    previousRectsRef.current = new Map();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (before.size && !reduceMotion) {
      gridRef.current?.querySelectorAll<HTMLElement>("[data-preview-panel]").forEach((tile) => {
        const id = tile.dataset.previewPanel as PreviewPanel | undefined;
        const oldRect = id ? before.get(id) : undefined;
        if (!oldRect) return;
        const nextRect = tile.getBoundingClientRect();
        const dx = oldRect.left - nextRect.left;
        const dy = oldRect.top - nextRect.top;
        const sx = nextRect.width ? oldRect.width / nextRect.width : 1;
        const sy = nextRect.height ? oldRect.height / nextRect.height : 1;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) return;
        tile.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: "top left" },
          { transform: "translate(0, 0) scale(1, 1)", transformOrigin: "top left" },
        ], { duration: 560, easing: "cubic-bezier(.16,1,.3,1)" });
      });
    }
    if (focusedPanel) {
      const tile = gridRef.current?.querySelector<HTMLElement>("[data-preview-panel].is-focused");
      requestAnimationFrame(() => {
        // Keep the selected tile in the Bento grid. Center it when its details
        // fit; align the top for taller content so its heading stays visible.
        const visibleHeight = window.innerHeight;
        const block = tile && tile.getBoundingClientRect().height <= visibleHeight * 0.82 ? "center" : "start";
        tile?.scrollIntoView({
          block,
          inline: "nearest",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        });
        tile?.querySelector<HTMLButtonElement>(".finance-bento-preview-expanded-head > button")?.focus({ preventScroll: true });
      });
    }
  }, [focusedPanel]);

  useEffect(() => {
    if (!focusedPanel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedPanel]);

  return (
    <section
      className={`finance-bento-preview${focusedPanel ? " has-focus" : ""} ${className}`}
      aria-label="Vista interactiva de muestra del dashboard. Valores ilustrativos."
    >
      <header className="finance-bento-preview-head">
        <span><b>F/S</b> 01 / CUADERNO FINANCIERO</span>
        <span className="finance-bento-preview-sample">DATOS DE MUESTRA</span>
      </header>

      <nav className="finance-bento-preview-sections" aria-label="Secciones de Finance System. Inicia sesión para abrir cada sección.">
        {appSections.map(([label, tab], index) => <a key={tab} href={buildAuthUrl(`/?tab=${tab}`)} aria-label={`${label}. Inicia sesión para abrir esta sección.`}>
          <span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b>
        </a>)}
      </nav>

      <div className="finance-bento-preview-layout">
        <nav className="finance-bento-preview-rail" aria-label="Explorar tarjetas de muestra">
          {panels.map((panel, index) => <button
            key={panel.id}
            type="button"
            className={focusedPanel === panel.id ? "is-current" : ""}
            aria-label={`Ampliar ${panel.label}`}
            aria-pressed={focusedPanel === panel.id}
            onClick={(event) => focusPanel(panel.id, event.currentTarget)}
          >{String(index + 1).padStart(2, "0")}</button>)}
        </nav>

        <div ref={gridRef} className={`finance-bento-preview-grid${focusedPanel ? " is-focused" : ""}`}>
          <article data-preview-panel="balance" tabIndex={0} role="group" aria-expanded={focusedPanel === "balance"} aria-label="Balance del mes; seleccionar para ampliar" className={`finance-bento-preview-tile finance-bento-preview-balance${focusedPanel === "balance" ? " is-focused" : ""}`} onClick={(event) => { if (!(event.target as HTMLElement).closest("button,a")) focusPanel("balance", event.currentTarget); }} onKeyDown={(event) => { if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); focusPanel("balance", event.currentTarget); } }}>
            <div className="finance-bento-preview-label">01 / EL PULSO DE TU DINERO</div>
            <h2>EL MES<br />VA <em>A FAVOR.</em></h2>
            <strong>+$1.284.000</strong>
            <div className="finance-bento-preview-balance-foot"><span>FLUJO NETO</span><span>AL 29 SEP · COP</span></div>
            <div className="finance-bento-preview-spark" aria-hidden="true">
              {[34, 48, 42, 65, 54, 78, 58, 92, 70, 84, 64, 100].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
            </div>
            {focusedPanel === "balance" && <ExpandedPanel panel="balance" returnTo={returnTo} onClose={closePanel} />}
          </article>

          <article data-preview-panel="flow" tabIndex={0} role="group" aria-expanded={focusedPanel === "flow"} aria-label="Flujo del mes; seleccionar para ampliar" className={`finance-bento-preview-tile finance-bento-preview-flow${focusedPanel === "flow" ? " is-focused" : ""}`} onClick={(event) => { if (!(event.target as HTMLElement).closest("button,a")) focusPanel("flow", event.currentTarget); }} onKeyDown={(event) => { if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); focusPanel("flow", event.currentTarget); } }}>
            <div className="finance-bento-preview-label">02 / FLUJO DEL MES</div>
            <div className="finance-bento-preview-flow-body">
              <div className="finance-bento-preview-donut"><span><b>69%</b><small>USADO</small></span></div>
              <div><h3>Entradas<br />y salidas</h3><p><span>Entró</span><b>$6,24 M</b></p><p><span>Salió</span><b>$4,96 M</b></p></div>
            </div>
            {focusedPanel === "flow" && <ExpandedPanel panel="flow" returnTo={returnTo} onClose={closePanel} />}
          </article>

          <article data-preview-panel="budgets" tabIndex={0} role="group" aria-expanded={focusedPanel === "budgets"} aria-label="Presupuestos; seleccionar para ampliar" className={`finance-bento-preview-tile finance-bento-preview-budgets${focusedPanel === "budgets" ? " is-focused" : ""}`} onClick={(event) => { if (!(event.target as HTMLElement).closest("button,a")) focusPanel("budgets", event.currentTarget); }} onKeyDown={(event) => { if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); focusPanel("budgets", event.currentTarget); } }}>
            <div className="finance-bento-preview-label">03 / PRESUPUESTOS</div>
            <h3>Presupuestos en tensión</h3>
            <div className="finance-bento-preview-budget-list">
              {budgetSamples.map((item) => <div key={item.label}>
                <span>{item.label}</span><i><b className={`is-${item.tone}`} style={{ width: item.width }} /></i><small>{item.value}</small>
              </div>)}
            </div>
            {focusedPanel === "budgets" && <ExpandedPanel panel="budgets" returnTo={returnTo} onClose={closePanel} />}
          </article>

          <article data-preview-panel="accounts" tabIndex={0} role="group" aria-expanded={focusedPanel === "accounts"} aria-label="Cuentas; seleccionar para ampliar" className={`finance-bento-preview-tile finance-bento-preview-accounts${focusedPanel === "accounts" ? " is-focused" : ""}`} onClick={(event) => { if (!(event.target as HTMLElement).closest("button,a")) focusPanel("accounts", event.currentTarget); }} onKeyDown={(event) => { if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); focusPanel("accounts", event.currentTarget); } }}>
            <div className="finance-bento-preview-label">04 / TU DINERO, EN TRES LUGARES</div>
            <h3>Saldo consolidado</h3>
            {accountSamples.map(([label, value], index) => <div className="finance-bento-preview-account" key={label}><span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b><strong>{value}</strong></div>)}
            {focusedPanel === "accounts" && <ExpandedPanel panel="accounts" returnTo={returnTo} onClose={closePanel} />}
          </article>

          <article data-preview-panel="movements" tabIndex={0} role="group" aria-expanded={focusedPanel === "movements"} aria-label="Movimientos; seleccionar para ampliar" className={`finance-bento-preview-tile finance-bento-preview-movements${focusedPanel === "movements" ? " is-focused" : ""}`} onClick={(event) => { if (!(event.target as HTMLElement).closest("button,a")) focusPanel("movements", event.currentTarget); }} onKeyDown={(event) => { if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); focusPanel("movements", event.currentTarget); } }}>
            <div className="finance-bento-preview-label">05 / RASTRO RECIENTE</div>
            <h3>Lo que acaba de pasar</h3>
            <div className="finance-bento-preview-timeline">
              {movementSamples.map((item) => <div key={item.label}>
                <i className={`is-${item.tone}`} /><small>{item.date}</small><b>{item.label}</b><strong>{item.amount}</strong>
              </div>)}
            </div>
            {focusedPanel === "movements" && <ExpandedPanel panel="movements" returnTo={returnTo} onClose={closePanel} />}
          </article>

          <article data-preview-panel="payments" tabIndex={0} role="group" aria-expanded={focusedPanel === "payments"} aria-label="Próximos pagos; seleccionar para ampliar" className={`finance-bento-preview-tile finance-bento-preview-payments${focusedPanel === "payments" ? " is-focused" : ""}`} onClick={(event) => { if (!(event.target as HTMLElement).closest("button,a")) focusPanel("payments", event.currentTarget); }} onKeyDown={(event) => { if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); focusPanel("payments", event.currentTarget); } }}>
            <div className="finance-bento-preview-label">06 / A LA VUELTA</div>
            <h3>Próximos pagos</h3>
            <div className="finance-bento-preview-payment"><b>OCT<br /><strong>02</strong></b><span>Internet hogar<small>SERVICIOS</small></span><strong>$119.900</strong></div>
            <div className="finance-bento-preview-payment"><b>OCT<br /><strong>05</strong></b><span>Tarjeta crédito<small>COMPROMISOS</small></span><strong>$640.000</strong></div>
            {focusedPanel === "payments" && <ExpandedPanel panel="payments" returnTo={returnTo} onClose={closePanel} />}
          </article>
        </div>
      </div>
      <footer className="finance-bento-preview-foot"><span>FINANCESYSTEM / TU HISTORIA, EN MOVIMIENTO</span><span>{focusedPanel ? "ESC PARA VOLVER" : "SELECCIONA UNA TARJETA"}</span></footer>
    </section>
  );
}

function ExpandedPanel({ panel: id, returnTo, onClose }: { panel: PreviewPanel; returnTo: string; onClose: () => void }) {
  const panel = panels.find((candidate) => candidate.id === id)!;
  return <div className="finance-bento-preview-expanded" role="region" aria-label={`Detalle ampliado: ${panel.title}`}>
    <div className="finance-bento-preview-expanded-head">
      <div><small>LECTURA DETALLADA · VISTA DE MUESTRA</small><h3>{panel.title}</h3><p>{panel.summary}</p></div>
      <button type="button" aria-label="Contraer panel" onClick={(event) => { event.stopPropagation(); onClose(); }}>Contraer</button>
    </div>
    <div className="finance-bento-preview-expanded-rows">
      {panel.details.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}
    </div>
    <a className="finance-bento-preview-expanded-cta" href={buildAuthUrl(returnTo)}>ENTRAR PARA GESTIONAR TUS DATOS <span aria-hidden="true">↗</span></a>
  </div>;
}
