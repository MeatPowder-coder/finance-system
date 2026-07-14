"use client";

import { ArrowRight, WalletCards } from "lucide-react";

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
          <div className="welcome-connection">
            <span className="welcome-connection-dot" />
            <span>Backend conectado</span>
          </div>
        </header>

        <section className="welcome-quiet-layout">
          <div className="quiet-side-label">PRIVATE FINANCE<br /><span>EST. 2026</span></div>
          <div className="quiet-panel">
            <div className="quiet-panel-mark"><WalletCards className="h-5 w-5" /></div>
            <div className="quiet-panel-kicker">{COPY.eyebrow}</div>
            <h1>{COPY.title}</h1>
            <p className="welcome-description">{COPY.description}</p>
            <WelcomeActions returnTo={returnTo} />
            <div className="quiet-panel-note"><span /> {COPY.note}</div>
          </div>
          <div className="quiet-side-note">Tu información permanece<br />contigo y sólo contigo.</div>
        </section>

        <footer className="welcome-footer">
          <span>Acceso seguro para web y desktop</span>
          <span className="welcome-footer-url">{apiBaseUrl || "Conexión local"}</span>
        </footer>
      </main>
    </div>
  );
}
