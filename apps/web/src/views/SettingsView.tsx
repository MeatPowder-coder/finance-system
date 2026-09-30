"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Link2, Loader2, Lock, Mail, RefreshCw, Search, Shield, UserCheck, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeSelector } from "@/components/ThemeSelector";
import { buildFinanceHeaders, requestFinanceApi, resolveFinanceApiBaseUrl } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

type Permission = "READ" | "WRITE" | "UPLOAD" | "ANALYZE";
type ResourceType = "ACCOUNT" | "BUDGET" | "COMMITMENT" | "PROJECTION" | "DEFICIT" | "REPORT";
type ResourceItem = { resourceType: ResourceType; resourceId: string; label: string; detail?: string };

type Profile = {
  id: string;
  email: string;
  username: string;
  name: string | null;
  auth_provider: string;
};

type Integrations = {
  mastra: { enabled: boolean; mode: string; capabilities: string[] };
  mcp: { enabled: boolean; path: string; toolCount: number; capabilities: string[]; mode: string };
  hermes: { enabled: boolean; configured: boolean; mode: string; capabilities: string[] };
};

type Catalog = {
  accounts: Array<{ id: number; name: string; currency: string; balance_current: string | number }>;
  budgets: Array<{ id: number; name: string; period: string; currency: string; start_date: string; end_date: string }>;
  commitments: Array<{ id: string | number; name: string; cadence: string; next_run_at: string | null; is_active: boolean }>;
  projections: Array<{ id: string; title: string; scenario_type: string; created_at: string }>;
  deficits: Array<{ id: string | number; budget_name: string; period_month: string; event_type: string; deficit_amount: string | number; cause_code: string }>;
  reports: Array<{ id: string; title: string; slug: string | null; status: string; created_at: string }>;
};

type ShareItem = { resourceType: ResourceType; resourceId: string; permissions: Permission[] };
type Invitation = {
  id: string;
  status: string;
  message: string | null;
  expires_at: string;
  created_at: string;
  items: ShareItem[];
  invitee_username?: string;
  invitee_name?: string | null;
  owner_username?: string;
  owner_name?: string | null;
};
type Grant = {
  id: string;
  owner_user_id: string;
  grantee_user_id: string;
  owner_username: string;
  owner_name: string | null;
  grantee_username: string;
  grantee_name: string | null;
  resource_type: ResourceType;
  resource_id: string;
  permissions: Permission[];
  status: string;
};
type UserSummary = { id: string; username: string; name: string | null; picture?: string | null };
type Friend = UserSummary & { id: string; created_at: string; updated_at?: string };
type FriendRequest = UserSummary & { id: string; status: string; created_at: string; updated_at: string };

