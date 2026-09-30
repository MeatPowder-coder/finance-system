"use client";

import { ArrowDownRight, ArrowRight, ChartNoAxesCombined, LockKeyhole, WalletCards } from "lucide-react";
import { ThemeSelector } from "@/components/ThemeSelector";

type WelcomeScreenProps = {
  returnTo: string;
  apiBaseUrl: string;
};

const COPY = {
  eyebrow: "FinanceSystem",
  title: "Tu dinero. Tu ritmo.",
  description: "Entra a un espacio silencioso para registrar, revisar y planear sin distracciones.",
  note: "Empieza cuando quieras. Todo queda listo para continuar.",
};

function buildAuthUrl(mode: "login" | "register", returnTo: string) {
  const params = new URLSearchParams({ auth: "login", returnTo });
  if (mode === "register") params.set("mode", "register");
  return `/?${params.toString()}`;
}

function WelcomeActions({ returnTo }: { returnTo: string }) {
  return (
    <div className="welcome-actions welcome-actions-quiet">
      <a href={buildAuthUrl("login", returnTo)} className="welcome-button welcome-button-primary">
        Entrar <ArrowRight className="h-4 w-4" />
      </a>
      <a href={buildAuthUrl("register", returnTo)} className="welcome-button welcome-button-secondary">
        Crear cuenta
      </a>
    </div>
  );
}

export default function WelcomeScreenQuiet({ returnTo, apiBaseUrl }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen welcome-screen-quiet">
      <div className="welcome-orb welcome-orb-one" aria-hidden="true" />
      <div className="welcome-orb welcome-orb-two" aria-hidden="true" />
      <div className="welcome-grain" aria-hidden="true" />

      <main className="welcome-stage">
        <header className="welcome-topbar">
          <a href="/" className="welcome-brand" aria-label="FinanceSystem">
            <span className="welcome-brand-mark"><WalletCards className="h-5 w-5" /></span>
            <span>FinanceSystem</span>
          </a>
          <div className="welcome-connection" aria-label="FinanceSystem está listo para iniciar sesión">
            <span className="welcome-connection-dot" />
            <span>Tu espacio financiero</span>
          </div>
          <div className="welcome-theme-picker" aria-label="Paleta de colores"><span>Paleta</span><ThemeSelector collapsed /></div>
        </header>

        <section className="welcome-quiet-layout welcome-editorial-layout" aria-labelledby="welcome-title">
          <div className="welcome-editorial-main quiet-panel">
            <div className="welcome-editorial-kicker quiet-panel-kicker">
              <span className="quiet-panel-mark"><WalletCards className="h-5 w-5" /></span>
              <span>{COPY.eyebrow}<span className="welcome-editorial-est"> · PRIVATE FINANCE / EST. 2026</span></span>
            </div>
            <h1 id="welcome-title">Tu dinero.<br /><span>Tu ritmo.</span></h1>
            <p className="welcome-description">Un espacio claro para entender tus movimientos, organizar tus planes y decidir con calma.</p>
            <WelcomeActions returnTo={returnTo} />
            <div className="quiet-panel-note"><span /> {COPY.note}</div>
          </div>

          <aside className="welcome-editorial-art" aria-label="Vista previa de tus finanzas">
            <div className="welcome-editorial-art-top">
              <span>VISTA GENERAL</span>
              <span className="welcome-editorial-lock"><LockKeyhole className="h-3.5 w-3.5" /> PRIVADO</span>
            </div>
            <div className="welcome-editorial-balance">
              <span>Tu panorama, en un solo lugar</span>
              <strong>Más claridad.<br />Menos ruido.</strong>
            </div>
            <div className="welcome-editorial-chart" aria-hidden="true">
              <div className="welcome-editorial-chart-label"><span>FLUJO DEL MES</span><ArrowDownRight className="h-4 w-4" /></div>
              <div className="welcome-editorial-bars">
                {[42, 59, 48, 76, 63, 91, 70, 100, 79, 88, 68, 96].map((height, index) => (
                  <span key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className="welcome-editorial-chart-foot"><span>INGRESOS</span><span>GASTOS</span><span>PLANES</span></div>
            </div>
            <div className="welcome-editorial-art-stamp" aria-hidden="true"><ChartNoAxesCombined className="h-5 w-5" /><span>FINANZAS<br />A TU MANERA</span></div>
          </aside>

          <div className="welcome-editorial-stats" aria-label="Lo que puedes hacer">
            <div className="welcome-editorial-stat"><span>01</span><strong>Ver con claridad</strong><small>Ingresos, gastos y cuentas, reunidos.</small></div>
            <div className="welcome-editorial-stat"><span>02</span><strong>Planear a tu ritmo</strong><small>Metas que se sienten alcanzables.</small></div>
            <div className="welcome-editorial-stat"><span>03</span><strong>Privacidad primero</strong><small>Un acceso seguro para web y desktop.</small></div>
          </div>
        </section>

        <footer className="welcome-footer">
          <span className="welcome-footer-security"><LockKeyhole className="h-3.5 w-3.5" /> Acceso seguro para web y desktop</span>
          <span className="welcome-footer-url" title={apiBaseUrl || "Conexión local"}>{apiBaseUrl || "Conexión local"}</span>
        </footer>
      </main>
    </div>
  );
}
