"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CloudOff, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAuthSession } from "@/lib/auth";
import {
  buildFinanceHeaders,
  readFinanceAuthToken,
  resolveFinanceApiBaseUrl,
} from "@/lib/runtime-config";
import WelcomeScreen from "@/components/WelcomeScreenQuiet";
import { ThemeSelector } from "@/components/ThemeSelector";

type GateState = "checking" | "offline" | "unauthenticated" | "authenticated";

type EntryGateProps = {
  children: React.ReactNode;
};

function displayApiBaseUrl(value: string) {
  return value.startsWith("/") ? `${value} (proxy same-origin)` : value || "Backend no configurado";
}

function ConnectionScreen({ apiBaseUrl, message, retry }: { apiBaseUrl: string; message: string; retry: () => void }) {
  return (
    <div className="entry-connection-screen">
      <div className="entry-connection-glow" aria-hidden="true" />
      <div className="entry-connection-card">
        <div className="entry-connection-theme"><span>Paleta</span><ThemeSelector collapsed /></div>
        <div className="entry-connection-icon"><CloudOff className="h-6 w-6" /></div>
        <span className="welcome-eyebrow"><ShieldCheck className="h-3.5 w-3.5" /> FinanceSystem</span>
        <h1>No pudimos conectar tu espacio.</h1>
        <p>{message}</p>
        <div className="entry-connection-detail">
          <span className="entry-connection-dot entry-connection-dot-offline" />
          <span>{displayApiBaseUrl(apiBaseUrl)}</span>
        </div>
        <Button type="button" onClick={retry} className="entry-connection-button">
          <RefreshCw className="h-4 w-4" /> Reintentar conexion
        </Button>
      </div>
    </div>
  );
}

export default function EntryGate({ children }: EntryGateProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const authMode = searchParams.get("auth");
  const isAuthScreen = authMode === "login" || authMode === "callback" || pathname.startsWith("/auth/");
  const returnTo = useMemo(() => {
    if (pathname === "/chat") return "/?tab=copilot";
    if (pathname !== "/") return "/?tab=dashboard";

    const returnParams = new URLSearchParams(searchParams.toString());
    returnParams.delete("welcomeVariant");
    returnParams.delete("auth");
    returnParams.delete("mode");
    return `/${returnParams.toString() ? `?${returnParams.toString()}` : ""}`;
  }, [pathname, searchParams]);
  const [state, setState] = useState<GateState>("checking");
  const [message, setMessage] = useState("Estamos preparando tu espacio privado.");
  const [retryKey, setRetryKey] = useState(0);
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";
  const apiBaseUrl = useMemo(
    () => resolveFinanceApiBaseUrl(configuredApiBaseUrl),
    [configuredApiBaseUrl]
  );

  useEffect(() => {
    if (isAuthScreen) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    let cancelled = false;

    async function checkEntry() {
      setState("checking");
      setMessage("Estamos preparando tu espacio privado.");

      try {
        const healthResponse = await fetch(`${apiBaseUrl}/health`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!healthResponse.ok) throw new Error(`Healthcheck HTTP ${healthResponse.status}`);
        if (!healthResponse.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Healthcheck no devolvió JSON de Finance System API.");
        }
        const healthPayload = await healthResponse.json();
        if (healthPayload?.ok !== true) throw new Error("Finance System API no confirmó disponibilidad.");

        const authConfigResponse = await fetch(`${apiBaseUrl}/v1/auth/config`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!authConfigResponse.ok) throw new Error(`Auth config HTTP ${authConfigResponse.status}`);
        if (!authConfigResponse.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Auth config no devolvió JSON de Finance System API.");
        }
        await authConfigResponse.json();
        if (cancelled) return;

        const token = readFinanceAuthToken();
        if (!token) {
          setState("unauthenticated");
          return;
        }

        const sessionResponse = await fetch(`${apiBaseUrl}/v1/auth/me`, {
          cache: "no-store",
          headers: buildFinanceHeaders(),
          signal: controller.signal,
        });

        if (cancelled) return;
        if (sessionResponse.status === 401) {
          clearAuthSession();
          setState("unauthenticated");
          return;
        }
        if (!sessionResponse.ok) throw new Error(`Sesion HTTP ${sessionResponse.status}`);
        setState("authenticated");
      } catch (entryError) {
        if (cancelled) return;
        setState("offline");
        setMessage(entryError instanceof Error && entryError.name === "AbortError"
          ? "La conexion esta tardando mas de lo esperado. Revisa que la API este encendida."
          : "El backend no responde o aun no esta listo. Puedes reintentar cuando este disponible.");
      }
    }

    void checkEntry();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [apiBaseUrl, isAuthScreen, retryKey]);

  if (isAuthScreen) return <>{children}</>;
  if (state === "authenticated") return <>{children}</>;
  if (state === "offline") {
    return <ConnectionScreen apiBaseUrl={configuredApiBaseUrl} message={message} retry={() => setRetryKey((value) => value + 1)} />;
  }
  if (state === "unauthenticated") {
    return <WelcomeScreen returnTo={returnTo} apiBaseUrl={displayApiBaseUrl(configuredApiBaseUrl)} />;
  }

  return (
    <div className="entry-checking-screen">
      <div className="entry-checking-mark"><Loader2 className="h-5 w-5 animate-spin" /></div>
      <p>Preparando FinanceSystem</p>
    </div>
  );
}