const API_BASE = resolveFinanceApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");
const PERMISSIONS: Array<{ value: Permission; label: string; hint: string }> = [
  { value: "READ", label: "Ver", hint: "Consulta datos" },
  { value: "WRITE", label: "Registrar", hint: "Crea movimientos" },
  { value: "UPLOAD", label: "Subir", hint: "Adjunta extractos" },
  { value: "ANALYZE", label: "Analizar", hint: "Usa analiticas" },
];

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await requestFinanceApi(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: buildFinanceHeaders({ "Content-Type": "application/json", ...(init?.headers || {}) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json.data as T;
}

function resourceKey(type: ResourceType, id: string | number) {
  return `${type}:${id}`;
}

function formatResourceLabel(item: ResourceItem) {
  return item.detail ? `${item.label} - ${item.detail}` : item.label;
}

export function SettingsView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [sent, setSent] = useState<Invitation[]>([]);
  const [received, setReceived] = useState<Invitation[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<{ received: FriendRequest[]; sent: FriendRequest[] }>({ received: [], sent: [] });
  const [friendUsername, setFriendUsername] = useState("");
  const [friendMatches, setFriendMatches] = useState<UserSummary[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<UserSummary | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [selected, setSelected] = useState<Record<string, Permission[]>>({});
  const [saving, setSaving] = useState(false);
  const [friendRequestAction, setFriendRequestAction] = useState<string | null>(null);
  const [friendRequestError, setFriendRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [profileData, integrationData, catalogData, sharingData, friendsData, friendRequestsData] = await Promise.all([
        apiRequest<Profile>("/v1/settings/profile"),
        apiRequest<Integrations>("/v1/settings/integrations"),
        apiRequest<Catalog>("/v1/shares/catalog"),
        apiRequest<{ sent: Invitation[]; received: Invitation[]; grants: Grant[] }>("/v1/shares"),
        apiRequest<Friend[]>("/v1/friends"),
        apiRequest<{ received: FriendRequest[]; sent: FriendRequest[] }>("/v1/friends/requests"),
      ]);
      setProfile(profileData);
      setName(profileData.name || "");
      setUsername(profileData.username || "");
      setIntegrations(integrationData);
      setCatalog(catalogData);
      setSent(sharingData.sent || []);
      setReceived(sharingData.received || []);
      setGrants(sharingData.grants || []);
      setFriends(friendsData || []);
      setFriendRequests(friendRequestsData || { received: [], sent: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la configuracion.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const resources = useMemo<ResourceItem[]>(() => {
    if (!catalog) return [];
    return [
      ...catalog.accounts.map((item) => ({ resourceType: "ACCOUNT" as const, resourceId: String(item.id), label: item.name, detail: `Cuenta ${item.currency}` })),
      ...catalog.budgets.map((item) => ({ resourceType: "BUDGET" as const, resourceId: String(item.id), label: item.name, detail: `Presupuesto ${item.start_date} a ${item.end_date}` })),
      ...catalog.commitments.map((item) => ({ resourceType: "COMMITMENT" as const, resourceId: String(item.id), label: item.name, detail: `Compromiso ${item.cadence}` })),
      ...catalog.projections.map((item) => ({ resourceType: "PROJECTION" as const, resourceId: String(item.id), label: item.title, detail: `Proyeccion ${item.scenario_type}` })),
      ...catalog.deficits.map((item) => ({ resourceType: "DEFICIT" as const, resourceId: String(item.id), label: `${item.budget_name} - ${item.event_type}`, detail: `${item.period_month} - ${item.cause_code}` })),
      ...catalog.reports.map((item) => ({ resourceType: "REPORT" as const, resourceId: String(item.id), label: item.title, detail: `Dashboard ${item.status}` })),
    ];
  }, [catalog]);

  const selectedItems = useMemo<ShareItem[]>(
    () => resources.filter((item) => selected[resourceKey(item.resourceType, item.resourceId)]?.length).map((item) => ({
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      permissions: selected[resourceKey(item.resourceType, item.resourceId)],
    })),
    [resources, selected]
  );

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await apiRequest<Profile>("/v1/settings/profile", {
        method: "PATCH",
        body: JSON.stringify({ name, username }),
      });
      setProfile(next);
      setName(next.name || "");
      setUsername(next.username || "");
      setNotice("Perfil actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function searchFriend() {
    if (friendUsername.trim().length < 3) return setFriendMatches([]);
    setSaving(true);
    setError(null);
    try {
      setFriendMatches(await apiRequest<UserSummary[]>(`/v1/friends/lookup?username=${encodeURIComponent(friendUsername.trim())}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar ese usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function sendFriendRequest() {
    if (!selectedFriend) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest("/v1/friends/requests", {
        method: "POST",
        body: JSON.stringify({ username: selectedFriend.username }),
      });
      setFriendUsername("");
      setFriendMatches([]);
      setSelectedFriend(null);
      setNotice(`Solicitud enviada a @${selectedFriend.username}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setSaving(false);
    }
  }

  async function decideFriendRequest(id: string, action: "accept" | "reject" | "cancel") {
    setSaving(true);
    setFriendRequestAction(`${id}:${action}`);
    setFriendRequestError(null);
    setError(null);
    try {
      const result = await apiRequest<{ id: string; status: string; friendshipId?: string }>(`/v1/friends/requests/${id}/${action}`, { method: "POST" });
      const request = [...friendRequests.received, ...friendRequests.sent].find((item) => item.id === id);
      const friendshipId = result.friendshipId;
      if (action === "accept" && request && friendshipId) {
        setFriends((current) => current.some((friend) => friend.id === friendshipId) ? current : [...current, { id: friendshipId, username: request.username, name: request.name, picture: request.picture, created_at: new Date().toISOString() }]);
      }
      setFriendRequests((current) => ({
        received: action === "cancel" ? current.received : current.received.filter((item) => item.id !== id),
        sent: current.sent.filter((item) => item.id !== id),
      }));
      await loadAll();
      setNotice(action === "accept" ? "Amistad aceptada." : action === "reject" ? "Solicitud rechazada." : "Solicitud cancelada.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la solicitud.";
      setFriendRequestError(message);
      setError(message);
    } finally {
      setFriendRequestAction(null);
      setSaving(false);
    }
  }

  async function removeFriend(friendshipId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/v1/friends/${friendshipId}`, { method: "DELETE" });
      if (selectedFriend?.id) setSelectedFriend(null);
      await loadAll();
      setNotice("Amistad eliminada y accesos financieros revocados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la amistad.");
    } finally {
      setSaving(false);
    }
  }

  function toggleResource(item: ResourceItem) {
    const key = resourceKey(item.resourceType, item.resourceId);
    setSelected((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: ["READ"] };
    });
  }

  function togglePermission(item: ResourceItem, permission: Permission) {
    const key = resourceKey(item.resourceType, item.resourceId);
    setSelected((current) => {
      const existing = current[key] || ["READ"];
      const nextPermissions = existing.includes(permission) ? existing.filter((value) => value !== permission) : [...existing, permission];
      if (!nextPermissions.length) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: nextPermissions };
    });
  }

  async function sendInvitation() {
    if (!selectedFriend || !selectedItems.length) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest("/v1/shares/invitations", {
        method: "POST",
        body: JSON.stringify({ username: selectedFriend.username, items: selectedItems }),
      });
      setSelected({});
      setInviteUsername("");
      setSelectedFriend(null);
      setNotice("Invitacion enviada. La otra persona debe aceptarla para activar el acceso.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la invitacion.");
    } finally {
      setSaving(false);
    }
  }

  async function decideInvitation(id: string, action: "accept" | "reject" | "revoke") {
    setSaving(true);
    try {
      await apiRequest(`/v1/shares/invitations/${id}/${action}`, { method: "POST" });
      await loadAll();
      setNotice(action === "accept" ? "Acceso aceptado." : action === "reject" ? "Invitacion rechazada." : "Invitacion revocada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la invitacion.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeGrant(id: string) {
    setSaving(true);
    try {
      await apiRequest(`/v1/shares/grants/${id}`, { method: "DELETE" });
      await loadAll();
      setNotice("Acceso revocado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar el acceso.");
    } finally {
      setSaving(false);
    }
  }

  const groups = [
    { type: "ACCOUNT" as const, label: "Cuentas", items: resources.filter((item) => item.resourceType === "ACCOUNT") },
    { type: "BUDGET" as const, label: "Presupuestos", items: resources.filter((item) => item.resourceType === "BUDGET") },
    { type: "COMMITMENT" as const, label: "Compromisos", items: resources.filter((item) => item.resourceType === "COMMITMENT") },
    { type: "PROJECTION" as const, label: "Proyecciones", items: resources.filter((item) => item.resourceType === "PROJECTION") },
    { type: "DEFICIT" as const, label: "Deficits", items: resources.filter((item) => item.resourceType === "DEFICIT") },
    { type: "REPORT" as const, label: "Dashboards", items: resources.filter((item) => item.resourceType === "REPORT") },
  ].filter((group) => group.items.length);

  return (
    <div className="section-enter space-y-6 pb-12">
      <div className="ui-shell-card relative flex flex-col gap-4 overflow-hidden bg-brand p-5 text-surface md:flex-row md:items-center md:justify-between md:p-7">
        <div>
          <div className="flex items-center gap-2 text-surface/80"><Shield className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">Control personal</span></div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-surface md:text-4xl">Configuración</h2>
          <p className="mt-1 max-w-2xl text-sm text-surface/75">Perfil, apariencia, conexiones y acceso compartido a tus finanzas.</p>
        </div>
        <div className="relative flex items-center gap-3"><span className="hidden text-right text-xs text-surface/70 sm:block">Tu espacio<br/>financiero privado</span><Button variant="outline" className="border-surface/30 bg-surface/10 text-surface hover:bg-surface/20" onClick={() => void loadAll()} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Actualizar</Button></div>
        <span className="pointer-events-none absolute -bottom-14 right-28 h-44 w-44 rounded-full border-[28px] border-surface/10" />
      </div>

      {error && <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {notice && <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{notice}</div>}

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="ds-soft-card overflow-hidden">
          <CardHeader><CardTitle>Tu identidad</CardTitle><CardDescription>Este nombre de usuario sirve para recibir invitaciones sin compartir tu correo.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" /></div>
              <div className="space-y-1.5"><Label>Nombre de usuario</Label><Input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="sebastian-navarro" /></div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5" />{profile?.email || "Correo no disponible"}<Badge variant="outline" className="ml-auto">{profile?.auth_provider || "LOCAL"}</Badge></div>
            <Button onClick={() => void saveProfile()} disabled={saving || !username.trim()} className="rounded-xl">Guardar perfil</Button>
          </CardContent>
        </Card>

        <Card className="ds-soft-card overflow-hidden">
          <CardHeader><CardTitle>Apariencia</CardTitle><CardDescription>Los cambios se aplican en web y desktop en este dispositivo.</CardDescription></CardHeader>
          <CardContent>
            <ThemeSelector
              panel
              onThemeChange={(theme) => { void apiRequest("/v1/settings/preferences", { method: "PATCH", body: JSON.stringify({ theme }) }); }}
              onBackgroundChange={(backgroundMode) => { void apiRequest("/v1/settings/preferences", { method: "PATCH", body: JSON.stringify({ backgroundMode }) }); }}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="ds-soft-card overflow-hidden">
        <CardHeader><CardTitle>Conexiones del sistema</CardTitle><CardDescription>Estado de las capacidades que pueden trabajar con tus datos. Las claves nunca se muestran aqui.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            { key: "mastra", label: "Mastra", icon: SparkleIcon, description: "Agentes y workflows" },
            { key: "mcp", label: "MCP financiero", icon: Link2, description: integrations?.mcp?.path || "Puente de herramientas" },
            { key: "hermes", label: "Hermes", icon: Mail, description: "Automatizacion externa" },
          ].map((item) => {
            const status = integrations?.[item.key as keyof Integrations] as { enabled?: boolean; configured?: boolean } | undefined;
            const active = Boolean(status?.enabled || status?.configured);
            const Icon = item.icon;
            return <div key={item.key} className="rounded-2xl border border-border bg-muted/20 p-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{item.label}</p><p className="truncate text-xs text-muted-foreground">{item.description}</p></div><span className={cn("ml-auto h-2.5 w-2.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/40")} /></div><p className="mt-3 text-xs text-muted-foreground">{active ? "Conectado y disponible" : "No configurado"}</p></div>;
          })}
        </CardContent>
      </Card>

      <Card className="ds-soft-card overflow-hidden">
        <CardHeader><CardTitle>Amigos</CardTitle><CardDescription>Busca por username exacto y crea una amistad antes de compartir cualquier dato financiero.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Label htmlFor="friend-username">Username exacto</Label>
              <div className="mt-1.5 flex gap-2">
                <Input id="friend-username" value={friendUsername} onChange={(event) => { setFriendUsername(event.target.value); setFriendMatches([]); setSelectedFriend(null); }} onKeyDown={(event) => { if (event.key === "Enter") void searchFriend(); }} placeholder="ej. sergio-navarro" />
                <Button type="button" variant="outline" onClick={() => void searchFriend()} disabled={saving || friendUsername.trim().length < 3}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar</Button>
              </div>
              {friendMatches.length > 0 && <div className="absolute left-0 right-0 top-[4.4rem] z-10 rounded-xl border border-border bg-popover p-1 shadow-xl">{friendMatches.map((match) => <button key={match.id} type="button" onClick={() => { setSelectedFriend(match); setFriendUsername(match.username); setFriendMatches([]); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><UserCheck className="h-4 w-4" /></span><span><span className="block text-sm font-medium text-foreground">@{match.username}</span><span className="block text-xs text-muted-foreground">{match.name || "Usuario FinanceSystem"}</span></span></button>)}</div>}
              {selectedFriend && <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"><UserCheck className="h-4 w-4" /> @{selectedFriend.username} seleccionado <button type="button" className="ml-auto" onClick={() => { setSelectedFriend(null); setFriendUsername(""); }} aria-label="Quitar seleccion"><X className="h-4 w-4" /></button></div>}
            </div>
            <div className="flex items-end"><Button type="button" onClick={() => void sendFriendRequest()} disabled={saving || !selectedFriend} className="w-full rounded-xl md:w-auto"><UserPlus className="h-4 w-4" /> Enviar solicitud</Button></div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-muted/20 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground">Amistades activas</p><Badge variant="outline">{friends.length}</Badge></div><div className="mt-3 space-y-2">{friends.map((friend) => <div key={friend.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-3 py-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><UserCheck className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">@{friend.username}</p><p className="truncate text-xs text-muted-foreground">{friend.name || "Usuario FinanceSystem"}</p></div><Button size="sm" variant="ghost" onClick={() => void removeFriend(friend.id)} disabled={saving}>Eliminar</Button></div>)}{!friends.length && <EmptyState icon={UserPlus} text="Aun no tienes amistades activas." />}</div></div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4"><p className="text-sm font-semibold text-foreground">Solicitudes pendientes</p><div className="mt-3 space-y-2">{friendRequests.received.filter((request) => request.status === "PENDING").map((request) => { const accepting = friendRequestAction === `${request.id}:accept`; const rejecting = friendRequestAction === `${request.id}:reject`; return <div key={request.id} className="rounded-xl border border-border bg-card/50 p-3"><p className="text-sm font-medium text-foreground">@{request.username}</p><p className="text-xs text-muted-foreground">Quiere agregarte como amigo</p><div className="mt-2 flex gap-2"><Button size="sm" onClick={() => void decideFriendRequest(request.id, "accept")} disabled={saving}>{accepting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {accepting ? "Aceptando..." : "Aceptar"}</Button><Button size="sm" variant="outline" onClick={() => void decideFriendRequest(request.id, "reject")} disabled={saving}>{rejecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {rejecting ? "Rechazando..." : "Rechazar"}</Button></div>{friendRequestError && (accepting || rejecting) && <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">{friendRequestError}</p>}</div>; })}{friendRequests.sent.filter((request) => request.status === "PENDING").map((request) => <div key={request.id} className="rounded-xl border border-dashed border-border p-3"><p className="text-sm font-medium text-foreground">@{request.username}</p><p className="text-xs text-muted-foreground">Solicitud enviada</p><Button size="sm" variant="ghost" className="mt-1 px-0" onClick={() => void decideFriendRequest(request.id, "cancel")} disabled={saving}>{friendRequestAction === `${request.id}:cancel` && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {friendRequestAction === `${request.id}:cancel` ? "Cancelando..." : "Cancelar"}</Button></div>)}{!friendRequests.received.filter((request) => request.status === "PENDING").length && !friendRequests.sent.filter((request) => request.status === "PENDING").length && <p className="text-xs text-muted-foreground">No hay solicitudes pendientes.</p>}</div></div>
          </div>
        </CardContent>
      </Card>

      <Card className="ds-soft-card overflow-hidden">
        <CardHeader><CardTitle>Compartir finanzas</CardTitle><CardDescription>Comparte cuentas o recursos concretos con un amigo activo y permisos explicitos.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative"><Label htmlFor="share-username">Amigo destinatario</Label><div className="mt-1.5 flex gap-2"><Input id="share-username" value={inviteUsername} readOnly placeholder="Selecciona un amigo activo abajo" /><select aria-label="Seleccionar amigo" value={selectedFriend?.id || ""} onChange={(event) => { const friend = friends.find((item) => item.id === event.target.value) || null; setSelectedFriend(friend); setInviteUsername(friend?.username || ""); }} className="h-10 max-w-[16rem] rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Amigos</option>{friends.map((friend) => <option key={friend.id} value={friend.id}>@{friend.username}</option>)}</select></div>{selectedFriend && <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"><UserCheck className="h-4 w-4" /> @{selectedFriend.username} seleccionado</div>}</div>
            <div className="flex items-end"><Button type="button" onClick={() => void sendInvitation()} disabled={saving || !selectedFriend || !selectedItems.length} className="w-full rounded-xl md:w-auto">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Enviar invitacion</Button></div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-foreground">Recursos a compartir</p><p className="text-xs text-muted-foreground">Seleccionados: {selectedItems.length}. Los movimientos se incluyen automáticamente al compartir una cuenta.</p></div><Badge variant="outline">{resources.length} disponibles</Badge></div><div className="mt-4 space-y-4">{groups.map((group) => <div key={group.type}><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p><div className="grid gap-2 lg:grid-cols-2">{group.items.map((item) => { const key = resourceKey(item.resourceType, item.resourceId); const permissions = selected[key] || []; const active = permissions.length > 0; return <div key={key} className={cn("rounded-xl border p-3 transition-colors", active ? "border-primary/60 bg-primary/5" : "border-border bg-card/40")}><button type="button" onClick={() => toggleResource(item)} className="flex w-full items-start gap-3 text-left"><span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", active ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent")}><Check className="h-3 w-3" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{formatResourceLabel(item)}</span><span className="text-xs text-muted-foreground">{active ? "Seleccionado" : "Toca para seleccionar"}</span></span></button>{active && <div className="mt-3 flex flex-wrap gap-1.5 pl-8">{PERMISSIONS.map((permission) => <button key={permission.value} type="button" onClick={() => togglePermission(item, permission.value)} title={permission.hint} className={cn("rounded-full border px-2.5 py-1 text-[11px] transition-colors", permissions.includes(permission.value) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>{permission.label}</button>)}</div>}</div>; })}</div></div>)}</div>{!resources.length && <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Todavia no tienes recursos listos para compartir.</p>}</div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="ds-soft-card overflow-hidden"><CardHeader><CardTitle>Invitaciones recibidas</CardTitle><CardDescription>Acepta solo los accesos que reconozcas.</CardDescription></CardHeader><CardContent className="space-y-3">{received.filter((item) => item.status === "PENDING").map((item) => <div key={item.id} className="rounded-xl border border-surface-2 bg-surface-1/70 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-fg">@{item.owner_username} quiere compartir contigo</p><p className="mt-1 text-xs text-fg-subtle">{item.items.length} recursos seleccionados</p></div><Badge variant="outline">Pendiente</Badge></div><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void decideInvitation(item.id, "accept")} disabled={saving}>Aceptar</Button><Button size="sm" variant="outline" onClick={() => void decideInvitation(item.id, "reject")} disabled={saving}>Rechazar</Button></div></div>)}{!received.some((item) => item.status === "PENDING") && <EmptyState icon={Lock} text="No tienes invitaciones pendientes." />}</CardContent></Card>
        <Card className="ds-soft-card overflow-hidden"><CardHeader><CardTitle>Accesos y solicitudes enviadas</CardTitle><CardDescription>Revoca un acceso activo o una invitacion pendiente.</CardDescription></CardHeader><CardContent className="space-y-3">{sent.filter((item) => item.status === "PENDING").map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-dashed border-surface-2 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-fg">@{item.invitee_username} - invitacion pendiente</p><p className="text-xs text-fg-subtle">{item.items.length} recursos seleccionados</p></div><Button size="sm" variant="outline" onClick={() => void decideInvitation(item.id, "revoke")} disabled={saving}><X className="h-3.5 w-3.5" /> Revocar</Button></div>)}{grants.filter((item) => item.status === "ACTIVE" && item.owner_user_id === profile?.id).map((grant) => <div key={grant.id} className="flex items-center gap-3 rounded-xl border border-surface-2 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-fg">@{grant.grantee_username} - {grant.resource_type} {grant.resource_id}</p><p className="text-xs text-fg-subtle">{grant.permissions.join(" / ")}</p></div><Button size="sm" variant="outline" onClick={() => void revokeGrant(grant.id)} disabled={saving}><X className="h-3.5 w-3.5" /> Revocar</Button></div>)}{!sent.some((item) => item.status === "PENDING") && !grants.some((item) => item.status === "ACTIVE" && item.owner_user_id === profile?.id) && <EmptyState icon={Shield} text="Todavia no has compartido recursos." />}</CardContent></Card>
      </div>

      <Card className="ds-soft-card overflow-hidden"><CardHeader><CardTitle>Accesos que recibes</CardTitle><CardDescription>Recursos de otras personas disponibles para ti.</CardDescription></CardHeader><CardContent className="space-y-3">{grants.filter((item) => item.status === "ACTIVE" && item.grantee_user_id === profile?.id).map((grant) => <div key={grant.id} className="flex items-center gap-3 rounded-xl border border-surface-2 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-fg">@{grant.owner_username} - {grant.resource_type} {grant.resource_id}</p><p className="text-xs text-fg-subtle">Permisos: {grant.permissions.join(" / ")}</p></div><Badge variant="outline">Activo</Badge></div>)}{!grants.some((item) => item.status === "ACTIVE" && item.grantee_user_id === profile?.id) && <EmptyState icon={Link2} text="Cuando aceptes una invitacion, sus recursos apareceran aqui." />}</CardContent></Card>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" /> {text}</div>;
}

function SparkleIcon({ className }: { className?: string }) {
  return <span className={className}>✦</span>;
}
