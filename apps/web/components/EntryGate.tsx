"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAuthSession, recoverAuthSession } from "@/lib/auth";
import {
  buildFinanceHeaders,
  financeErrorMessage,
  requestFinanceApi,
  readFinanceAuthToken,
  resolveFinanceApiBaseUrl,
} from "@/lib/runtime-config";
import WelcomeScreen from "@/components/WelcomeScreenQuiet";

type GateState = "checking" | "offline" | "unauthenticated" | "authenticated";

type EntryGateProps = {
  children: React.ReactNode;
};

function displayApiBaseUrl(value: string) {
  if (!value) return "Proxy same-origin de Finance System (/health y /v1)";
  return value.startsWith("/") ? `${value} (proxy same-origin)` : value;
}

function ConnectionBanner({ apiBaseUrl, message, retry }: { apiBaseUrl: string; message: string; retry: () => void }) {
  return (
    <div className="entry-offline-banner" role="status" aria-live="polite">
      <span className="entry-offline-indicator"><CloudOff className="h-4 w-4" /></span>
      <span className="entry-offline-copy">
        <strong>Modo sin conexión</strong>
        <span>{message} · {displayApiBaseUrl(apiBaseUrl)}</span>
      </span>
      <Button type="button" variant="outline" onClick={retry} className="entry-offline-retry">
        <RefreshCw className="h-4 w-4" /> Reintentar
      </Button>
    </div>
  );
}

export default function EntryGate({ children }: EntryGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authMode = searchParams.get("auth");
  // Some OAuth configurations return to the origin root even when the app
  // requested /auth/callback. Keep the callback out of the welcome gate so
  // its code/state can be exchanged instead of being silently ignored.
  const hasOAuthCallback = Boolean(
    searchParams.has("state") && (searchParams.has("code") || searchParams.has("error"))
  );
  const isAuthScreen = authMode === "login" || authMode === "callback" || pathname.startsWith("/auth/") || hasOAuthCallback;
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
  const offlineRef = useRef(false);
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
      offlineRef.current = false;
      setMessage("Estamos preparando tu espacio privado.");

      try {
        const healthResponse = await requestFinanceApi(`${apiBaseUrl}/health`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!healthResponse.ok) throw new Error(`Healthcheck HTTP ${healthResponse.status}`);
        if (!healthResponse.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Healthcheck no devolvió JSON de Finance System API.");
        }
        const healthPayload = await healthResponse.json();
        if (healthPayload?.ok !== true) throw new Error("Finance System API no confirmó disponibilidad.");

        const authConfigResponse = await requestFinanceApi(`${apiBaseUrl}/v1/auth/config`, {
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

        const sessionResponse = await requestFinanceApi(`${apiBaseUrl}/v1/auth/me`, {
          cache: "no-store",
          headers: buildFinanceHeaders(),
          signal: controller.signal,
        });

        if (cancelled) return;
        if (sessionResponse.status === 401) {
          if (await recoverAuthSession()) {
            const retryResponse = await requestFinanceApi(`${apiBaseUrl}/v1/auth/me`, {
              cache: "no-store",
              headers: buildFinanceHeaders(),
              signal: controller.signal,
            });
            if (cancelled) return;
            if (retryResponse.ok) {
              setState("authenticated");
              return;
            }
          }
          if (cancelled) return;
          clearAuthSession();
          const loginUrl = new URLSearchParams({
            auth: "login",
            authError: "session-rejected",
            returnTo,
          });
          router.replace(`/?${loginUrl.toString()}`);
          return;
        }
        if (!sessionResponse.ok) throw new Error(`Sesion HTTP ${sessionResponse.status}`);
        setState("authenticated");
      } catch (entryError) {
        if (cancelled) return;
        offlineRef.current = true;
        setState("offline");
        const detail = entryError instanceof Error && entryError.name === "AbortError"
          ? "La comprobación superó 7 segundos. Revisa que la API y su proxy estén encendidos."
          : financeErrorMessage(entryError, "No se pudo comprobar el estado de la API.");
        setMessage(`Falló la comprobación de /health · ${detail}`);
      }
    }

    const retryIfOffline = () => {
      if (cancelled || !offlineRef.current || document.visibilityState !== "visible") return;
      setRetryKey((value) => value + 1);
    };

    // A local API can restart independently from this page. Retry in the
    // background and on network recovery/focus so the offline banner clears
    // without requiring a full page reload.
    window.addEventListener("online", retryIfOffline);
    window.addEventListener("focus", retryIfOffline);
    const retryInterval = window.setInterval(retryIfOffline, 15000);

    void checkEntry();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      window.clearInterval(retryInterval);
      window.removeEventListener("online", retryIfOffline);
      window.removeEventListener("focus", retryIfOffline);
    };
  }, [apiBaseUrl, isAuthScreen, retryKey, returnTo, router]);

  if (isAuthScreen) return <>{children}</>;
  if (state === "authenticated") return <>{children}</>;
  if (state === "offline") {
    if (!readFinanceAuthToken()) {
      return <>
        <WelcomeScreen returnTo={returnTo} apiBaseUrl={displayApiBaseUrl(apiBaseUrl)} />
        <ConnectionBanner apiBaseUrl={apiBaseUrl} message={message} retry={() => setRetryKey((value) => value + 1)} />
      </>;
    }
    return <>
      {children}
      <ConnectionBanner apiBaseUrl={apiBaseUrl} message={message} retry={() => setRetryKey((value) => value + 1)} />
    </>;
  }
  if (state === "unauthenticated") {
    return <WelcomeScreen returnTo={returnTo} apiBaseUrl={displayApiBaseUrl(apiBaseUrl)} />;
  }

  return (
    <div className="entry-checking-screen">
      <div className="entry-checking-mark"><Loader2 className="h-5 w-5 animate-spin" /></div>
      <p>Preparando FinanceSystem</p>
    </div>
  );
}
