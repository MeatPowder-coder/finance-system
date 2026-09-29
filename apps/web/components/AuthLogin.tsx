"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChartNoAxesCombined, Chrome, Compass, Loader2, Lock, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  clearAuthSession,
  clearStoredAuthFlow,
  createGoogleLoginFlow,
  exchangeGoogleAuthorizationCode,
  fetchAuthConfig,
  getStoredAuthFlow,
  loginWithEmailPassword,
  persistAuthTokens,
  registerWithEmailPassword,
} from "@/lib/auth";
import { buildFinanceHeaders, readFinanceAuthToken, resolveFinanceApiBaseUrl } from "@/lib/runtime-config";

type AuthMode = "login" | "register";

const INTERNAL_TABS = new Set(["dashboard", "accounts", "transactions", "reports", "investments", "planning", "copilot"]);

function normalizeReturnTo(rawValue: string | null | undefined) {
  const fallback = "/?tab=dashboard";
  const value = (rawValue || "").trim();
  if (!value) return fallback;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;

    if (url.pathname === "/chat") {
      return "/?tab=copilot";
    }

    if (url.pathname !== "/") {
      return fallback;
    }

    const tab = url.searchParams.get("tab");
    if (!tab) {
      return "/";
    }

    if (!INTERNAL_TABS.has(tab)) {
      return fallback;
    }

    return `/?tab=${tab}`;
  } catch {
    return fallback;
  }
}

