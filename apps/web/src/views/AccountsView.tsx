"use client";

import * as React from "react";
import { Wallet, Plus, Building2, Grid2X2, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, DataView, type DataViewColumn, EmptyState } from "@/components/finance";
import type { Account, AccountType } from "@/lib/types";
import { formatMoney, toNumber, getAccountTypeLabel } from "@/lib/format";

export interface AccountFormState {
  code: string;
  name: string;
  currency: string;
  accountType: AccountType;
  balanceCurrent: string;
}

export interface AccountsViewProps {
  accounts: Account[];
  accountTotals: { active: number; positive: number; negative: number };
  accountForm: AccountFormState;
  setAccountForm: React.Dispatch<React.SetStateAction<AccountFormState>>;
  onCreateAccount: () => void;
  saving: boolean;
}

const ACCOUNT_TYPES: AccountType[] = ["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "INVESTMENT", "LOAN", "OTHER"];

export function AccountsView({
  accounts,
  accountTotals,
  accountForm,
  setAccountForm,
  onCreateAccount,
  saving,
}: AccountsViewProps) {
  const [viewMode, setViewMode] = React.useState<"cards" | "table">("cards");
  const columns: DataViewColumn<Account>[] = [
    { key: "code", header: "Código", render: (a) => <span className="font-mono text-xs text-fg-subtle">{a.code}</span> },
    { key: "name", header: "Nombre", render: (a) => <span className="font-medium">{a.name}</span>, cardTitle: true },
    {
      key: "accountType",
      header: "Tipo",
      render: (a) => <span className="text-fg-secondary">{getAccountTypeLabel(a.account_type)}</span>,
    },
    {
      key: "balance",
      header: "Saldo",
      align: "right",
      render: (a) => (
        <span
          className={
            toNumber(a.balance_current) < 0
              ? "font-semibold text-danger"
              : "font-semibold text-fg"
          }
        >
          {formatMoney(toNumber(a.balance_current), a.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      render: (a) => (
        <span
          className={
            a.is_active
              ? "inline-flex items-center rounded-full border border-positive/40 bg-positive-soft px-2.5 py-0.5 text-xs font-medium text-positive"
              : "inline-flex items-center rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-fg-subtle"
          }
        >
          {a.is_active ? "Activa" : "Inactiva"}
        </span>
      ),
      hideOnCard: true,
    },
  ];

  return (
    <div className="section-enter space-y-5">
      <PageHeader
        title="Cuentas"
        subtitle="Dónde está tu dinero ahora mismo."
        icon={<Wallet className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="ui-shell-card overflow-hidden border-l-4 border-l-brand"><CardContent className="p-5 md:p-6"><p className="text-xs font-semibold uppercase tracking-[0.17em] ui-muted">Cuentas activas</p><p className="mt-2 text-4xl font-bold tracking-[-0.06em] text-brand">{accountTotals.active}</p><p className="mt-1 text-sm ui-muted">Bolsillos que sostienen tu día a día</p></CardContent></Card>
        <Card className="ds-soft-card"><CardContent className="p-5 md:p-6"><p className="text-xs font-semibold uppercase tracking-[0.17em] ui-muted">Saldo positivo</p><p className="mt-2 break-words text-3xl font-bold tracking-[-0.05em] text-positive md:text-4xl">{formatMoney(accountTotals.positive, "COP")}</p><p className="mt-1 text-sm ui-muted">Disponible en cuentas con saldo a favor</p></CardContent></Card>
        <Card className="ds-soft-card"><CardContent className="p-5 md:p-6"><p className="text-xs font-semibold uppercase tracking-[0.17em] ui-muted">Sobregiros</p><p className="mt-2 break-words text-3xl font-bold tracking-[-0.05em] text-danger md:text-4xl">{formatMoney(accountTotals.negative, "COP")}</p><p className="mt-1 text-sm ui-muted">Saldos por atender</p></CardContent></Card>
      </div>

      <Card className="ui-shell-card overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Tu mapa financiero</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-fg">Cuentas y bolsillos</h2><p className="mt-1 text-sm ui-muted">{accounts.length} fuentes de dinero para tener en perspectiva.</p></div>
            {accounts.length > 0 && <div className="flex rounded-xl border border-surface-2 bg-surface-1 p-1" role="group" aria-label="Vista de cuentas">
              <Button type="button" size="sm" variant={viewMode === "cards" ? "default" : "ghost"} aria-pressed={viewMode === "cards"} onClick={() => setViewMode("cards")} className={viewMode === "cards" ? "bg-brand text-surface hover:bg-brand/90" : "text-fg-secondary"}><Grid2X2 className="mr-1.5 h-4 w-4" />Tarjetas</Button>
              <Button type="button" size="sm" variant={viewMode === "table" ? "default" : "ghost"} aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")} className={viewMode === "table" ? "bg-brand text-surface hover:bg-brand/90" : "text-fg-secondary"}><Table2 className="mr-1.5 h-4 w-4" />Tabla</Button>
            </div>}
          </div>
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-7 w-7" />}
              title="Aún no hay cuentas"
            >
              Crea tu primera cuenta desde el formulario de abajo para empezar a registrar movimientos.
            </EmptyState>
          ) : viewMode === "table" ? (
            <DataView columns={columns} rows={accounts} rowKey={(a) => a.id} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {accounts.map((account, index) => {
                const balance = toNumber(account.balance_current);
                return <article key={account.id} className={`group relative overflow-hidden rounded-[24px] border border-surface-2 p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none ${index % 3 === 1 ? "bg-brand-soft" : "bg-surface-1"}`}>
                  <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-9 h-28 w-28 rounded-full border-[20px] border-brand/10 transition-transform duration-500 group-hover:scale-125" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Wallet className="h-5 w-5" /></span><div className="min-w-0"><h3 className="truncate text-lg font-semibold tracking-tight text-fg">{account.name}</h3><p className="mt-0.5 truncate text-xs ui-muted">{getAccountTypeLabel(account.account_type)} · {account.code}</p></div></div>
                    <span className={account.is_active ? "rounded-full border border-positive/30 bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-positive" : "rounded-full border border-surface-2 px-2.5 py-1 text-[11px] font-semibold ui-muted"}>{account.is_active ? "Activa" : "Inactiva"}</span>
                  </div>
                  <p className="relative mt-7 text-[11px] font-semibold uppercase tracking-[0.17em] ui-muted">Saldo actual</p>
                  <p className={`relative mt-1 break-words text-3xl font-bold tracking-[-0.055em] md:text-4xl ${balance < 0 ? "text-danger" : "text-fg"}`}>{formatMoney(balance, account.currency)}</p>
                </article>;
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Plus className="h-5 w-5" /></span>
            <div><h2 className="text-xl font-semibold tracking-[-0.03em] text-fg">Nueva cuenta</h2><p className="text-sm ui-muted">Dale un lugar a otra parte de tu dinero.</p></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="text-xs text-fg-subtle">Código</Label>
              <Input
                className="bg-surface-1 border-surface-2"
                value={accountForm.code}
                onChange={(e) => setAccountForm((p) => ({ ...p, code: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Nombre</Label>
              <Input
                className="bg-surface-1 border-surface-2"
                value={accountForm.name}
                onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Moneda</Label>
              <Input
                className="bg-surface-1 border-surface-2"
                value={accountForm.currency}
                onChange={(e) => setAccountForm((p) => ({ ...p, currency: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Tipo</Label>
              <Select
                value={accountForm.accountType}
                onValueChange={(v) => setAccountForm((p) => ({ ...p, accountType: v as AccountType }))}
              >
                <SelectTrigger className="bg-surface-1 border-surface-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {getAccountTypeLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Saldo inicial</Label>
              <Input
                className="bg-surface-1 border-surface-2"
                type="number"
                value={accountForm.balanceCurrent}
                onChange={(e) => setAccountForm((p) => ({ ...p, balanceCurrent: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button
                onClick={() => onCreateAccount()}
                disabled={saving}
                className="bg-brand hover:bg-brand/90 text-surface"
              >
                Crear cuenta
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountsView;
