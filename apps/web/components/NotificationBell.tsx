"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildFinanceHeaders, resolveFinanceApiBaseUrl } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

const API_BASE = resolveFinanceApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");

async function requestNotifications<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: buildFinanceHeaders({ "Content-Type": "application/json", ...(init?.headers || {}) }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return payload.data as T;
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function typeLabel(type: string) {
  if (type === "FRIEND_REQUEST") return "Amistades";
  if (type === "SHARE_INVITATION" || type === "SHARE_ACCEPTED") return "Finanzas compartidas";
  if (type === "AGENT_TASK" || type === "AGENT_PROPOSAL") return "Copilot";
  return "FinanceSystem";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    try {
      const [latest, count] = await Promise.all([
        requestNotifications<NotificationItem[]>("/v1/notifications?limit=12"),
        requestNotifications<{ count: number }>("/v1/notifications/unread-count"),
      ]);
      setItems(latest || []);
      setUnreadCount(count?.count || 0);
    } catch {
      // The bell stays quiet when the session is being restored or the API is offline.
    }
  }

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function markRead(id: string) {
    setLoading(true);
    try {
      await requestNotifications(`/v1/notifications/${id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item));
      setUnreadCount((current) => Math.max(0, current - (items.find((item) => item.id === id)?.read_at ? 0 : 1)));
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    setLoading(true);
    try {
      await requestNotifications("/v1/notifications/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pointer-events-none fixed right-16 top-4 z-[45]">
      <div className="relative pointer-events-auto">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-10 w-10 rounded-full border-border/80 bg-card/85 text-foreground shadow-lg shadow-black/10 backdrop-blur-xl hover:bg-accent"
          aria-label={unreadCount ? `${unreadCount} notificaciones sin leer` : "Notificaciones"}
          onClick={() => setOpen((current) => !current)}
        >
          <Bell className={cn("h-4 w-4 transition-transform", open && "rotate-[-12deg]")} />
          {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </Button>

        {open && (
          <div className="absolute right-0 top-12 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-2xl shadow-black/20 backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div><p className="text-sm font-semibold">Notificaciones</p><p className="text-xs text-muted-foreground">Solicitudes, accesos y tareas de Copilot.</p></div>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => void markAllRead()} disabled={loading || unreadCount === 0}><CheckCheck className="h-3.5 w-3.5" /> Leer todo</Button>
            </div>
            <div className="max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto p-2">
              {loading && !items.length && <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>}
              {!loading && !items.length && <div className="p-8 text-center text-sm text-muted-foreground"><Bell className="mx-auto mb-2 h-5 w-5 opacity-50" />Todo tranquilo por ahora.</div>}
              {items.map((item) => {
                const content = <div className={cn("rounded-xl p-3 transition-colors hover:bg-accent/70", !item.read_at && "bg-primary/8")}>
                  <div className="flex items-start gap-3"><span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", item.read_at ? "bg-muted-foreground/30" : "bg-primary")} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{typeLabel(item.notification_type)}</p><span className="shrink-0 text-[10px] text-muted-foreground">{formatNotificationDate(item.created_at)}</span></div><p className="mt-1 text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p></div>{!item.read_at && <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Marcar como leida" onClick={() => void markRead(item.id)}><Check className="h-3.5 w-3.5" /></button>}</div>
                </div>;
                return item.action_url ? <Link key={item.id} href={item.action_url} onClick={() => { if (!item.read_at) void markRead(item.id); setOpen(false); }} className="block">{content}</Link> : <div key={item.id}>{content}</div>;
              })}
            </div>
            <div className="border-t border-border px-4 py-2"><Link href="/?tab=settings" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Ver actividad y accesos <ExternalLink className="h-3 w-3" /></Link></div>
          </div>
        )}
      </div>
    </div>
  );
}