export function AuthLoginScreen() {
  const searchParams = useSearchParams();
  const requestedAuthMode: AuthMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [authMode, setAuthMode] = useState<AuthMode>(requestedAuthMode);
  const [configLoading, setConfigLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState("FinanceSystem");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [googleCaption, setGoogleCaption] = useState("Continuar con Google");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const returnTo = useMemo(() => normalizeReturnTo(searchParams.get("returnTo")), [searchParams]);

  useEffect(() => {
    setAuthMode(requestedAuthMode);
  }, [requestedAuthMode]);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const config = await fetchAuthConfig();
        if (cancelled) return;
        setAppName(config.appName || "FinanceSystem");
        setGoogleEnabled(Boolean(config.googleEnabled));
        setEmailEnabled(Boolean(config.emailPasswordEnabled));
        setGoogleCaption(config.googleEnabled ? "Continuar con Google" : "Google no configurado");
        setError(config.enabled ? null : "La autenticacion no esta configurada en la API.");
      } catch (configError) {
        if (cancelled) return;
        setError(configError instanceof Error ? configError.message : "No se pudo cargar la configuracion de acceso.");
        setGoogleEnabled(false);
        setEmailEnabled(false);
        setGoogleCaption("Google no disponible");
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const authToken = readFinanceAuthToken();
    if (!authToken) return;

    let cancelled = false;
    const apiBaseUrl = resolveFinanceApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");

    async function validateCurrentSession() {
      try {
        const res = await fetch(`${apiBaseUrl}/v1/auth/me`, {
          cache: "no-store",
          headers: buildFinanceHeaders(),
        });

        if (!cancelled && res.ok) {
          window.location.replace(returnTo);
          return;
        }

        if (!cancelled) {
          clearAuthSession();
        }
      } catch {
        if (!cancelled) {
          clearAuthSession();
        }
      }
    }

    void validateCurrentSession();

    return () => {
      cancelled = true;
    };
  }, [returnTo]);

  async function handleGoogleLogin() {
    setGoogleBusy(true);
    setError(null);
    try {
      const authUrl = await createGoogleLoginFlow({ returnTo });
      window.location.assign(authUrl);
    } catch (loginError) {
      console.error(loginError);
      setError(loginError instanceof Error ? loginError.message : "No se pudo abrir Google.");
      setGoogleBusy(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const payload = {
        email: form.email,
        password: form.password,
      };

      const result =
        authMode === "login"
          ? await loginWithEmailPassword(payload)
          : await registerWithEmailPassword({ ...payload, name: form.name });

      persistAuthTokens(result.tokens);
      window.location.replace(returnTo);
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "No se pudo completar el acceso.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen auth-screen-quiet">
      <div className="auth-screen-orb auth-screen-orb-one" aria-hidden="true" />
      <div className="auth-screen-orb auth-screen-orb-two" aria-hidden="true" />
      <main className="auth-editorial-layout">
        <aside className="auth-editorial-aside" aria-label="FinanceSystem, finanzas personales con claridad">
          <a href="/" className="auth-editorial-brand" aria-label="Volver al inicio de FinanceSystem">
            <span><WalletCards className="h-5 w-5" /></span> FinanceSystem
          </a>
          <div className="auth-editorial-aside-copy">
            <div className="auth-editorial-eyebrow"><Sparkles className="h-3.5 w-3.5" /> UN ESPACIO PARA TI</div>
            <h1>Que tus finanzas<br /><em>tengan sentido.</em></h1>
            <p>Revisa lo que entra, lo que sale y lo que quieres construir, con una mirada más clara.</p>
          </div>
          <div className="auth-editorial-preview" aria-hidden="true">
            <div className="auth-editorial-preview-head"><span>MAPA FINANCIERO</span><span>01 / 03</span></div>
            <div className="auth-editorial-preview-title"><span>Un buen plan</span><strong>empieza por<br />entender el hoy.</strong></div>
            <div className="auth-editorial-mini-chart"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="auth-editorial-preview-foot"><span><ChartNoAxesCombined className="h-4 w-4" /> VISIÓN COMPLETA</span><span className="auth-editorial-preview-arrow"><ArrowRight className="h-4 w-4" /></span></div>
          </div>
          <div className="auth-editorial-aside-foot"><LockKeyhole className="h-4 w-4" /> Tu espacio financiero, protegido.</div>
        </aside>

        <Card className="auth-card auth-editorial-card relative w-full">
          <CardHeader className="space-y-4">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
              <Compass className="h-3.5 w-3.5" />
              {authMode === "login" ? `Bienvenido a ${appName}` : `Comienza con ${appName}`}
            </div>
            <div>
              <CardTitle className="text-3xl text-zinc-50">{authMode === "login" ? "Qué bueno verte." : "Tu próximo capítulo."}</CardTitle>
              <CardDescription className="mt-2 text-base text-zinc-400">
                {authMode === "login"
                  ? "Entra a tu espacio y continúa justo donde lo dejaste."
                  : "Crea tu espacio para organizar tus finanzas a tu manera."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
          <div className={`auth-access-note auth-access-note-${authMode} rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-50`}>
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" />
              {authMode === "login" ? "Un solo acceso para toda la app" : "Un solo espacio para tus finanzas"}
            </div>
            <p className="mt-2 text-cyan-100/90">
              {authMode === "login"
                ? "Después del login volverás exactamente al lugar donde estabas trabajando."
                : "Tu sesión estará lista para continuar desde web y desktop."}
            </p>
          </div>

          <div className="grid gap-3">
            <Button
              type="button"
              onClick={() => void handleGoogleLogin()}
              disabled={configLoading || googleBusy || !googleEnabled}
              className="h-12 gap-2 text-base"
            >
              {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
              {googleCaption}
            </Button>
          </div>

          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-zinc-500">
            <span className="h-px flex-1 bg-zinc-800" />
            <span>o usa correo</span>
            <span className="h-px flex-1 bg-zinc-800" />
          </div>

          <div className="auth-mode-tabs flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              aria-pressed={authMode === "login"}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                authMode === "login"
                  ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/40"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              )}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("register")}
              aria-pressed={authMode === "register"}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                authMode === "register"
                  ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/40"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              )}
            >
              Crear cuenta
            </button>
          </div>

          <form key={authMode} className={`auth-form auth-form-${authMode} space-y-4`} onSubmit={(event) => void handleEmailSubmit(event)}>
            {authMode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="auth-name" className="text-zinc-200">
                  Nombre
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    id="auth-name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Tu nombre"
                    className="h-12 border-zinc-800 bg-zinc-950 pl-10 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="auth-email" className="text-zinc-200">
                Direcci&oacute;n de correo electr&oacute;nico
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="auth-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  className="h-12 border-zinc-800 bg-zinc-950 pl-10 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-password" className="text-zinc-200">
                Contrase&ntilde;a
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="auth-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Tu contrase&ntilde;a"
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  className="h-12 border-zinc-800 bg-zinc-950 pl-10 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            </div>

            <Button type="submit" disabled={busy || configLoading || !emailEnabled} className="h-12 w-full gap-2 text-base">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {authMode === "login" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

          {error ? (
            <div role="alert" aria-live="polite" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              {error}
            </div>
          ) : (
            <div aria-live="polite" className="text-center text-xs leading-relaxed text-zinc-500">
              {configLoading
                ? "Cargando configuración de acceso..."
                : googleEnabled
                  ? "Google y correo están disponibles."
                  : "Google no está disponible todavía, pero el correo y la contraseña siguen activos."}
            </div>
          )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export function AuthCallbackScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "exchanging" | "error" | "done">("idle");
  const [message, setMessage] = useState("Validando tu sesion...");

  useEffect(() => {
    const code = searchParams.get("code") || "";
    const state = searchParams.get("state") || "";
    const error = searchParams.get("error") || "";
    const errorDescription = searchParams.get("error_description") || "";

    if (error) {
      setStatus("error");
      setMessage(errorDescription ? `${error}: ${errorDescription}` : error);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No llego el codigo de autenticacion desde Google.");
      return;
    }

    const flow = getStoredAuthFlow();
    if (!flow) {
      setStatus("error");
      setMessage("No encontre la informacion temporal del login. Vuelve a iniciar sesion.");
      return;
    }

    if (flow.state !== state) {
      setStatus("error");
      setMessage("El estado de seguridad no coincide. Vuelve a intentar el login.");
      clearStoredAuthFlow();
      return;
    }

    setStatus("exchanging");
    setMessage("Intercambiando credenciales con el backend...");

    void exchangeGoogleAuthorizationCode({
      code,
      codeVerifier: flow.codeVerifier,
      redirectUri: flow.redirectUri,
      state,
    })
      .then((result) => {
        persistAuthTokens(result.tokens);
        clearStoredAuthFlow();
        setStatus("done");
        setMessage("Sesion iniciada. Abriendo el sistema...");
        window.setTimeout(() => {
        window.location.replace(normalizeReturnTo(flow.returnTo));
      }, 600);
      })
      .catch((callbackError: unknown) => {
        console.error(callbackError);
        clearAuthSession();
        setStatus("error");
        setMessage(callbackError instanceof Error ? callbackError.message : "No se pudo completar el login.");
      });
  }, [router, searchParams]);

  return (
    <div className="auth-screen auth-screen-quiet">
      <Card className="auth-card auth-editorial-callback w-full max-w-lg">
        <CardHeader className="space-y-4">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cerrando autenticacion
          </div>
          <div>
            <CardTitle className="text-2xl text-zinc-50">FinanceSystem</CardTitle>
            <CardDescription className="mt-2 text-base text-zinc-400">
              Estamos validando tu acceso con Google.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300">
            {status === "exchanging" ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                <span>{message}</span>
              </div>
            ) : status === "done" ? (
              <div className="flex items-center gap-3 text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                <span>{message}</span>
              </div>
            ) : status === "error" ? (
              <div className="flex items-start gap-3 text-rose-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </div>
            ) : (
              <span>{message}</span>
            )}
          </div>

          {status === "error" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                clearAuthSession();
                router.replace("/?auth=login");
              }}
            >
              Volver a intentar
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
