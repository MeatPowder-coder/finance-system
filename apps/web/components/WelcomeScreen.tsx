"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  CircleDollarSign,
  LockKeyhole,
  MoveRight,
  Sparkles,
  WalletCards,
  Waves,
} from "lucide-react";

export type WelcomeVariant = "foggy" | "calm" | "quiet";

type WelcomeScreenProps = {
  variant: WelcomeVariant;
  returnTo: string;
  apiBaseUrl: string;
};

const VARIANT_COPY: Record<WelcomeVariant, {
  eyebrow: string;
  title: string;
  description: string;
  note: string;
}> = {
  foggy: {
    eyebrow: "Tu espacio financiero privado",
    title: "Tus finanzas, en calma.",
    description: "Una vista clara para entender tu mes, cuidar tu liquidez y decidir con menos ruido.",
    note: "Simple para el dia a dia. Profundo cuando lo necesitas.",
  },
  calm: {
    eyebrow: "Entiende tu mes",
    title: "Decide mejor con lo que ya tienes.",
    description: "Organiza cuentas, movimientos y planes en un solo lugar, con una lectura que se siente humana.",
    note: "Tus datos se mantienen privados y separados por cuenta.",
  },
  quiet: {
    eyebrow: "FinanceSystem",
    title: "Tu dinero. Tu ritmo.",
    description: "Entra a un espacio silencioso para registrar, revisar y planear sin distracciones.",
    note: "Empieza cuando quieras. Todo queda listo para continuar.",
  },
};

function buildAuthUrl(mode: "login" | "register", returnTo: string) {
  const params = new URLSearchParams({ auth: "login", returnTo });
  if (mode === "register") params.set("mode", "register");
  return `/?${params.toString()}`;
}

function WelcomeActions({ returnTo, quiet = false }: { returnTo: string; quiet?: boolean }) {
  return (
    <div className={`welcome-actions${quiet ? " welcome-actions-quiet" : ""}`}>
      <a href={buildAuthUrl("login", returnTo)} className="welcome-button welcome-button-primary">
        Entrar <ArrowRight className="h-4 w-4" />
      </a>
      <a href={buildAuthUrl("register", returnTo)} className="welcome-button welcome-button-secondary">
        Crear cuenta
      </a>
    </div>
  );
}

/*

          <p>Lee lo que está pasando en tu mes.</p>
        </article>
        <div className="calm-flow-center">
          <span>FINANCES</span>
          <strong>en equilibrio</strong>
          <div className="calm-flow-orbit"><span /><span /><span /></div>
        </div>
        <article className="calm-flow-step calm-flow-step-two">
          <span className="calm-flow-number">02</span>
          <ArrowUpRight className="calm-flow-icon" />
          <strong>Decide</strong>
          <p>Planea con información real.</p>
        </article>
        <article className="calm-flow-step calm-flow-step-three">
          <span className="calm-flow-number">03</span>
          <MoveRight className="calm-flow-icon" />
          <strong>Avanza</strong>
          <p>Haz espacio para lo importante.</p>
        </article>
      </div>
    </section>
  );
}

*/

/*
function QuietWelcome({ copy, returnTo }: { copy: (typeof VARIANT_COPY)["quiet"]; returnTo: string }) {
  return (
    <section className="welcome-quiet-layout">
      <div className="quiet-side-label">PRIVATE FINANCE<br /><span>EST. 2026</span></div>
      <div className="quiet-panel">
        <div className="quiet-panel-mark"><WalletCards className="h-5 w-5" /></div>
        <div className="quiet-panel-kicker">{copy.eyebrow}</div>
        <h1>{copy.title}</h1>
        <p className="welcome-description">{copy.description}</p>
        <WelcomeActions returnTo={returnTo} quiet />
        <div className="quiet-panel-note"><span /> {copy.note}</div>
      </div>
      <div className="quiet-side-note">Tu información permanece<br />contigo y sólo contigo.</div>
    </section>
  );
}
*/

/*
export function WelcomeScreen({ variant, returnTo, apiBaseUrl }: WelcomeScreenProps) {
  const copy = VARIANT_COPY[variant];

  return (
    <div className={`welcome-screen welcome-screen-${variant}`}>
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

        {variant === "foggy" && <FoggyWelcome copy={copy} returnTo={returnTo} />}
        {variant === "calm" && <CalmWelcome copy={copy} returnTo={returnTo} />}
        {variant === "quiet" && <QuietWelcome copy={copy} returnTo={returnTo} />}

        <footer className="welcome-footer">
          <span>Acceso seguro para web y desktop</span>
          <span className="welcome-footer-url">{apiBaseUrl || "Conexion local"}</span>
        </footer>
      </main>
    </div>
  );
}
*/
