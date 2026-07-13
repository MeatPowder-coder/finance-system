"use client";

import { useEffect, useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveFinanceApiBaseUrl } from "@/lib/runtime-config";

type ConnectionState = "checking" | "online" | "offline";

export function BackendStatusPill() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    const rawBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100").trim();
    const resolvedBaseUrl = resolveFinanceApiBaseUrl(rawBaseUrl);
    setBaseUrl(rawBaseUrl.startsWith("/") ? `${rawBaseUrl} (same-origin proxy)` : resolvedBaseUrl);

    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(`${resolvedBaseUrl}/health`, { cache: "no-store" });
        if (!cancelled) {
          setState(res.ok ? "online" : "offline");
        }
      } catch {
        if (!cancelled) {
          setState("offline");
        }
      }
    }

    void checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            state === "online" ? "bg-emerald-400" : state === "offline" ? "bg-rose-400" : "bg-amber-400"
          )}
        />
        {state === "checking" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" /> : <Globe className="h-3.5 w-3.5 text-cyan-300" />}
        <span className="font-medium text-zinc-100">
          {state === "online" ? "Backend conectado" : state === "offline" ? "Backend no responde" : "Verificando backend"}
        </span>
      </div>
      <div className="mt-1 truncate text-[11px] text-zinc-500">{baseUrl || "Backend no configurado"}</div>
    </div>
  );
}
